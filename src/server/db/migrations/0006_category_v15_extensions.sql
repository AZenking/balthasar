-- 0006_category_v15_extensions.sql
--
-- Migration for 018-custom-category feature (V1.5 schema extension).
-- Per data-model.md + research.md (018 plan):
--
--   1. ALTER TABLE categories ADD COLUMN × 4 (family_id / parent_id /
--      archived_at / updated_at) + self-reference FK on parent_id.
--   2. New index categories_family_type_parent_sort_idx for hierarchical
--      list queries (filter by family+type+parent, sorted).
--   3. New UNIQUE expression index categories_family_type_parent_name_unique_idx
--      enforcing family-scoped name uniqueness with case-insensitive
--      matching (LOWER) and NULL handling (COALESCE → sentinel UUID).
--   4. New audit table category_events (mirrors transaction_events pattern).
--   5. Backfill: existing 22 built-in rows get family_id/parent_id/
--      archived_at = NULL (default) and updated_at = created_at.
--
-- Run via `pnpm db:migrate` (drizzle-kit migrate). Idempotent: wraps all
-- DDL in IF NOT EXISTS / re-runnable ALTERs.
--
-- Backward compat with 003: existing 22 built-in rows keep their id/name/
-- type/icon/sort_order/is_built_in/created_at unchanged. New fields are
-- nullable / defaulted, so 003's `category.list` / `category.get` queries
-- continue to work with extra fields returned transparently.

-- ─── 1. ALTER categories ──────────────────────────────────────────────

-- Add 4 new columns. All nullable / defaulted so 003 INSERTs keep working
-- without specifying them.
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "family_id" uuid,
  ADD COLUMN IF NOT EXISTS "parent_id" uuid,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

-- family_id FK → families (ON DELETE RESTRICT; deleting a family with
-- custom categories must fail loudly — no cascade).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_family_id_families_fk'
  ) THEN
    ALTER TABLE "categories"
      ADD CONSTRAINT "categories_family_id_families_fk"
      FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT;
  END IF;
END $$;

-- parent_id self-reference FK (ON DELETE RESTRICT; never delete a parent
-- with children — archive instead, per FR-019).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_id_fkey'
  ) THEN
    ALTER TABLE "categories"
      ADD CONSTRAINT "categories_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT;
  END IF;
END $$;

-- ─── 2. 层级 list 主索引 ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "categories_family_type_parent_sort_idx"
  ON "categories" ("family_id", "type", "parent_id", "sort_order", "created_at");

-- ─── 3. family-scoped 唯一性 (COALESCE + LOWER 表达式) ───────────────

-- COALESCE NULL→sentinel: PostgreSQL treats NULL as distinct in UNIQUE
-- indexes (multiple NULLs allowed). We want NULL family_id (built-in) to
-- be treated as a single value so two built-in categories with same name
-- +type+parent_id conflict. Same for parent_id.
--
-- LOWER(name): case-insensitive comparison per Clarifications (spec
-- Edge Case "自定义分类名重复": case-insensitive + trim on app side).

CREATE UNIQUE INDEX IF NOT EXISTS "categories_family_type_parent_name_unique_idx"
  ON "categories" (
    COALESCE("family_id", '00000000-0000-0000-0000-000000000000'::uuid),
    "type",
    COALESCE("parent_id", '00000000-0000-0000-0000-000000000000'::uuid),
    LOWER("name")
  );

-- ─── 4. category_events 审计表 ─────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'category_event_type'
  ) THEN
    CREATE TYPE "category_event_type" AS ENUM(
      'category_created',
      'category_edited',
      'category_archived',
      'category_unarchived'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "category_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "event_type" "category_event_type" NOT NULL,
  "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
  "actor_member_id" uuid NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "before" jsonb,
  "after" jsonb,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "category_events_cat_time_idx"
  ON "category_events" ("category_id", "occurred_at");

-- ─── 5. 003 内置分类回填 ────────────────────────────────────────────

-- family_id/parent_id/archived_at default to NULL — no explicit UPDATE
-- needed for those. But updated_at has DEFAULT now() which would set
-- it to migration timestamp. Per spec assumption, built-in categories
-- should have updated_at = created_at (they were "last updated" when
-- first seeded). Backfill:
UPDATE "categories"
SET "updated_at" = "created_at"
WHERE "is_built_in" = true AND "family_id" IS NULL;

-- ─── 6. 验证 ────────────────────────────────────────────────────────

-- Sanity: 003 22 built-in should still be there with new fields NULL.
-- Run manually to verify:
--   SELECT id, name, type, icon, sort_order, is_built_in,
--          family_id, parent_id, archived_at, updated_at, created_at
--   FROM categories WHERE is_built_in = true ORDER BY sort_order, name;
-- Expect: 22 rows, all family_id/parent_id/archived_at NULL,
--         updated_at = created_at.
