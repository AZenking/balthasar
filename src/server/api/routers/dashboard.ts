import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { loadFamilyIdByUserId } from "@/server/db/queries/account";
import {
  getMonthSummary,
  getRecentTransactions,
  getCategoryBreakdown,
  getDailyTrend,
} from "@/server/db/queries/dashboard";
import { getAssets } from "@/server/db/queries/assets";
import {
  getBudget,
  upsertBudget,
  deleteBudget,
} from "@/server/db/queries/budget";
import { computeBudgetStatus } from "@/server/domain/dashboard/budget-status";
import { getUtcMonthRange } from "@/lib/date-ranges";
import { serializeTransaction } from "@/server/db/queries/transaction";

/**
 * Dashboard router.
 *
 * `summary` covers both 006-dashboard (current-month aggregate) and the
 * 026-cream-amber-revamp extension (year/month input, expenseTrend,
 * Top 2 categories, 4 recent transactions).
 */

export const dashboardRouter = router({
  summary: protectedProcedure
    .input(
      z
        .object({
          year: z
            .number()
            .int()
            .min(2020)
            .max(new Date().getUTCFullYear())
            .optional(),
          month: z.number().int().min(1).max(12).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const familyId = await loadFamilyIdByUserId(ctx.session.user.id);

      // Resolve effective (year, month): each field defaults to current UTC
      // value independently — supports "year-only" / "month-only" inputs.
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth() + 1;
      const year = input?.year ?? currentYear;
      const month = input?.month ?? currentMonth;

      const { start: monthStart, end: monthEnd } = getUtcMonthRange(year, month);
      const isCurrentMonth = year === currentYear && month === currentMonth;

      // 027:趋势改为本月每日(线稿口径),不再用本周 Mon-Sun 窗口。
      // 当前月:每日桶 1 日..今天;历史月:每日桶 1 日..月末。
      const [summary, recent, breakdown, trend] = await Promise.all([
        getMonthSummary({ familyId, monthStart, monthEnd }),
        getRecentTransactions({ familyId, limit: 5 }),
        getCategoryBreakdown({ familyId, monthStart, monthEnd }),
        getDailyTrend({ familyId, weekStart: monthStart, weekEnd: monthEnd }).then((buckets) => ({
          granularity: "daily" as const,
          buckets,
        })),
      ]);

      const monthNet = summary.income - summary.expense;
      const monthExpense = summary.expense;

      // 027 US5 (research R2):预算降级查询 —— 失败时 budget=null(SC-008)。
      // 注意:getBudget 返回 null(未设置)与 catch null 必须区分:
      // 用独立 try/catch,null(未设置)→ computeBudgetStatus(unset);
      // 抛错 → null(降级)。
      let budget: ReturnType<typeof computeBudgetStatus> | null;
      try {
        const budgetRow = await getBudget({ familyId, year, month });
        budget = computeBudgetStatus(monthExpense, budgetRow?.amount ?? null);
      } catch {
        budget = null;
      }

      // Top 4 categories (027-mobile-home-revamp FR-004; was Top 2 in 026).
      // getCategoryBreakdown already orders by amount DESC; we add a
      // tie-breaker on categoryName ASC (stable) before slicing.
      const topExpenseCategories = [...breakdown]
        .sort((a, b) => {
          if (b.amount !== a.amount) return b.amount - a.amount;
          return a.categoryName.localeCompare(b.categoryName);
        })
        .slice(0, 4)
        .map((c) => ({
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          categoryIcon: c.categoryIcon,
          amount: c.amount,
          percentage:
            monthExpense > 0
              ? Math.round((c.amount / monthExpense) * 1000) / 10
              : 0,
        }));

      // budget 已在上方 try/catch 中计算(四态或降级 null)。

      // 027 US6:资产聚合降级 —— 失败时 null(SC-008)。
      let assets: Awaited<ReturnType<typeof getAssets>> | null;
      try {
        assets = await getAssets({ familyId });
      } catch {
        assets = null;
      }

      return {
        queriedYearMonth: { year, month },
        monthIncome: summary.income,
        monthExpense,
        monthNet,
        topExpenseCategories,
        recentTransactions: recent.map(serializeTransaction),
        expenseTrend: trend,
        budget, // 027 US5:BudgetSummary | null
        assets, // 027 US6:AssetsSummary | null
      };
    }),

  /**
   * `dashboard.assets` — 027 US6 资产三项聚合(独立 procedure,供单独刷新)。
   * contracts/dashboard-assets.md。按 accounts.type 分组 + transfer 双向余额。
   */
  assets: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await loadFamilyIdByUserId(ctx.session.user.id);
    return getAssets({ familyId });
  }),

  /**
   * `dashboard.budget` — 027 US5 月预算 CRUD。
   * contracts/dashboard-budget.md。仅月周期(clarify Q3)。
   * 四态由 summary 内联 computeBudgetStatus 派生;本子路由只返回原始 amount。
   */
  budget: router({
    /** 查询单月预算(未设置 → null)。 */
    get: protectedProcedure
      .input(
        z.object({
          year: z.number().int().min(2020).max(new Date().getUTCFullYear()),
          month: z.number().int().min(1).max(12),
        }),
      )
      .query(async ({ ctx, input }) => {
        const familyId = await loadFamilyIdByUserId(ctx.session.user.id);
        return getBudget({
          familyId,
          year: input.year,
          month: input.month,
        });
      }),

    /** 设置/更新预算(upsert;依赖 UNIQUE 索引 ON CONFLICT)。 */
    set: protectedProcedure
      .input(
        z.object({
          year: z.number().int().min(2020).max(new Date().getUTCFullYear()),
          month: z.number().int().min(1).max(12),
          amount: z.number().int().positive("预算必须 > 0"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const familyId = await loadFamilyIdByUserId(ctx.session.user.id);
        const result = await upsertBudget({
          familyId,
          year: input.year,
          month: input.month,
          amount: input.amount,
        });
        return { success: true as const, amount: result.amount };
      }),

    /** 删除单月预算(幂等)。 */
    delete: protectedProcedure
      .input(
        z.object({
          year: z.number().int().min(2020).max(new Date().getUTCFullYear()),
          month: z.number().int().min(1).max(12),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const familyId = await loadFamilyIdByUserId(ctx.session.user.id);
        await deleteBudget({
          familyId,
          year: input.year,
          month: input.month,
        });
        return { success: true as const };
      }),
  }),

  /**
   * `dashboard.report` — 026 Phase 2b Foundational.
   *
   * Returns the 6-month trend (target month + 5 preceding) plus target-month
   * category breakdown. Used by /reports page (US3).
   *
   * Contract: specs/026-cream-amber-revamp/contracts/dashboard-report.md
   */
  report: protectedProcedure
    .input(
      z
        .object({
          endYear: z
            .number()
            .int()
            .min(2020)
            .max(new Date().getUTCFullYear())
            .optional(),
          endMonth: z.number().int().min(1).max(12).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const familyId = await loadFamilyIdByUserId(ctx.session.user.id);

      const now = new Date();
      const endYear = input?.endYear ?? now.getUTCFullYear();
      const endMonth = input?.endMonth ?? now.getUTCMonth() + 1;

      // Build 6-month window DESC (end month at index 0).
      // JS Date auto-handles year rollover when month index is negative.
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(Date.UTC(endYear, endMonth - 1 - i, 1));
        return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
      });

      const ranges = months.map((m) => ({
        ...m,
        ...getUtcMonthRange(m.year, m.month),
      }));

      // Parallel: 6× getMonthSummary + 1× getCategoryBreakdown (target month only).
      const [summaries, breakdown] = await Promise.all([
        Promise.all(
          ranges.map((r) =>
            getMonthSummary({
              familyId,
              monthStart: r.start,
              monthEnd: r.end,
            }),
          ),
        ),
        getCategoryBreakdown({
          familyId,
          monthStart: ranges[0].start,
          monthEnd: ranges[0].end,
        }),
      ]);

      const monthlyTrend = months.map((m, i) => ({
        year: m.year,
        month: m.month,
        label: `${m.year}年${m.month}月`,
        income: summaries[i].income,
        expense: summaries[i].expense,
        net: summaries[i].income - summaries[i].expense,
      }));

      const targetExpense = summaries[0].expense;
      const targetMonthCategoryBreakdown =
        targetExpense > 0
          ? breakdown.map((c) => ({
              categoryId: c.categoryId,
              categoryName: c.categoryName,
              categoryIcon: c.categoryIcon,
              amount: c.amount,
              percentage: Math.round((c.amount / targetExpense) * 1000) / 10,
            }))
          : [];

      return {
        endYearMonth: { year: endYear, month: endMonth },
        monthlyTrend,
        targetMonthCategoryBreakdown,
      };
    }),
});

export type DashboardRouter = typeof dashboardRouter;
