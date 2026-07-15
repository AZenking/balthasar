import "server-only";
import { db } from "@/server/db/client";
import { budget } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Budget queries (027-mobile-home-revamp US5)。
 *
 * 月预算 CRUD,键 = (familyId, year, month),UNIQUE 索引保证。
 * data-model §1.3 / contracts/dashboard-budget.md。
 */

/** 查询单月预算。未设置 → null。 */
export async function getBudget(opts: {
  familyId: string;
  year: number;
  month: number;
}): Promise<{ amount: number } | null> {
  const rows = await db
    .select({ amount: budget.amount })
    .from(budget)
    .where(
      and(
        eq(budget.familyId, opts.familyId),
        eq(budget.year, opts.year),
        eq(budget.month, opts.month),
      ),
    )
    .limit(1);
  return rows[0] ? { amount: rows[0].amount } : null;
}

/**
 * Upsert 预算(存在则 UPDATE,不存在则 INSERT)。
 * 依赖 UNIQUE(family_id, year, month) 索引做 ON CONFLICT。
 */
export async function upsertBudget(opts: {
  familyId: string;
  year: number;
  month: number;
  amount: number; // 分,正数
}): Promise<{ amount: number }> {
  const [row] = await db
    .insert(budget)
    .values({
      familyId: opts.familyId,
      year: opts.year,
      month: opts.month,
      amount: opts.amount,
    })
    .onConflictDoUpdate({
      target: [budget.familyId, budget.year, budget.month],
      set: { amount: opts.amount, updatedAt: new Date() },
    })
    .returning({ amount: budget.amount });
  if (!row) throw new Error("upsertBudget failed");
  return row;
}

/** 删除单月预算(幂等,不存在不报错)。 */
export async function deleteBudget(opts: {
  familyId: string;
  year: number;
  month: number;
}): Promise<void> {
  await db
    .delete(budget)
    .where(
      and(
        eq(budget.familyId, opts.familyId),
        eq(budget.year, opts.year),
        eq(budget.month, opts.month),
      ),
    );
}
