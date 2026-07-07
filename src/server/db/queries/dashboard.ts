import "server-only";
import { db } from "@/server/db/client";
import { transaction, account, category } from "@/server/db/schema";
import { eq, and, gte, lt, desc, sql } from "drizzle-orm";

/**
 * Dashboard queries (006-dashboard). 3 independent aggregation functions
 * called via Promise.all in the procedure (research.md Q1).
 */

/**
 * 1. Month summary: SUM income + expense for the given month range.
 * Uses signed bigint (004 Q1): income = SUM(positive), expense = SUM(ABS(negative)).
 */
export async function getMonthSummary(opts: {
  familyId: string;
  monthStart: Date;
  monthEnd: Date;
}): Promise<{ income: number; expense: number }> {
  const rows = await db
    .select({
      income: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.amount} > 0 THEN ${transaction.amount} ELSE 0 END), 0)`,
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.amount} < 0 THEN ABS(${transaction.amount}) ELSE 0 END), 0)`,
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
      categoryId: transaction.categoryId,
      amount: transaction.amount,
      remark: transaction.remark,
      occurredAt: transaction.occurredAt,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      accountName: account.name,
      categoryName: category.name,
      categoryIcon: category.icon,
    })
    .from(transaction)
    .leftJoin(account, eq(transaction.accountId, account.id))
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
      amount: sql<number>`SUM(ABS(${transaction.amount}))`,
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
    .orderBy(sql`SUM(ABS(${transaction.amount})) DESC`);

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    categoryIcon: r.categoryIcon,
    amount: Number(r.amount),
  }));
}
