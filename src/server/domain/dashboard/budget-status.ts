/**
 * Budget status pure function (027-mobile-home-revamp US5, research R4)。
 *
 * computeBudgetStatus(usedAmount, budgetAmount) → 四态:
 *   - unset(未设置预算 / budgetAmount null 或 ≤ 0)
 *   - normal(< 80%)
 *   - warning(≥ 80% 且 < 100%,接近超支)
 *   - overspent(≥ 100%,已超支)
 *
 * 阈值 80% 硬编码(设计 §4.3 第一版;可配置留 V2)。
 *
 * 宪章原则四:纯函数,无 IO,易单测。
 */

export type BudgetStatus =
  | { status: "unset" }
  | { status: "normal"; usagePercent: number; remaining: number }
  | { status: "warning"; usagePercent: number; remaining: number }
  | { status: "overspent"; usagePercent: number; overspendAmount: number };

/**
 * 计算预算四态。
 *
 * @param usedAmount 该月已支出(分,正数,从 getMonthSummary.expense)
 * @param budgetAmount 预算金额(分);null = 未设置
 * @returns BudgetStatus
 */
export function computeBudgetStatus(
  usedAmount: number,
  budgetAmount: number | null,
): BudgetStatus {
  if (budgetAmount == null || budgetAmount <= 0) {
    return { status: "unset" };
  }
  const usagePercent = Math.round((usedAmount / budgetAmount) * 1000) / 10;
  if (usagePercent >= 100) {
    return {
      status: "overspent",
      usagePercent,
      overspendAmount: usedAmount - budgetAmount,
    };
  }
  if (usagePercent >= 80) {
    return {
      status: "warning",
      usagePercent,
      remaining: budgetAmount - usedAmount,
    };
  }
  return {
    status: "normal",
    usagePercent,
    remaining: budgetAmount - usedAmount,
  };
}
