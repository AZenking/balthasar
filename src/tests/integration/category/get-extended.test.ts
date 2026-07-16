/**
 * T029 + integration: US5 get extended (018 US5).
 *
 * Coverage of spec US5 5 acceptance scenarios (procedure-layer behaviors):
 *   1. get 自家自定义 → 返回完整字段 (含 018 新字段)
 *   2. get 跨家庭自定义 → 404 (FR-023 不暴露存在性)
 *   3. get 不存在 ID → 404
 *   4. get 内置 → isBuiltIn=true, familyId=null (任意家庭可见)
 *   5. get 已归档 → 仍可取 (归档 ≠ 删除引用,FR-015)
 *
 * Uses createCaller to exercise the procedure layer (where the cross-family
 * 404 check lives). Existing 003 get.test.ts covers built-in happy path.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { family, member, user } from "@/server/db/schema";
import { createCategory } from "@/server/db/queries/category";
import { createCaller } from "@/lib/trpc/server";
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
    email: "test-get-ext@example.com",
    emailVerified: false,
    name: "test-get-ext",
    image: null,
  });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({
    id: memId,
    familyId: famId,
    userId,
    displayName: "test-get-ext",
  });

  otherUserId = uuidv7();
  otherFamId = uuidv7();
  otherMemId = uuidv7();
  await db.insert(user).values({
    id: otherUserId,
    email: "other-get-ext@example.com",
    emailVerified: false,
    name: "other-get-ext",
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
    displayName: "other-get-ext",
  });
});

afterAll(async () => {
  if (testDb) await stopTestDb(testDb);
});

function callerFor(userId: string) {
  return createCaller({
    session: {
      user: {
        id: userId,
        email: "test@example.com",
        emailVerified: false,
        name: "test",
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "s_test",
        userId,
        token: "tok_test",
        expiresAt: new Date(Date.now() + 86_400_000),
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  });
}

describe("[US5] category.get procedure extended", () => {
  it("1. returns full fields for own custom category", async () => {
    const c = await createCategory({
      type: "expense",
      name: "GetExtOwn",
      icon: "paw-print",
      familyId: famId,
      actorMemberId: memId,
    });

    const caller = callerFor(userId);
    const result = await caller.category.get({ id: c.id });

    expect(result).toMatchObject({
      id: c.id,
      name: "GetExtOwn",
      type: "expense",
      icon: "paw-print",
      sortOrder: 100,
      isBuiltIn: false,
      familyId: famId,
      parentId: null,
      archivedAt: null,
    });
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it("2. cross-family get → 404 (FR-023 不暴露存在性)", async () => {
    const other = await createCategory({
      type: "expense",
      name: "GetExtOther",
      icon: "paw-print",
      familyId: otherFamId,
      actorMemberId: otherMemId,
    });

    const caller = callerFor(userId); // logged in as famId user
    await expect(caller.category.get({ id: other.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("3. non-existent ID → 404", async () => {
    const caller = callerFor(userId);
    await expect(
      caller.category.get({ id: "00000000-0000-5000-8000-000000000000" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("4. built-in visible to any family (isBuiltIn=true, familyId=null)", async () => {
    const builtinId = "95d6dc66-12c4-5f2b-bf9b-1d439a9c8100"; // 餐饮
    const caller = callerFor(userId);
    const result = await caller.category.get({ id: builtinId });

    expect(result.isBuiltIn).toBe(true);
    expect(result.familyId).toBeNull();
    expect(result.name).toBe("餐饮");
  });

  it("5. archived custom category still retrievable (归档 ≠ 删除引用)", async () => {
    const c = await createCategory({
      type: "expense",
      name: "GetExtArchived",
      icon: "paw-print",
      familyId: famId,
      actorMemberId: memId,
    });
    // Manually archive via DB
    const { getPool } = await import("@/server/db/client");
    await getPool().query(
      "UPDATE categories SET archived_at = now() WHERE id = $1",
      [c.id],
    );

    const caller = callerFor(userId);
    const result = await caller.category.get({ id: c.id });
    expect(result.archivedAt).not.toBeNull();
    expect(result.name).toBe("GetExtArchived");
  });
});
