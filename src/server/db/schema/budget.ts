import {
  pgTable,
  uuid,
  bigint,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { family } from "./family";
import { uuidv7 } from "uuidv7";

/**
 * `budgets` — 月预算实体 (027-mobile-home-revamp US5)。
 *
 * 宪章 v3.2.0 已解锁 Budget(原则三)。`Family` 聚合内实体,按月。
 *
 * 仅月预算(clarify Q3);(familyId, year, month) 唯一。
 * amount 单位 = 分(与 transactions 一致),正数。
 *
 * data-model §1.3 / contracts/dashboard-budget.md。
 */
export const budget = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1-12
    amount: bigint("amount", { mode: "number" }).notNull(), // 分,正数
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    // (family_id, year, month) 唯一 —— 一个家庭一个月份只有一条预算
    familyYearMonthUniq: uniqueIndex("budgets_family_year_month_uniq").on(
      t.familyId,
      t.year,
      t.month,
    ),
  }),
);

export type Budget = typeof budget.$inferSelect;
export type NewBudget = typeof budget.$inferInsert;
