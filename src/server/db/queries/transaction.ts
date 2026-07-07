import "server-only";
import { db, type TxClient } from "@/server/db/client";
import {
  transaction,
  account,
  category,
  type TransactionType,
} from "@/server/db/schema";
import { eq, and, isNull, desc, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Transaction queries (004-transaction, T015 + T024).
 *
 * Per research.md:
 * - Q2: validateAccountAndCategory does short-circuit checks
 * - Q3: get uses Drizzle leftJoin for accountName + categoryName + icon
 * - Q5: list uses cursor pagination (occurredAt DESC, limit+1 for hasMore)
 */

/**
 * Validate account + category for a transaction (research.md Q2+Q6).
 * Short-circuit: returns on first failure.
 */
export async function validateAccountAndCategory(
  tx: TxClient,
  opts: {
    accountId: string;
    categoryId: string;
    familyId: string;
    type: TransactionType;
  }
): Promise<void> {
  // 1. Account: must belong to family + not archived (FR-005)
  const accountRow = await tx
    .select({ id: account.id, familyId: account.familyId, archivedAt: account.archivedAt })
    .from(account)
    .where(eq(account.id, opts.accountId))
    .limit(1);

  const acct = accountRow[0];
  if (!acct || acct.familyId !== opts.familyId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "账户不存在或不属于当前家庭",
    });
  }
  if (acct.archivedAt !== null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "已归档账户不可用于交易",
    });
  }

  // 2. Category: must exist + type must match (FR-006)
  const categoryRow = await tx
    .select({ id: category.id, type: category.type })
    .from(category)
    .where(eq(category.id, opts.categoryId))
    .limit(1);

  const cat = categoryRow[0];
  if (!cat) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "分类不存在",
    });
  }
  if (cat.type !== opts.type) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `分类类型与交易类型不匹配 (分类是 ${cat.type}, 交易是 ${opts.type})`,
    });
  }
}

/**
 * Create transaction row (called within db.transaction).
 */
export async function insertTransaction(
  tx: TxClient,
  values: typeof transaction.$inferInsert
): Promise<typeof transaction.$inferSelect> {
  const [row] = await tx.insert(transaction).values(values).returning();
  if (!row) throw new Error("Failed to insert transaction");
  return row;
}

/**
 * Get transaction by id + familyId, with JOINed account/category names.
 * Uses global db (read-only, no tx needed).
 */
export async function getTransactionById(opts: {
  id: string;
  familyId: string;
}) {
  const rows = await db
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
    .where(
      and(
        eq(transaction.id, opts.id),
        eq(transaction.familyId, opts.familyId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * List transactions with cursor pagination (research.md Q5).
 */
export async function listTransactions(opts: {
  familyId: string;
  limit: number;
  cursor?: Date;
}) {
  const conditions = [eq(transaction.familyId, opts.familyId)];
  if (opts.cursor) {
    conditions.push(lt(transaction.occurredAt, opts.cursor));
  }

  const rows = await db
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
    .where(and(...conditions))
    .orderBy(desc(transaction.occurredAt))
    .limit(opts.limit + 1); // +1 to detect hasMore

  const hasMore = rows.length > opts.limit;
  const items = hasMore ? rows.slice(0, opts.limit) : rows;
  const nextCursor =
    hasMore && items.length > 0
      ? items[items.length - 1]!.occurredAt.toISOString()
      : null;

  return { items, nextCursor };
}

/**
 * Fetch single transaction by id + familyId (for update/delete pre-fetch).
 * Uses tx (within db.transaction).
 */
export async function findTransactionForUpdate(
  tx: TxClient,
  opts: { id: string; familyId: string }
) {
  const rows = await tx
    .select()
    .from(transaction)
    .where(
      and(
        eq(transaction.id, opts.id),
        eq(transaction.familyId, opts.familyId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Serialize transaction row for procedure response.
 * Converts signed amount to display (positive) value.
 */
export function serializeTransaction(row: {
  id: string;
  familyId: string;
  type: TransactionType;
  accountId: string;
  categoryId: string;
  amount: number;
  remark: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  accountName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
}) {
  return {
    id: row.id,
    familyId: row.familyId,
    type: row.type,
    accountId: row.accountId,
    categoryId: row.categoryId,
    amount: Math.abs(row.amount), // Q1: signed → display positive
    remark: row.remark,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    accountName: row.accountName,
    categoryName: row.categoryName,
    categoryIcon: row.categoryIcon,
  };
}
