-- 0003_categories.sql
--
-- Migration for 003-category feature.
-- Creates categories table + 22 seed INSERTs (12 expense + 8 income).
--
-- IDs are UUID v5 (deterministic from "type:name" in DNS namespace), generated
-- by scripts/generate-category-seed.mjs. Run regen script if seed data changes.
--
-- Run via `pnpm db:migrate` (drizzle-kit migrate). Idempotent due to
-- ON CONFLICT (id) DO NOTHING on every INSERT.

CREATE TYPE "category_type" AS ENUM('income', 'expense');

CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "type" "category_type" NOT NULL,
  "icon" text NOT NULL,
  "sort_order" integer DEFAULT 100 NOT NULL,
  "is_built_in" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "categories_type_sort_name_idx"
  ON "categories" ("type", "sort_order", "name");

CREATE UNIQUE INDEX "categories_name_type_unique_idx"
  ON "categories" ("name", "type");

-- Seed: 12 expense categories
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('95d6dc66-12c4-5f2b-bf9b-1d439a9c8100', '餐饮', 'expense', 'utensils', 100, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('6f7a88e1-fb21-5409-b6b3-606787668c02', '交通', 'expense', 'car', 200, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('3feb7580-9bad-5c6a-bf4f-db9e59eb3e64', '购物', 'expense', 'shopping-bag', 300, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('7913daff-f5fc-5ce2-98a0-85c5f0c53db9', '住房', 'expense', 'house', 400, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('f974464e-1512-5b64-9bb9-bc322c3170b3', '水电煤', 'expense', 'lightbulb', 500, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('656b4d2c-887e-5757-a2ce-1feb0684fb7a', '通讯', 'expense', 'smartphone', 600, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('f0683ffe-fe9c-593f-8701-4ec1c296b32c', '医疗', 'expense', 'pill', 700, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('805a7628-6497-5252-b4ab-a76361e5aa0a', '娱乐', 'expense', 'gamepad-2', 800, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('b41989ae-e78a-59f2-9c02-4f904d8e6841', '教育', 'expense', 'book-open', 900, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('6d6ada2a-52b5-5fda-9ccf-af89a21a7682', '服饰', 'expense', 'shirt', 1000, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('7e0c4d7e-15e9-5cbf-a3c9-059d14a86383', '人情', 'expense', 'gift', 1100, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('f24916fd-6c9a-5ecd-afa5-09c1bcc5590a', '其他支出', 'expense', 'circle-dollar-sign', 1200, true) ON CONFLICT (id) DO NOTHING;

-- Seed: 8 income categories
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('5c7b17d7-a3ec-59c0-b2ad-4a62ad32f2c3', '工资', 'income', 'wallet', 100, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('a163e39c-8eb4-5317-8ef9-7c433897b569', '奖金', 'income', 'party-popper', 200, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('3d604df6-dbd9-5c33-8a1e-40f0885e0d2c', '理财收益', 'income', 'trending-up', 300, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('b723b10f-6791-5c4a-9403-b07fd88f7569', '兼职', 'income', 'briefcase', 400, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('dd39543f-1fd5-58d7-9aa6-122b19cefc4a', '报销', 'income', 'receipt-text', 500, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('a7b6b004-de00-5025-8eaa-750c4c0ac6af', '红包', 'income', 'hand-coins', 600, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('a9ba0bcb-6dcd-5515-b37b-69736464563f', '退款', 'income', 'undo-2', 700, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('60549cc0-9b4b-584c-8891-9705c0416247', '其他收入', 'income', 'banknote', 800, true) ON CONFLICT (id) DO NOTHING;
