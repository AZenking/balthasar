import "server-only";
import { db } from "@/server/db/client";
import { transaction, account, category } from "@/server/db/schema";
import { eq, and, gte, lt, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  padDailyBuckets,
  getUtcWeeksInMonth,
} from "@/lib/date-ranges";

// 027 US4:转账的转入账户别名(与 account 同表,join 时区分)。
const toAccount = alias(account, "to_account");

/**
 * Dashboard queries (006-dashboard). 3 independent aggregation functions
 * called via Promise.all in the procedure (research.md Q1).
 */

/**
 * 1. Month summary: SUM income + expense for the given month range.
 *
 * 027 US4 (research R9):改 type-driven 聚合(原 sign-driven)。
 *   - income = SUM(CASE WHEN type='income' THEN amount ELSE 0 END)
 *     (type-driven,防 transfer 正 amount 误入)
 *   - expense = SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END)
 *     (type-driven + ABS,含退款 +正 amount;transfer 排除)
 */
export async function getMonthSummary(opts: {
  familyId: string;
  monthStart: Date;
  monthEnd: Date;
}): Promise<{ income: number; expense: number }> {
  // 027 US4/C2 (research R9):type-driven 聚合。
  // expense 用 signed SUM + 最终 ABS:普通支出负、退款正(isRefund),相加后
  // ABS 得净支出(退款真正冲减,而非 ABS 逐行求和导致退款反向增加)。
  // 例:−10000 + 退款 +3000 = −7000 → ABS = 7000(净支出下降)。
  const rows = await db
    .select({
      income: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'income' THEN ${transaction.amount} ELSE 0 END), 0)`,
      expense: sql<number>`ABS(COALESCE(SUM(CASE WHEN ${transaction.type} = 'expense' THEN ${transaction.amount} ELSE 0 END), 0))`,
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.familyId, opts.familyId),
        gte(transaction.occurredAt, opts.monthStart),
        lt(transaction.occurredAt, opts.monthEnd)
      )
    );

  return {
    income: Number(rows[0]?.income ?? 0),
    expense: Number(rows[0]?.expense ?? 0),
  };
}

/**
 * 2. Recent transactions: latest N (default 5), with JOIN.
 * NOT limited to current month — user may have no transactions this month.
 */
export async function getRecentTransactions(opts: {
  familyId: string;
  limit?: number;
}) {
  return db
    .select({
      id: transaction.id,
      familyId: transaction.familyId,
      type: transaction.type,
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId, // 027 US4
      categoryId: transaction.categoryId,
      amount: transaction.amount,
      remark: transaction.remark,
      occurredAt: transaction.occurredAt,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      accountName: account.name,
      toAccountName: toAccount.name, // 027 US4
      categoryName: category.name,
      categoryIcon: category.icon,
    })
    .from(transaction)
    .leftJoin(account, eq(transaction.accountId, account.id))
    .leftJoin(toAccount, eq(transaction.toAccountId, toAccount.id)) // 027 US4
    .leftJoin(category, eq(transaction.categoryId, category.id))
    .where(eq(transaction.familyId, opts.familyId))
    .orderBy(desc(transaction.occurredAt))
    .limit(opts.limit ?? 5);
}

/**
 * 3. Category breakdown: expense by category for current month, DESC.
 * Returns raw amount; percentage computed in app layer (research.md Q2).
 */
export async function getCategoryBreakdown(opts: {
  familyId: string;
  monthStart: Date;
  monthEnd: Date;
}): Promise<
  Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    amount: number;
  }>
> {
  const rows = await db
    .select({
      categoryId: category.id,
      categoryName: category.name,
      categoryIcon: category.icon,
      // 027 C2:signed SUM + ABS —— 退款(+正 amount)真正冲减分类净支出,
      // 而非 ABS 逐行求和(会导致退款反向增加)。例:−10000 + 退款 +3000 → ABS(−7000)=7000。
      amount: sql<number>`ABS(SUM(${transaction.amount}))`,
    })
    .from(transaction)
    .innerJoin(category, eq(transaction.categoryId, category.id))
    .where(
      and(
        eq(transaction.familyId, opts.familyId),
        eq(transaction.type, "expense"),
        gte(transaction.occurredAt, opts.monthStart),
        lt(transaction.occurredAt, opts.monthEnd)
      )
    )
    .groupBy(category.id, category.name, category.icon)
    .orderBy(sql`ABS(SUM(${transaction.amount})) DESC`);

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    categoryIcon: r.categoryIcon,
    amount: Number(r.amount),
  }));
}

/**
 * 4. Daily expense trend for the Mon-Sun week containing `weekAnchor`.
 *
 * Returns 7 buckets (Mon..Sun), zero-padded, with `amount` = ABS(expense)
 * for that UTC day. Used for the current-month view (FR-C003).
 *
 * Implementation: fetch raw expense rows for [weekStart, weekEnd), then
 * aggregate + zero-pad via the pure `padDailyBuckets` helper. JS-side
 * aggregation chosen over SQL `GROUP BY DATE(...)` because the helper
 * already encodes the zero-pad + UTC-label contract and is unit-tested
 * independently — the per-week row count is tiny (≤ ~50 tx).
 */
export async function getDailyTrend(opts: {
  familyId: string;
  weekStart: Date; // Monday 00:00 UTC
  weekEnd: Date; // next Monday 00:00 UTC (exclusive)
}): Promise<Array<{ date: string; amount: number }>> {
  const rows = await db
    .select({ occurredAt: transaction.occurredAt, amount: transaction.amount })
    .from(transaction)
    .where(
      and(
        eq(transaction.familyId, opts.familyId),
        eq(transaction.type, "expense"),
        gte(transaction.occurredAt, opts.weekStart),
        lt(transaction.occurredAt, opts.weekEnd),
      ),
    );

  // DB amount is signed (expense negative). Project to positive per-day total
  // BEFORE handing to padDailyBuckets (which sums verbatim).
  return padDailyBuckets(
    rows.map((r) => ({
      occurredAt: r.occurredAt,
      amount: Math.abs(Number(r.amount)),
    })),
    opts.weekStart,
    opts.weekEnd,
  );
}

/**
 * 5. Weekly expense trend for the natural weeks covering [monthStart, monthEnd).
 *
 * Uses `getUtcWeeksInMonth` to derive Mon-Sun windows (first/last may be
 * partial — still counted per FR-C004), then aggregates ABS(expense) per
 * window via SQL. Returns `{ startDate, endDate, label, amount }` per week.
 *
 * Implementation: one Drizzle `select` per week window, run in parallel
 * via Promise.all. The per-month week count is 4–6, so the extra round-trips
 * are bounded; local PostgreSQL round-trip is sub-millisecond so total cost
 * stays well under the 500ms budget. This avoids the parameter-binding
 * complexity of a single CASE-based GROUP BY on `db.execute(sql.raw(...))`,
 * which would require manual `$N` placeholder ordering.
 */
export async function getWeeklyTrend(opts: {
  familyId: string;
  year: number;
  month: number; // 1-12
  monthStart: Date;
  monthEnd: Date;
}): Promise<
  Array<{ startDate: string; endDate: string; label: string; amount: number }>
> {
  const weeks = getUtcWeeksInMonth(opts.year, opts.month);

  if (weeks.length === 0) {
    return [];
  }

  const sums = await Promise.all(
    weeks.map(async (w) => {
      const rows = await db
        .select({
          total: sql<number>`COALESCE(SUM(ABS(${transaction.amount})), 0)`,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.familyId, opts.familyId),
            eq(transaction.type, "expense"),
            gte(transaction.occurredAt, w.start),
            lt(transaction.occurredAt, w.end),
          ),
        );
      return Number(rows[0]?.total ?? 0);
    }),
  );

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  // Suppress unused-variable lint on monthStart/monthEnd — the helper
  // accepts them so callers don't need a second getUtcMonthRange call, and
  // future optimisations may fold them into a single index-range scan.
  void opts.monthStart;
  void opts.monthEnd;

  return weeks.map((w, i) => ({
    startDate: fmt(w.start),
    endDate: fmt(new Date(w.end.getTime() - 86400000)), // inclusive Sun
    label: w.label,
    amount: sums[i] ?? 0,
  }));
}
