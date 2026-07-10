/**
 * T011: Integration test for 018 migration backward compatibility.
 *
 * Verifies that migration 0006_category_v15_extensions applies cleanly
 * and 003 built-in categories are preserved unchanged (Constitution v2.0.0
 * Principle IV — Test-First with real Postgres).
 *
 * Coverage:
 *   - 003 20 built-in categories exist (12 expense + 8 income)
 *   - All built-ins have family_id IS NULL / parent_id IS NULL /
 *     archived_at IS NULL / is_built_in = true (FR-028 backward compat)
 *   - updated_at = created_at for all built-ins (research.md D9 backfill)
 *   - 2 new indexes exist on categories (sort + unique expression)
 *   - category_events table exists with expected columns + indexes
 *   - category_event_type enum has 4 values
 *   - parentId self-ref FK exists with ON DELETE RESTRICT
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db, getPool } from "@/server/db/client";
import { category, categoryEvent } from "@/server/db/schema";
import { count, eq } from "drizzle-orm";

let testDb: TestDb | undefined;

beforeAll(async () => {
  process.env.DATABASE_URL = "placeholder-overridden-by-startTestDb";
  testDb = await startTestDb();
});

afterAll(async () => {
  if (testDb) await stopTestDb(testDb);
});

describe("018 migration 0006: backward compat with 003", () => {
  it("preserves all 003 built-in categories (20 = 12 expense + 8 income)", async () => {
    const rows = await db.select().from(category);
    expect(rows.length).toBeGreaterThanOrEqual(20);

    const expense = rows.filter((r) => r.type === "expense" && r.isBuiltIn);
    const income = rows.filter((r) => r.type === "income" && r.isBuiltIn);
    expect(expense.length).toBe(12);
    expect(income.length).toBe(8);
  });

  it("all built-ins have family_id IS NULL (FR-007, FR-028)", async () => {
    const rows = await db
      .select()
      .from(category)
      .where(eq(category.isBuiltIn, true));
    for (const r of rows) {
      expect(r.familyId).toBeNull();
    }
  });

  it("all built-ins have parent_id IS NULL", async () => {
    const rows = await db
      .select()
      .from(category)
      .where(eq(category.isBuiltIn, true));
    for (const r of rows) {
      expect(r.parentId).toBeNull();
    }
  });

  it("all built-ins have archived_at IS NULL (内置不可归档)", async () => {
    const rows = await db
      .select()
      .from(category)
      .where(eq(category.isBuiltIn, true));
    for (const r of rows) {
      expect(r.archivedAt).toBeNull();
    }
  });

  it("all built-ins have updated_at = created_at (research.md D9 backfill)", async () => {
    const rows = await db
      .select({
        id: category.id,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        isBuiltIn: category.isBuiltIn,
      })
      .from(category)
      .where(eq(category.isBuiltIn, true));
    for (const r of rows) {
      expect(r.updatedAt.getTime()).toBe(r.createdAt.getTime());
    }
  });

  it("built-in fields (id/name/type/icon/sortOrder) are byte-identical to 003 seed", async () => {
    // Spot-check 3 known built-ins by stable v5 ID (003 seed).
    const 餐饮 = await db
      .select()
      .from(category)
      .where(eq(category.id, "95d6dc66-12c4-5f2b-bf9b-1d439a9c8100"));
    expect(餐饮).toHaveLength(1);
    expect(餐饮[0]).toMatchObject({
      name: "餐饮",
      type: "expense",
      icon: "🍔",
      sortOrder: 100,
      isBuiltIn: true,
    });

    const 交通 = await db
      .select()
      .from(category)
      .where(eq(category.id, "6f7a88e1-fb21-5409-b6b3-606787668c02"));
    expect(交通[0]).toMatchObject({
      name: "交通",
      type: "expense",
      icon: "🚗",
      sortOrder: 200,
    });

    const 工资 = await db
      .select()
      .from(category)
      .where(eq(category.id, "5c7b17d7-a3ec-59c0-b2ad-4a62ad32f2c3"));
    expect(工资[0]).toMatchObject({
      name: "工资",
      type: "income",
      icon: "💰",
      sortOrder: 100,
    });
  });

  it("exposes 2 new indexes on categories (sort + unique expression)", async () => {
    const pool = getPool();
    const result = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'categories'
      ORDER BY indexname
    `);
    const names = result.rows.map((r: { indexname: string }) => r.indexname);
    expect(names).toContain("categories_family_type_parent_sort_idx");
    expect(names).toContain("categories_family_type_parent_name_unique_idx");
    expect(names).toContain("categories_type_sort_name_idx");
    expect(names).toContain("categories_name_type_unique_idx");
  });

  it("creates category_events table with expected schema", async () => {
    const pool = getPool();
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'category_events'
      ORDER BY ordinal_position
    `);
    const cols = result.rows as {
      column_name: string;
      data_type: string;
      is_nullable: string;
    }[];
    const colMap = new Map(cols.map((c) => [c.column_name, c]));

    expect(colMap.get("id")?.data_type).toBe("uuid");
    expect(colMap.get("id")?.is_nullable).toBe("NO");
    expect(colMap.get("event_type")?.data_type).toBe("USER-DEFINED");
    expect(colMap.get("category_id")?.data_type).toBe("uuid");
    expect(colMap.get("category_id")?.is_nullable).toBe("YES");
    expect(colMap.get("actor_member_id")?.data_type).toBe("uuid");
    expect(colMap.get("actor_member_id")?.is_nullable).toBe("NO");
    expect(colMap.get("before")?.data_type).toBe("jsonb");
    expect(colMap.get("before")?.is_nullable).toBe("YES");
    expect(colMap.get("after")?.data_type).toBe("jsonb");
    expect(colMap.get("after")?.is_nullable).toBe("YES");
    expect(colMap.get("occurred_at")?.data_type).toMatch(/timestamp/);
    expect(colMap.get("occurred_at")?.is_nullable).toBe("NO");
  });

  it("category_event_type enum has 4 values", async () => {
    const pool = getPool();
    const result = await pool.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'category_event_type')
      ORDER BY enumsortorder
    `);
    const labels = result.rows.map((r: { enumlabel: string }) => r.enumlabel);
    expect(labels).toEqual([
      "category_created",
      "category_edited",
      "category_archived",
      "category_unarchived",
    ]);
  });

  it("category_events is queryable and initially empty", async () => {
    const rows = await db.select({ c: count() }).from(categoryEvent);
    expect(rows.length).toBe(1);
    expect(Number(rows[0]?.c ?? 0)).toBe(0);
  });

  it("parentId self-reference FK exists with ON DELETE RESTRICT", async () => {
    const pool = getPool();
    const result = await pool.query(`
      SELECT conname, confdeltype FROM pg_constraint
      WHERE conname = 'categories_parent_id_fkey'
    `);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as { conname: string; confdeltype: string };
    expect(row.conname).toBe("categories_parent_id_fkey");
    expect(row.confdeltype).toBe("r"); // 'r' = RESTRICT
  });
});
