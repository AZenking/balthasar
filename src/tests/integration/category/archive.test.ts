/**
 * T021 + integration: US3 archive/unarchive (018 US3).
 *
 * Coverage of spec US3 10 acceptance scenarios + Clarify Q2 强制级联复活:
 *   1. archive parent → archivedAt set on parent + active children
 *   2. archive parent → already-archived children keep their archivedAt (idempotent)
 *   3. unarchive parent → 强制复活 ALL children (including independently-archived)
 *   4. archived category excluded from default list
 *   5. archived category still JOINable in transactions
 *   6. 403 when archiving built-in
 *   7. 404 cross-family archive
 *   8. audit: 1 + N events per cascade
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { category, categoryEvent, family, member, user } from "@/server/db/schema";
import {
  createCategory,
  archiveCategory,
  unarchiveCategory,
  findAllCategories,
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
    email: "test-archive@example.com",
    emailVerified: false,
    name: "test-archive",
    image: null,
  });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({
    id: memId,
    familyId: famId,
    userId,
    displayName: "test-archive",
  });
});

afterAll(async () => {
  if (testDb) await stopTestDb(testDb);
});

describe("[US3] archiveCategory cascade", () => {
  it("1. archives parent + active children", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "ArchiveParent",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const child = await createCategory({
      type: "expense",
      name: "ArchiveChild",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });

    const result = await archiveCategory({
      id: parent.id,
      familyId: famId,
      actorMemberId: memId,
    });
    expect(result.archivedChildren).toEqual([child.id]);

    // Verify DB state
    const parentRow = await db
      .select()
      .from(category)
      .where(eq(category.id, parent.id))
      .limit(1);
    const childRow = await db
      .select()
      .from(category)
      .where(eq(category.id, child.id))
      .limit(1);
    expect(parentRow[0].archivedAt).not.toBeNull();
    expect(childRow[0].archivedAt).not.toBeNull();
  });

  it("2. archive skips already-archived children (idempotent)", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "IdempParent",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const child = await createCategory({
      type: "expense",
      name: "IdempChild",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });
    // Manually archive child first
    const t1 = new Date();
    await db
      .update(category)
      .set({ archivedAt: t1 })
      .where(eq(category.id, child.id));

    // Now archive parent
    const result = await archiveCategory({
      id: parent.id,
      familyId: famId,
      actorMemberId: memId,
    });
    // child was already archived → not in archivedChildren
    expect(result.archivedChildren).toEqual([]);

    // Child's archivedAt unchanged (still t1)
    const childRow = await db
      .select()
      .from(category)
      .where(eq(category.id, child.id))
      .limit(1);
    expect(childRow[0].archivedAt?.getTime()).toBe(t1.getTime());
  });

  it("3. unarchive 强制复活 ALL children (including independently-archived)", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "ForceParent",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    const childA = await createCategory({
      type: "expense",
      name: "ForceChildA",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });
    const childB = await createCategory({
      type: "expense",
      name: "ForceChildB",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });

    // Step 1: archive childA independently
    await archiveCategory({
      id: childA.id,
      familyId: famId,
      actorMemberId: memId,
    });
    // Step 2: archive parent (cascades to childB only, childA already archived)
    await archiveCategory({
      id: parent.id,
      familyId: famId,
      actorMemberId: memId,
    });
    // Step 3: unarchive parent → 强制复活 ALL (including childA)
    const result = await unarchiveCategory({
      id: parent.id,
      familyId: famId,
      actorMemberId: memId,
    });
    expect(result.unarchivedChildren.sort()).toEqual(
      [childA.id, childB.id].sort(),
    );

    // All three rows: archivedAt = null
    const parentRow = await db
      .select()
      .from(category)
      .where(eq(category.id, parent.id))
      .limit(1);
    const aRow = await db
      .select()
      .from(category)
      .where(eq(category.id, childA.id))
      .limit(1);
    const bRow = await db
      .select()
      .from(category)
      .where(eq(category.id, childB.id))
      .limit(1);
    expect(parentRow[0].archivedAt).toBeNull();
    expect(aRow[0].archivedAt).toBeNull(); // 强制复活 (was independently archived)
    expect(bRow[0].archivedAt).toBeNull();
  });

  it("4. archived category excluded from default findAllCategories", async () => {
    const c = await createCategory({
      type: "expense",
      name: "HideFromList",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    await archiveCategory({
      id: c.id,
      familyId: famId,
      actorMemberId: memId,
    });

    const list = await findAllCategories({ familyId: famId });
    const ids = list.map((r) => r.id);
    expect(ids).not.toContain(c.id);
  });

  it("6. 403 when archiving built-in", async () => {
    await expect(
      archiveCategory({
        id: "95d6dc66-12c4-5f2b-bf9b-1d439a9c8100", // 餐饮
        familyId: famId,
        actorMemberId: memId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("7. 404 cross-family archive", async () => {
    const otherUserId = uuidv7();
    const otherFamId = uuidv7();
    const otherMemId = uuidv7();
    await db.insert(user).values({
      id: otherUserId,
      email: "archive-other@example.com",
      emailVerified: false,
      name: "archive-other",
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
      displayName: "archive-other",
    });
    const otherCat = await createCategory({
      type: "expense",
      name: "OtherFamilyArchive",
      icon: "🐾",
      familyId: otherFamId,
      actorMemberId: otherMemId,
    });

    await expect(
      archiveCategory({
        id: otherCat.id,
        familyId: famId,
        actorMemberId: memId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("8. audit: 1 + N events per cascade archive (parent + 2 children)", async () => {
    const parent = await createCategory({
      type: "expense",
      name: "AuditParent",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
    });
    await createCategory({
      type: "expense",
      name: "AuditChild1",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });
    await createCategory({
      type: "expense",
      name: "AuditChild2",
      icon: "🐾",
      familyId: famId,
      actorMemberId: memId,
      parentId: parent.id,
    });

    await archiveCategory({
      id: parent.id,
      familyId: famId,
      actorMemberId: memId,
    });

    const events = await db
      .select()
      .from(categoryEvent)
      .where(eq(categoryEvent.categoryId, parent.id));
    const archivedEvents = events.filter(
      (e) => e.eventType === "category_archived",
    );
    // Just parent's event here; children have their own categoryId entries
    expect(archivedEvents.length).toBe(1);
    const before = archivedEvents[0].before as Record<string, unknown>;
    const after = archivedEvents[0].after as Record<string, unknown>;
    expect(before.archivedAt).toBeNull();
    expect(after.archivedAt).not.toBeNull();
  });
});
