import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { loadFamilyIdByUserId } from "@/server/db/queries/account";
import {
  getMonthSummary,
  getRecentTransactions,
  getCategoryBreakdown,
  getDailyTrend,
  getWeeklyTrend,
} from "@/server/db/queries/dashboard";
import { getUtcMonthRange } from "@/lib/date-ranges";
import { serializeTransaction } from "@/server/db/queries/transaction";

/**
 * Dashboard router.
 *
 * `summary` covers both 006-dashboard (current-month aggregate) and the
 * 026-cream-amber-revamp extension (year/month input, expenseTrend,
 * Top 2 categories, 4 recent transactions).
 */
const isoWeekday = (utcDay: number) => (utcDay === 0 ? 6 : utcDay - 1);

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

      // Current-week Mon-Sun window for the daily trend. `now` may live in
      // any week; back up to the most recent Monday 00:00 UTC.
      const nowDow = isoWeekday(now.getUTCDay());
      const weekStart = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - nowDow,
        ),
      );
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

      const [summary, recent, breakdown, trend] = await Promise.all([
        getMonthSummary({ familyId, monthStart, monthEnd }),
        getRecentTransactions({ familyId, limit: 4 }),
        getCategoryBreakdown({ familyId, monthStart, monthEnd }),
        isCurrentMonth
          ? getDailyTrend({ familyId, weekStart, weekEnd }).then((buckets) => ({
              granularity: "daily" as const,
              buckets,
            }))
          : getWeeklyTrend({
              familyId,
              year,
              month,
              monthStart,
              monthEnd,
            }).then((buckets) => ({
              granularity: "weekly" as const,
              buckets,
            })),
      ]);

      const monthNet = summary.income - summary.expense;
      const monthExpense = summary.expense;

      // Top 2 categories. getCategoryBreakdown already orders by amount DESC;
      // we add a tie-breaker on categoryName ASC (stable) before slicing.
      const topExpenseCategories = [...breakdown]
        .sort((a, b) => {
          if (b.amount !== a.amount) return b.amount - a.amount;
          return a.categoryName.localeCompare(b.categoryName);
        })
        .slice(0, 2)
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

      return {
        queriedYearMonth: { year, month },
        monthIncome: summary.income,
        monthExpense,
        monthNet,
        topExpenseCategories,
        recentTransactions: recent.map(serializeTransaction),
        expenseTrend: trend,
      };
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
