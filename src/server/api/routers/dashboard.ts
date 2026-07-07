import { router, protectedProcedure } from "@/server/api/trpc";
import { loadFamilyIdByUserId } from "@/server/db/queries/account";
import {
  getMonthSummary,
  getRecentTransactions,
  getCategoryBreakdown,
} from "@/server/db/queries/dashboard";
import { getUTCMonthRange } from "@/server/domain/dashboard/month-range";
import { serializeTransaction } from "@/server/db/queries/transaction";

/**
 * Dashboard router (006-dashboard). Single summary procedure.
 */
export const dashboardRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await loadFamilyIdByUserId(ctx.session.user.id);
    const { start: monthStart, end: monthEnd } = getUTCMonthRange();

    // 3 queries in parallel (research.md Q1)
    const [summary, recent, breakdown] = await Promise.all([
      getMonthSummary({ familyId, monthStart, monthEnd }),
      getRecentTransactions({ familyId, limit: 5 }),
      getCategoryBreakdown({ familyId, monthStart, monthEnd }),
    ]);

    const monthNet = summary.income - summary.expense;

    // percentage computed in app layer (research.md Q2)
    const topExpenseCategories = breakdown.map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      categoryIcon: c.categoryIcon,
      amount: c.amount,
      percentage:
        summary.expense > 0
          ? Math.round((c.amount / summary.expense) * 1000) / 10
          : 0,
    }));

    return {
      monthIncome: summary.income,
      monthExpense: summary.expense,
      monthNet,
      recentTransactions: recent.map(serializeTransaction),
      topExpenseCategories,
    };
  }),
});

export type DashboardRouter = typeof dashboardRouter;
