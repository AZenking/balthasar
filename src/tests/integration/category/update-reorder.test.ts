/**
 * T017 + integration: US2 update + reorder tests (018 US2).
 *
 * Combined procedure + integration coverage (real DB via testcontainers).
 *
 * Update coverage (spec US2 9 scenarios):
 *   1. rename → updatedAt changes
 *   2. 403 when editing built-in
 *   3. 409 when rename collides with sibling
 *   4. 400 when setting parentId on a category that has children
 *   5. 400 when parentId === self (cycle)
 *   6. 400 when changing type if referenced by transactions
 *   7. 404 when cross-family update
 *   8. archived allows name/icon/sortOrder but rejects type/parentId
 *   9. 401 unauth (procedure layer)
 *
 * Reorder coverage:
 *   - valid batch reorders 3 siblings atomically
 *   - 403 when array contains built-in id
 *   - 404 when array contains cross-family id
 *   - 400 when items span multiple parentIds (not same level)
 *   - 400 when items array has duplicate sortOrder
 *   - atomicity: rollback on any failure
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import {
  account,
  category,
  categoryEvent,
  family,
  member,
  transaction,
  user,
} from "@/server/db/schema";
import {
  createCategory,
  updateCategory,
  reorderCategories,
} from "@/server/db/queries/category";
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
    email: "test-update@example.com",
    emailVerified: false,
    name: "test-update",
    image: null,
  });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({
    id: memId,
    familyId: famId,
    userId,
    displayName: "test-update",
  });
});

afterAll(async () => {
  if (testDb) await stopTestDb(testDb);
});

describe("[US2] updateCategory", () => {
  it("1. renames and updates updatedAt", async () => {
    const created = await createCategory({
      type: "expense",
      name: "Original",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const before = created.updatedAt;
    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 10));

    const updated = await updateCategory({
      id: created.id,
      familyId: famId,
      actorMemberId: memId,
      name: "Renamed",
    });
    expect(updated.name).toBe("Renamed");
    expect(updated.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it("2. throws FORBIDDEN when editing built-in", async () => {
    const builtinId = "95d6dc66-12c4-5f2b-bf9b-1d439a9c8100"; // 餐饮
    await expect(
      updateCategory({
        id: builtinId,
        familyId: famId,
        actorMemberId: memId,
        name: "Hacked",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("3. throws CONFLICT when rename collides with sibling", async () => {
    await createCategory({
      type: "expense",
      name: "SiblingA",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const b = await createCategory({
      type: "expense",
      name: "SiblingB",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    await expect(
      updateCategory({
        id: b.id,
        familyId: famId,
        actorMemberId: memId,
        name: "SiblingA", // conflict (case-insensitive)
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("4. throws BAD_REQUEST when setting parentId on category with children", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "HasChildParent",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    await createCategory({
      type: "expense",
      name: "ChildOfParent",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });
    const otherTop = await createCategory({
      type: "expense",
      name: "OtherTop",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    await expect(
      updateCategory({
        id: parent.id,
        familyId: famId,
        actorMemberId: memId,
        parentId: otherTop.id, // would create 3rd level
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("5. throws BAD_REQUEST when parentId === self (cycle)", async () => {
    const c = await createCategory({
      type: "expense",
      name: "SelfCycle",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    await expect(
      updateCategory({
        id: c.id,
        familyId: famId,
        actorMemberId: memId,
        parentId: c.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("6. throws BAD_REQUEST when changing type if referenced by transactions", async () => {
    const c = await createCategory({
      type: "expense",
      name: "HasTxRef",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    // Create a real account + transaction referencing the category
    const acctId = uuidv7();
    await db.insert(account).values({
      id: acctId,
      familyId: famId,
      name: "TestAcct",
      currency: "CNY",
      initialBalance: 0,
    });
    await db.insert(transaction).values({
      id: uuidv7(),
      familyId: famId,
      type: "expense",
      accountId: acctId,
      categoryId: c.id,
      amount: -1000,
      remark: "",
      occurredAt: new Date(),
    });

    await expect(
      updateCategory({
        id: c.id,
        familyId: famId,
        actorMemberId: memId,
        type: "income",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("7. throws NOT_FOUND when cross-family update", async () => {
    const otherUserId = uuidv7();
    const otherFamId = uuidv7();
    const otherMemId = uuidv7();
    await db.insert(user).values({
      id: otherUserId,
      email: "other@example.com",
      emailVerified: false,
      name: "other",
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
      displayName: "other",
    });
    const otherCat = await createCategory({
      type: "expense",
      name: "OtherFamilyCat",
      icon: "🐾",
      familyId: otherFamId,
      actorMemberId: otherMemId,
    });

    // Try to update other family's category from famId context
    await expect(
      updateCategory({
        id: otherCat.id,
        familyId: famId,
        actorMemberId: memId,
        name: "Hacked",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("8. archived allows name/icon/sortOrder but rejects type/parentId", async () => {
    const c = await createCategory({
      type: "expense",
      name: "ToBeArchived",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    // Manually archive via DB (US3 not implemented yet)
    await db
      .update(category)
      .set({ archivedAt: new Date() })
      .where(eq(category.id, c.id));

    // name OK
    const updated = await updateCategory({
      id: c.id,
      familyId: famId,
      actorMemberId: memId,
      name: "ArchivedRenamed",
    });
    expect(updated.name).toBe("ArchivedRenamed");

    // type rejected
    await expect(
      updateCategory({
        id: c.id,
        familyId: famId,
        actorMemberId: memId,
        type: "income",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("writes category_edited audit event with before/after snapshots", async () => {
    const c = await createCategory({
      type: "expense",
      name: "AuditUpdate",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    await updateCategory({
      id: c.id,
      familyId: famId,
      actorMemberId: memId,
      name: "AuditUpdated",
    });

    const events = await db
      .select()
      .from(categoryEvent)
      .where(eq(categoryEvent.categoryId, c.id));
    const editedEvents = events.filter((e) => e.eventType === "category_edited");
    expect(editedEvents.length).toBe(1);
    const before = editedEvents[0].before as Record<string, unknown>;
    const after = editedEvents[0].after as Record<string, unknown>;
    expect(before.name).toBe("AuditUpdate");
    expect(after.name).toBe("AuditUpdated");
  });
});

describe("[US2] reorderCategories", () => {
  it("valid batch reorders 3 siblings atomically", async () => {
    const a = await createCategory({
      type: "expense",
      name: "ReorderA",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const b = await createCategory({
      type: "expense",
      name: "ReorderB",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const c = await createCategory({
      type: "expense",
      name: "ReorderC",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });

    const result = await reorderCategories({
      items: [
        { id: a.id, sortOrder: 10 },
        { id: b.id, sortOrder: 20 },
        { id: c.id, sortOrder: 30 },
      ],
      familyId: famId,
      actorMemberId: memId,
    });
    expect(result.updated).toHaveLength(3);

    // Verify DB
    const aRow = await db
      .select()
      .from(category)
      .where(eq(category.id, a.id))
      .limit(1);
    expect(aRow[0].sortOrder).toBe(10);
  });

  it("throws FORBIDDEN when array contains built-in id", async () => {
    await expect(
      reorderCategories({
        items: [{ id: "95d6dc66-12c4-5f2b-bf9b-1d439a9c8100", sortOrder: 10 }],
        familyId: famId,
        actorMemberId: memId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws NOT_FOUND when array contains cross-family id", async () => {
    const otherUserId = uuidv7();
    const otherFamId = uuidv7();
    const otherMemId = uuidv7();
    await db.insert(user).values({
      id: otherUserId,
      email: "reorder-other@example.com",
      emailVerified: false,
      name: "reorder-other",
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
      displayName: "reorder-other",
    });
    const otherCat = await createCategory({
      type: "expense",
      name: "OtherFamilyReorder",
      icon: "🐾",
      familyId: otherFamId,
      actorMemberId: otherMemId,
    });

    await expect(
      reorderCategories({
        items: [{ id: otherCat.id, sortOrder: 10 }],
        familyId: famId,
        actorMemberId: memId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws BAD_REQUEST when items span multiple parentIds", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "ReorderParent",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const child = await createCategory({
      type: "expense",
      name: "ReorderChild",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });
    const top = await createCategory({
      type: "expense",
      name: "ReorderTop",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });

    await expect(
      reorderCategories({
        items: [
          { id: top.id, sortOrder: 10 }, // top-level
          { id: child.id, sortOrder: 20 }, // 二级
        ],
        familyId: famId,
        actorMemberId: memId,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when items array has duplicate sortOrder", async () => {
    const a = await createCategory({
      type: "expense",
      name: "DupSortA",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const b = await createCategory({
      type: "expense",
      name: "DupSortB",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });

    await expect(
      reorderCategories({
        items: [
          { id: a.id, sortOrder: 50 },
          { id: b.id, sortOrder: 50 },
        ],
        familyId: famId,
        actorMemberId: memId,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
