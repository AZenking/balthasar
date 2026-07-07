import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  pgEnum,
  index,
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
export const transactionType = pgEnum("transaction_type", ["income", "expense"]);

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
  })
);

export type Transaction = typeof transaction.$inferSelect;
export type TransactionType = (typeof transactionType.enumValues)[number];
