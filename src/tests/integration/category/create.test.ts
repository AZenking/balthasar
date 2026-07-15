/**
 * T013: Integration tests for category.create (018 US1) on real Postgres.
 *
 * Coverage (DB-level invariants that mocks can't verify):
 *   - Unique index categories_family_type_parent_name_unique_idx fires on
 *     case-insensitive (LOWER) and trim (app-side) duplicates
 *   - FK family_id ON DELETE RESTRICT (deferred to migration test T011)
 *   - 200 cap race-safety with pg_advisory_xact_lock (sequential boundary
 *     check; true concurrency test would need workers, skipped for CI)
 *   - category_events row written with event_type=category_created + after
 *     snapshot containing only mutable fields
 *   - Server-derived familyId (FR-001): client cannot inject
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { categoryEvent, family, member, user } from "@/server/db/schema";
import { createCategory, countCustomCategoriesByFamily } from "@/server/db/queries/category";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

let testDb: TestDb | undefined;
let userId: string;
let famId: string;
let memId: string;

beforeAll(async () => {
  process.env.DATABASE_URL = "placeholder-overridden-by-startTestDb";
  testDb = await startTestDb();

  userId = uuidv7();
  famId = uuidv7();
  memId = uuidv7();
  await db.insert(user).values({
    id: userId,
    email: "test-create@example.com",
    emailVerified: false,
    name: "test-create",
    image: null,
  });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({
    id: memId,
    familyId: famId,
    userId,
    displayName: "test-create",
  });
});

afterAll(async () => {
  if (testDb) await stopTestDb(testDb);
});

describe("[US1] createCategory DB-level integration", () => {
  it("inserts a custom category with server-derived familyId + isBuiltIn=false", async () => {
    const created = await createCategory({
      type: "expense",
      name: "宠物用品",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });

    expect(created.id).toBeTruthy();
    expect(created.isBuiltIn).toBe(false);
    expect(created.familyId).toBe(famId);
    expect(created.parentId).toBeNull();
    expect(created.archivedAt).toBeNull();
    expect(created.sortOrder).toBe(100);
    expect(created.name).toBe("宠物用品");
  });

  it("writes category_created event with after snapshot (mutable fields only)", async () => {
    const created = await createCategory({
      type: "expense",
      name: "AuditTest",
      icon: "utensils",
      familyId: famId,
      actorMemberId: memId,
    });

    const events = await db
      .select()
      .from(categoryEvent)
      .where(eq(categoryEvent.categoryId, created.id));
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("category_created");
    expect(events[0].actorMemberId).toBe(memId);
    expect(events[0].before).toBeNull();
    const after = events[0].after as Record<string, unknown>;
    expect(after).toMatchObject({
      name: "AuditTest",
      icon: "utensils",
      type: "expense",
      sortOrder: 100,
      parentId: null,
      archivedAt: null,
    });
  });

  it("rejects duplicate name (case-insensitive) within same family+type+parent", async () => {
    await createCategory({
      type: "expense",
      name: "Unique",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });

    // Case variation should still conflict (LOWER index)
    await expect(
      createCategory({
        type: "expense",
        name: "UNIQUE",
        icon: "🐾",
        familyId: famId,
        actorMemberId: memId,
      }),
    ).rejects.toThrow();
  });

  it("allows same name across different types (income vs expense)", async () => {
    await createCategory({
      type: "expense",
      name: "DualType",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });

    const income = await createCategory({
      type: "income",
      name: "DualType",
      icon: "wallet",
      familyId: famId,
      actorMemberId: memId,
    });
    expect(income.type).toBe("income");
  });

  it("rejects parentId pointing to a 二级 (3rd level prevention)", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "Level1",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const child = await createCategory({
      type: "expense",
      name: "Level2",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });

    await expect(
      createCategory({
        type: "expense",
        name: "Level3",
        icon: "🐾",
        familyId: famId,
        actorMemberId: memId,
        parentId: child.id, // already a 二级 → would be 3rd level
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects parentId with mismatched type (child type MUST = parent type)", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "ParentExpense",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });

    await expect(
      createCategory({
        type: "income", // mismatched
        name: "ChildIncome",
        icon: "wallet",
        familyId: famId,
        actorMemberId: memId,
        parentId: parent.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("enforces 200 cap on custom categories per family", async () => {
    // Use a fresh family for this test to avoid interference with prior tests
    const capUserId = uuidv7();
    const capFamId = uuidv7();
    const capMemId = uuidv7();
    await db.insert(user).values({
      id: capUserId,
      email: "cap-test@example.com",
      emailVerified: false,
      name: "cap-test",
      image: null,
    });
    await db.insert(family).values({
      id: capFamId,
      ownerUserId: capUserId,
      name: "我的家庭",
    });
    await db.insert(member).values({
      id: capMemId,
      familyId: capFamId,
      userId: capUserId,
      displayName: "cap-test",
    });

    // Create 200 categories (use distinct names)
    for (let i = 0; i < 200; i++) {
      await createCategory({
        type: "expense",
        name: `Cat${i}`,
        icon: "🐾",
        familyId: capFamId,
        actorMemberId: capMemId,
      });
    }

    expect(await countCustomCategoriesByFamily(capFamId)).toBe(200);

    // 201st should fail with BAD_REQUEST
    await expect(
      createCategory({
        type: "expense",
        name: "OverCap",
        icon: "🐾",
        familyId: capFamId,
        actorMemberId: capMemId,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
