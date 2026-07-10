/**
 * T025 + integration: US4 list hierarchical (018 US4).
 *
 * Coverage of spec US4 7 acceptance scenarios:
 *   1. list (no params) → built-in + custom, hierarchical with children
 *   2. 二级分类 nests under parent.children
 *   3. type filter excludes other type
 *   4. includeArchived=true returns archived (with archivedAt)
 *   5. cross-family isolation (other family's custom not visible)
 *   6. parentId cascade mode → flat list of direct children
 *   7. 003 backward compat (built-ins present, fields superset)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { category, family, member, user } from "@/server/db/schema";
import { createCategory } from "@/server/db/queries/category";
import { buildCategoryTree } from "@/server/domain/category/rules";
import { findAllCategories } from "@/server/db/queries/category";
import { uuidv7 } from "uuidv7";

let testDb: TestDb | undefined;
let userId: string;
let famId: string;
let memId: string;
let otherUserId: string;
let otherFamId: string;
let otherMemId: string;

beforeAll(async () => {
  process.env.DATABASE_URL = "placeholder-overridden-by-startTestDb";
  testDb = await startTestDb();

  userId = uuidv7();
  famId = uuidv7();
  memId = uuidv7();
  await db.insert(user).values({
    id: userId,
    email: "test-list@example.com",
    emailVerified: false,
    name: "test-list",
    image: null,
  });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({
    id: memId,
    familyId: famId,
    userId,
    displayName: "test-list",
  });

  otherUserId = uuidv7();
  otherFamId = uuidv7();
  otherMemId = uuidv7();
  await db.insert(user).values({
    id: otherUserId,
    email: "other-list@example.com",
    emailVerified: false,
    name: "other-list",
    image: null,
  });
  await db.insert(family).values({
    id: otherFamId,
    ownerUserId: otherUserId,
    name: "我的家庭",
  });
  await db.insert(member).values({
    id: otherMemId,
    familyId: otherFamId,
    userId: otherUserId,
    displayName: "other-list",
  });
});

afterAll(async () => {
  if (testDb) await stopTestDb(testDb);
});

describe("[US4] findAllCategories hierarchical + filters", () => {
  it("1. returns built-in + custom, hierarchical with children", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "ListParent",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    await createCategory({
      type: "expense",
      name: "ListChild",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });

    const flat = await findAllCategories({ familyId: famId });
    const tree = buildCategoryTree(flat);

    // Tree contains built-in (top-level) + custom parent (top-level) +
    // custom child (nested under parent)
    const parent2 = tree.find((n) => n.id === parent.id);
    expect(parent2).toBeDefined();
    expect(parent2!.children).toHaveLength(1);
    expect(parent2!.children[0].name).toBe("ListChild");

    // Built-ins still present at top level
    const builtIns = tree.filter((n) => n.isBuiltIn);
    expect(builtIns.length).toBeGreaterThanOrEqual(20);
  });

  it("2. 二级分类 nests under parent.children (not at top level)", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "NestParent",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const child = await createCategory({
      type: "expense",
      name: "NestChild",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });

    const flat = await findAllCategories({ familyId: famId });
    const tree = buildCategoryTree(flat);

    // Child should NOT be at top level
    const childAtTop = tree.find((n) => n.id === child.id);
    expect(childAtTop).toBeUndefined();

    // Child should be nested under parent
    const parentNode = tree.find((n) => n.id === parent.id);
    expect(parentNode?.children.find((c) => c.id === child.id)).toBeDefined();
  });

  it("3. type filter excludes other type", async () => {
    await createCategory({
      type: "expense",
      name: "FilterExpense",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    await createCategory({
      type: "income",
      name: "FilterIncome",
      icon: "💰",
      familyId: famId,
      actorMemberId: memId,
    });

    const expenseOnly = await findAllCategories({
      familyId: famId,
      type: "expense",
    });
    const incomeOnly = await findAllCategories({
      familyId: famId,
      type: "income",
    });

    expect(expenseOnly.every((c) => c.type === "expense")).toBe(true);
    expect(incomeOnly.every((c) => c.type === "income")).toBe(true);
    expect(expenseOnly.find((c) => c.name === "FilterIncome")).toBeUndefined();
    expect(incomeOnly.find((c) => c.name === "FilterExpense")).toBeUndefined();
  });

  it("4. includeArchived=true returns archived categories", async () => {
    const c = await createCategory({
      type: "expense",
      name: "ToBeArchivedList",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    // Archive via DB
    await db
      .update(category)
      .set({ archivedAt: new Date() })
      .where(eq(category.id, c.id));

    // Default: excluded
    const defaultList = await findAllCategories({ familyId: famId });
    expect(defaultList.find((r) => r.id === c.id)).toBeUndefined();

    // includeArchived: included
    const withArchived = await findAllCategories({
      familyId: famId,
      includeArchived: true,
    });
    const archived = withArchived.find((r) => r.id === c.id);
    expect(archived).toBeDefined();
    expect(archived!.archivedAt).not.toBeNull();
  });

  it("5. cross-family isolation: other family's custom not visible", async () => {
    await createCategory({
      type: "expense",
      name: "FamilyAPrivate",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    await createCategory({
      type: "expense",
      name: "FamilyBPrivate",
      icon: "🐾",
      familyId: otherFamId,
      actorMemberId: otherMemId,
    });

    const aList = await findAllCategories({ familyId: famId });
    const bList = await findAllCategories({ familyId: otherFamId });

    expect(aList.find((c) => c.name === "FamilyBPrivate")).toBeUndefined();
    expect(bList.find((c) => c.name === "FamilyAPrivate")).toBeUndefined();

    // Both see built-ins
    const aBuiltIns = aList.filter((c) => c.isBuiltIn);
    const bBuiltIns = bList.filter((c) => c.isBuiltIn);
    expect(aBuiltIns.length).toBe(bBuiltIns.length);
  });

  it("6. parentId cascade mode: flat list of direct children", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "CascadeParent",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const child1 = await createCategory({
      type: "expense",
      name: "CascadeChild1",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });
    const child2 = await createCategory({
      type: "expense",
      name: "CascadeChild2",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });

    const children = await findAllCategories({
      familyId: famId,
      parentId: parent.id,
    });

    // Flat list (no nesting), only direct children
    expect(children).toHaveLength(2);
    const ids = children.map((c) => c.id).sort();
    expect(ids).toEqual([child1.id, child2.id].sort());
    // None of them have children (they're leaves)
    expect((children[0] as { children?: unknown }).children).toBeUndefined();
  });

  it("7. 003 backward compat: built-ins present with new fields", async () => {
    const flat = await findAllCategories({ familyId: famId });
    const builtIns = flat.filter((c) => c.isBuiltIn);

    // All 20 built-ins present
    expect(builtIns.length).toBe(20);

    // Each has new fields (familyId=null, parentId=null, archivedAt=null)
    for (const b of builtIns) {
      expect(b.familyId).toBeNull();
      expect(b.parentId).toBeNull();
      expect(b.archivedAt).toBeNull();
      expect(b.updatedAt).toBeDefined();
    }
  });
});

// Need eq import for archived update
import { eq } from "drizzle-orm";
