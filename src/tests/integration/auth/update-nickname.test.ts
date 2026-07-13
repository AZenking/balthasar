/**
 * 026 Switch PR Phase 2: auth.updateNickname integration tests (real Postgres).
 *
 * Spec ref: specs/026-cream-amber-revamp/contracts/auth-update-nickname.md
 *
 * Per Constitution v2.0.0 Principle IV: real DB via testcontainers, no mocks.
 *
 * Coverage (9 scenarios from contracts "Test Scenarios"):
 *   1. 正常更新:trim 后存值 + 返回 { id, displayName } 子集
 *   2. 空字符串 → BAD_REQUEST '昵称不能为空'
 *   3. 纯空白 → trim 后空 → BAD_REQUEST
 *   4. 超长 (>30) → BAD_REQUEST '昵称不超过 30 字符'
 *   5. 边界长度 30 → 成功
 *   6. 跨 member 隔离:User A 更新只影响 A 自己的 member
 *   7. 跨 family 隔离:同家庭 A 不能更新 B 的昵称
 *   8. 中文 / emoji → 成功
 *   9. DB 持久化:UPDATE 后 rows.display_name 已写入
 *
 * 性能:p95 < 300ms(宪章五 mutation 预算)。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { family, member, user } from "@/server/db/schema";
import { createCaller } from "@/lib/trpc/server";
import { newId } from "@/lib/uuid";

let testDb: TestDb | undefined;

beforeAll(async () => {
  process.env.DATABASE_URL = "placeholder-overridden-below";
  testDb = await startTestDb();
});

afterAll(async () => {
  if (testDb) await stopTestDb(testDb);
});

/**
 * Seed a user + family + member (one user ⇄ one member per SC-005).
 * Returns the userId — the caller() helper resolves member via session.user.id.
 */
async function seedUser(email: string, displayName?: string) {
  // Use full uuidv7 for userId — Better-Auth's `user.id` is text, and
  // `slice(0,12)` keeps only the timestamp prefix, colliding within 1ms.
  const userId = `u-${newId()}`;
  const famId = newId();
  const memId = newId();
  await db.insert(user).values({
    id: userId,
    email,
    emailVerified: false,
    name: email,
    image: null,
  });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({
    id: memId,
    familyId: famId,
    userId,
    displayName: displayName ?? email.split("@")[0]!,
  });
  return { userId, famId, memId };
}

/**
 * Seed a second member into an existing family (for cross-member / cross-family
 * isolation tests). Returns the second user's id — same family, different user.
 */
async function seedSecondMemberInFamily(famId: string, email: string, displayName?: string) {
  const userId = `u-${newId()}`;
  const memId = newId();
  await db.insert(user).values({
    id: userId,
    email,
    emailVerified: false,
    name: email,
    image: null,
  });
  await db.insert(member).values({
    id: memId,
    familyId: famId,
    userId,
    displayName: displayName ?? email.split("@")[0]!,
  });
  return { userId, memId };
}

