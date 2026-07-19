import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { family } from "./family";
import { account } from "./account";
import { category } from "./category";
import { uuidv7 } from "uuidv7";

/**
 * `transactions` — transaction entity (004-transaction).
 *
 * Per Clarification Q1: `amount` is **signed bigint** (income → positive,
 * expense → negative). Frontend always sends positive amount; server applies
 * sign via `applySign(type, amount)` domain function.
 *
 * Per FR-018: account balance is NOT persisted; dashboard aggregates at
 * query time via `SUM(amount)`.
 *
 * Per FR-013: hard delete allowed (unlike 002-account which only archives).
 *
 * 4 composite indexes for list/dashboard/filter queries:
 * - (family_id, occurred_at DESC) — list by time
 * - (family_id, type) — dashboard aggregate by type
 * - (family_id, account_id) — filter by account
 * - (family_id, category_id) — filter by category
 */
export const transactionType = pgEnum("transaction_type", [
  "income",
  "expense",
  "transfer", // 027: 转账(不计入收支聚合,research R1)
]);

export const transaction = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    type: transactionType("type").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "restrict" }),
    // 027 (research R1 / data-model §1.1): transfer 时 = 转入账户;
    // income/expense 时 NULL。procedure 强不变量(type guard)。
    toAccountId: uuid("to_account_id").references(() => account.id, {
      onDelete: "restrict",
    }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    amount: bigint("amount", { mode: "number" }).notNull(), // signed: income +, expense -
    remark: text("remark").notNull().default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    // 033 US0 / R3:客户端幂等键。nullable(向后兼容老路径/老客户端);
    // 带值时 (family_id, client_request_id) 唯一 —— Background Sync retry /
    // 前台 flush 竞态导致重复提交时,procedure 返回既有 transaction 而非新建。
    clientRequestId: text("client_request_id"),
  },
  (t) => ({
    familyOccurredIdx: index("transactions_family_occurred_idx").on(
      t.familyId,
      t.occurredAt
    ),
    familyTypeIdx: index("transactions_family_type_idx").on(t.familyId, t.type),
    familyAccountIdx: index("transactions_family_account_idx").on(
      t.familyId,
      t.accountId
    ),
    familyCategoryIdx: index("transactions_family_category_idx").on(
      t.familyId,
      t.categoryId
    ),
    // 033 R3:部分唯一索引 —— 仅 clientRequestId 非 NULL 的行参与去重。
    familyClientRequestIdx: uniqueIndex(
      "transactions_family_client_request_idx"
    ).on(t.familyId, t.clientRequestId),
  })
);

export type Transaction = typeof transaction.$inferSelect;
export type TransactionType = (typeof transactionType.enumValues)[number];
