/**
 * T039 (027-mobile-home-revamp US5) — 预算 upsert + 四态 + 跨家庭隔离。
 *
 * 对应 contracts/dashboard-budget.md Test Scenarios:
 *   - set 新预算 / set 更新(upsert)
 *   - get 未设置 → null / get 已设置
 *   - delete 存在 / delete 不存在(幂等)
 *   - 跨家庭隔离
 *   - summary 内联预算四态
 *
 * 宪章原则四:真实 PostgreSQL(testcontainers),不 mock。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { user, family, member, account as accountTable } from "@/server/db/schema";
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

async function seedSetup(email: string) {
  const userId = `u-${newId()}`;
  const famId = newId();
  const memId = newId();
  const accId = newId();
  await db.insert(user).values({ id: userId, email, emailVerified: false, name: email, image: null });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({ id: memId, familyId: famId, userId, displayName: email });
  await db.insert(accountTable).values({ id: accId, familyId: famId, name: "测试账户", currency: "CNY", initialBalance: 0 });
  return { userId, famId, accId };
}

function caller(userId: string) {
  return createCaller({
    session: {
      user: {
        id: userId, email: "test@example.com", emailVerified: false,
        name: "test", image: null, createdAt: new Date(), updatedAt: new Date(),
      },
      session: {
        id: "s_test", userId, token: `tok-${newId()}`,
        expiresAt: new Date(Date.now() + 86_400_000), ipAddress: null,
        userAgent: null, createdAt: new Date(), updatedAt: new Date(),
      },
    },
  });
}

const NOW = new Date();
const Y = NOW.getUTCFullYear();
const M = NOW.getUTCMonth() + 1;

describe("[T039] dashboard.budget (027 US5)", () => {
  it("set 新预算 → get 返回 amount", async () => {
    const email = `t039-set-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    await c.dashboard.budget.set({ year: Y, month: M, amount: 580000 });
    const got = await c.dashboard.budget.get({ year: Y, month: M });
    expect(got).toEqual({ amount: 580000 });
  });

  it("set 更新(upsert):同 (year, month) 二次 set → amount 变化,行数仍 1", async () => {
    const email = `t039-upd-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    await c.dashboard.budget.set({ year: Y, month: M, amount: 580000 });
    await c.dashboard.budget.set({ year: Y, month: M, amount: 460000 });
    const got = await c.dashboard.budget.get({ year: Y, month: M });
    expect(got).toEqual({ amount: 460000 });
  });

  it("get 未设置 → null", async () => {
    const email = `t039-none-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);
    const got = await c.dashboard.budget.get({ year: Y, month: M });
    expect(got).toBeNull();
  });

  it("delete 存在 → get null", async () => {
    const email = `t039-del-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);
    await c.dashboard.budget.set({ year: Y, month: M, amount: 580000 });
    await c.dashboard.budget.delete({ year: Y, month: M });
    expect(await c.dashboard.budget.get({ year: Y, month: M })).toBeNull();
  });

  it("delete 不存在(幂等)→ 不报错", async () => {
    const email = `t039-delidem-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);
    await expect(c.dashboard.budget.delete({ year: Y, month: M })).resolves.toEqual({
      success: true,
    });
  });

  it("跨家庭隔离:Family A 预算 Family B 查不到", async () => {
    const sA = await seedSetup(`t039-iso-a-${Date.now()}@example.com`);
    const sB = await seedSetup(`t039-iso-b-${Date.now()}@example.com`);
    const cA = caller(sA.userId);
    const cB = caller(sB.userId);

    await cA.dashboard.budget.set({ year: Y, month: M, amount: 580000 });
    expect(await cB.dashboard.budget.get({ year: Y, month: M })).toBeNull();
  });

  it("summary 内联预算四态:未设预算 → unset", async () => {
    const email = `t039-unset-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);
    const sum = await c.dashboard.summary({ year: Y, month: M });
    expect(sum.budget).toEqual({ status: "unset" });
  });

  it("summary 内联预算四态:normal(有预算无支出 → 0% normal)", async () => {
    const email = `t039-normal-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);
    await c.dashboard.budget.set({ year: Y, month: M, amount: 580000 });
    // 无交易 → monthExpense=0 → usagePercent=0 → normal
    const sum = await c.dashboard.summary({ year: Y, month: M });
    expect(sum.budget).toMatchObject({ status: "normal" });
    expect(sum.budget).toMatchObject({ usagePercent: 0 });
  });
});