function caller(userId: string) {
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
        token: `tok-${newId()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  });
}

describe("[026-S1] 正常更新:trim + 返回子集", () => {
  it("'  小明  ' → 存 '小明' 并返回 { id, displayName }", async () => {
    const email = `026-s1-${Date.now()}@example.com`;
    const { userId } = await seedUser(email, "旧昵称");
    const c = caller(userId);

    const result = await c.auth.updateNickname({ displayName: "  小明  " });
    expect(result.member.displayName).toBe("小明");
    expect(result.member.id).toBeTruthy();
    // 返回子集 — 不应包含 userId / familyId / createdAt
    const keys = Object.keys(result.member).sort();
    expect(keys).toEqual(["displayName", "id"]);
  });
});

describe("[026-S2] 空字符串", () => {
  it("'' → BAD_REQUEST '昵称不能为空'", async () => {
    const email = `026-s2-${Date.now()}@example.com`;
    const { userId } = await seedUser(email);
    const c = caller(userId);

    await expect(
      c.auth.updateNickname({ displayName: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // zod error message is nested in error.cause.issues[0].message and
    // serialized into error.message as JSON — assert both surfaces.
    await expect(
      c.auth.updateNickname({ displayName: "" }),
    ).rejects.toThrow(/昵称不能为空/);
  });
});

describe("[026-S3] 纯空白", () => {
  it("'   ' → trim 后空 → BAD_REQUEST '昵称不能为空'", async () => {
    const email = `026-s3-${Date.now()}@example.com`;
    const { userId } = await seedUser(email);
    const c = caller(userId);

    await expect(
      c.auth.updateNickname({ displayName: "   " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      c.auth.updateNickname({ displayName: "   " }),
    ).rejects.toThrow(/昵称不能为空/);
  });
});

describe("[026-S4] 超长", () => {
  it("'a'.repeat(31) → BAD_REQUEST '昵称不超过 30 字符'", async () => {
    const email = `026-s4-${Date.now()}@example.com`;
    const { userId } = await seedUser(email);
    const c = caller(userId);

    await expect(
      c.auth.updateNickname({ displayName: "a".repeat(31) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      c.auth.updateNickname({ displayName: "a".repeat(31) }),
    ).rejects.toThrow(/昵称不超过 30 字符/);
  });
});

describe("[026-S5] 边界长度 30", () => {
  it("'a'.repeat(30) → 成功", async () => {
    const email = `026-s5-${Date.now()}@example.com`;
    const { userId } = await seedUser(email);
    const c = caller(userId);

    const result = await c.auth.updateNickname({ displayName: "a".repeat(30) });
    expect(result.member.displayName).toBe("a".repeat(30));
    expect(result.member.displayName.length).toBe(30);
  });
});

describe("[026-S6] 跨 member 隔离", () => {
  it("User A 调用 mutation 只更新 A 自己的 member,User B 不受影响", async () => {
    const ts = Date.now();
    const a = await seedUser(`026-s6a-${ts}@example.com`, "Alice");
    const b = await seedUser(`026-s6b-${ts}@example.com`, "Bob");

    const cA = caller(a.userId);
    await cA.auth.updateNickname({ displayName: "Alice 新名" });

    // A 已更新
    const aRows = await db
      .select()
      .from(member)
      .where(eq(member.userId, a.userId));
    expect(aRows[0]?.displayName).toBe("Alice 新名");

    // B 不变
    const bRows = await db
      .select()
      .from(member)
      .where(eq(member.userId, b.userId));
    expect(bRows[0]?.displayName).toBe("Bob");
  });
});

describe("[026-S7] 跨 family 隔离", () => {
  it("同家庭两个用户,A 不能更新 B 的昵称(userId 硬隔离)", async () => {
    const ts = Date.now();
    const a = await seedUser(`026-s7a-${ts}@example.com`, "Aaa");
    // Second user in SAME family as A
    const b = await seedSecondMemberInFamily(a.famId, `026-s7b-${ts}@example.com`, "Bbb");

    const cA = caller(a.userId);
    await cA.auth.updateNickname({ displayName: "Aaa 新名" });

    // A 已更新
    const aRows = await db
      .select()
      .from(member)
      .where(eq(member.userId, a.userId));
    expect(aRows[0]?.displayName).toBe("Aaa 新名");

    // B 在同一 family 但 displayName 不变 — server-side 用 session.user.id
    // 定位,A 调用 mutation 不会触碰 B 的行
    const bRows = await db
      .select()
      .from(member)
      .where(eq(member.userId, b.userId));
    expect(bRows[0]?.displayName).toBe("Bbb");
  });
});

describe("[026-S8] 中文 / emoji", () => {
  it("'小明 🎉' (JS length = 5) → 成功", async () => {
    const email = `026-s8-${Date.now()}@example.com`;
    const { userId } = await seedUser(email);
    const c = caller(userId);

    const input = "小明 🎉";
    expect(input.length).toBe(5); // sanity check JS length

    const result = await c.auth.updateNickname({ displayName: input });
    expect(result.member.displayName).toBe("小明 🎉");
  });
});

describe("[026-S9] DB 持久化", () => {
  it("mutation 返回后,重新查 DB 验证 members.display_name 已写入", async () => {
    const email = `026-s9-${Date.now()}@example.com`;
    const { userId } = await seedUser(email, "原昵称");
    const c = caller(userId);

    await c.auth.updateNickname({ displayName: "持久化昵称" });

    // 重新查 DB(不走 mutation),验证 row 真的被写
    const rows = await db
      .select({
        id: member.id,
        displayName: member.displayName,
      })
      .from(member)
      .where(eq(member.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.displayName).toBe("持久化昵称");
  });
});

describe("[026-Perf] p95 < 300ms (宪章五 mutation 预算)", () => {
  it("10 次 mutation,p95 < 300ms", async () => {
    const email = `026-perf-${Date.now()}@example.com`;
    const { userId } = await seedUser(email);
    const c = caller(userId);

    // warm-up(避开首次 JIT / 连接池建连)
    await c.auth.updateNickname({ displayName: "warmup" });

    const timings: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await c.auth.updateNickname({ displayName: `perf-${i}` });
      timings.push(Date.now() - start);
    }
    timings.sort((a, b) => a - b);
    const p95 = timings[Math.ceil(timings.length * 0.95) - 1]!;
    // 宪章五预算 300ms;testcontainers 在 CI 上有抖动,留 2x 余量但严格低于 600ms
    expect(p95).toBeLessThan(300);
  });
});
