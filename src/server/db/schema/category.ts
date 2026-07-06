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

/**
 * `categories` — built-in category dictionary (003-category).
 *
 * Per data-model.md + research.md:
 * - Q2: `id` is UUID v5 (deterministic from name+type in DNS namespace) — set by seed SQL
 * - Q4: `type` uses pgEnum (DB-level enum enforcement)
 * - Q5: index `(type, sort_order, name)` for list query (sorted output via index scan)
 * - Q6: NO family_id field — shared global dictionary, all families see same data
 *
 * MVP invariant: 22 built-in categories (12 expense + 8 income) seeded via migration.
 * V2 will add user-defined categories (with family_id NULL = built-in, non-NULL = custom).
 */
export const categoryType = pgEnum("category_type", ["income", "expense"]);

export const category = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    type: categoryType("type").notNull(),
    icon: text("icon").notNull(),
    sortOrder: integer("sort_order").notNull().default(100),
    isBuiltIn: boolean("is_built_in").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Composite index for list query: WHERE type = $ + ORDER BY sort_order, name
    // Postgres can use this single index for both filter and sort.
    typeSortNameIdx: index("categories_type_sort_name_idx").on(
      t.type,
      t.sortOrder,
      t.name
    ),
    // Uniqueness guard for idempotent seed (INSERT ... ON CONFLICT DO NOTHING by id)
    nameTypeUniqueIdx: uniqueIndex("categories_name_type_unique_idx").on(
      t.name,
      t.type
    ),
  })
);

export type Category = typeof category.$inferSelect;
export type CategoryType = (typeof categoryType.enumValues)[number];
