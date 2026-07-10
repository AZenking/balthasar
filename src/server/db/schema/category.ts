import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { family } from "./family";

/**
 * `categories` — built-in dictionary (003) + custom categories (018).
 *
 * Per data-model.md (018):
 * - Q2: `id` is UUID v5 for built-in (deterministic from name+type), UUID v7 for custom.
 * - Q4: `type` uses pgEnum (DB-level enum enforcement).
 * - 018 extension: add familyId (NULL=built-in, family- scoped custom),
 *   parentId (NULL=顶级, self-ref for 二级), archivedAt (NULL=active),
 *   updatedAt.
 *
 * Indexes:
 * - categories_type_sort_name_idx (003, kept): list by type, sorted
 * - categories_name_type_unique_idx (003, kept): idempotent seed
 * - categories_family_type_parent_sort_idx (018 NEW): hierarchical list
 * - categories_family_type_parent_name_unique_idx (018 NEW): family-scoped
 *   unique name, case-insensitive, NULL→sentinel (via COALESCE+LOWER expr)
 *
 * parentId self-reference FK is added in migration 0006 (Drizzle self-ref
 * is awkward; SQL ALTER TABLE is cleaner per data-model.md).
 *
 * Invariants (enforced at procedure layer, not DB):
 * - isBuiltIn=true → MUST NOT be written (403)
 * - custom (isBuiltIn=false) → family_id MUST NOT be null (procedure)
 * - depth ≤ 2 (parentId chain length)
 * - child.type === parent.type
 */
export const categoryType = pgEnum("category_type", ["income", "expense"]);

export const category = pgTable(
  "categories",
  {
    // ─── 003 既有字段 (向后兼容) ───
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    type: categoryType("type").notNull(),
    icon: text("icon").notNull(),
    sortOrder: integer("sort_order").notNull().default(100),
    isBuiltIn: boolean("is_built_in").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // ─── 018 新增字段 ───
    familyId: uuid("family_id").references(() => family.id, {
      onDelete: "restrict",
    }),
    parentId: uuid("parent_id"), // self-ref FK added in migration SQL
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    // 003 既有索引 (保留, 003 list 仍用)
    typeSortNameIdx: index("categories_type_sort_name_idx").on(
      t.type,
      t.sortOrder,
      t.name,
    ),
    nameTypeUniqueIdx: uniqueIndex("categories_name_type_unique_idx").on(
      t.name,
      t.type,
    ),

    // 018 新增: 层级 list 主索引
    familyTypeParentSortIdx: index(
      "categories_family_type_parent_sort_idx",
    ).on(t.familyId, t.type, t.parentId, t.sortOrder, t.createdAt),

    // 018 新增: family-scoped 唯一性 (COALESCE NULL→sentinel + LOWER case-insensitive)
    familyTypeParentNameUniqueIdx: uniqueIndex(
      "categories_family_type_parent_name_unique_idx",
    ).on(
      sql`COALESCE(${t.familyId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      t.type,
      sql`COALESCE(${t.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`LOWER(${t.name})`,
    ),
  }),
);

export type Category = typeof category.$inferSelect;
export type CategoryType = (typeof categoryType.enumValues)[number];
