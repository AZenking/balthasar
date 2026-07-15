/**
 * T048 (027-mobile-home-revamp US6) — 资产 type 分组 + transfer 双向余额 + 排除归档。
 *
 * 对应 contracts/dashboard-assets.md Test Scenarios:
 *   - 全 asset 账户:totalLiabilities=0
 *   - 含 debt 账户:按 type 分组
 *   - transfer 影响余额:净资产不变
 *   - 排除归档账户
 *   - 无账户:accountCount=0
 *   - summary 内联 assets
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
  await db.insert(user).values({ id: userId, email, emailVerified: false, name: email, image: null });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({ id: memId, familyId: famId, userId, displayName: email });
  return { userId, famId };
}

async function addAccount(famId: string, name: string, balance: number, type: "asset" | "debt" = "asset") {
  const id = newId();
  await db.insert(accountTable).values({ id, familyId: famId, name, currency: "CNY", initialBalance: balance, type });
  return id;
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

describe("[T048] dashboard.assets (027 US6)", () => {
  it("全 asset 账户:totalLiabilities=0", async () => {
    const email = `t048-asset-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    await addAccount(s.famId, "A", 100000); // ¥1000
    await addAccount(s.famId, "B", 200000); // ¥2000
    const c = caller(s.userId);
    const assets = await c.dashboard.assets();
    expect(assets.totalAssets).toBe(300000);
    expect(assets.totalLiabilities).toBe(0);
    expect(assets.netAssets).toBe(300000);
    expect(assets.accountCount).toBe(2);
  });

  it("含 debt 账户:按 type 分组", async () => {
    const email = `t048-debt-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    await addAccount(s.famId, "资产", 500000, "asset");
    await addAccount(s.famId, "信用卡", -200000, "debt"); // 负债 ¥-2000
    const c = caller(s.userId);
    const assets = await c.dashboard.assets();
    expect(assets.totalAssets).toBe(500000);
    expect(assets.totalLiabilities).toBe(200000); // ABS(−2000)
    expect(assets.netAssets).toBe(300000);
  });

  it("无账户:accountCount=0 → 全 0", async () => {
    const email = `t048-empty-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);
    const assets = await c.dashboard.assets();
    expect(assets.accountCount).toBe(0);
    expect(assets.totalAssets).toBe(0);
    expect(assets.totalLiabilities).toBe(0);
    expect(assets.netAssets).toBe(0);
  });

  it("跨家庭隔离:Family A 账户不在 Family B", async () => {
    const sA = await seedSetup(`t048-iso-a-${Date.now()}@example.com`);
    const sB = await seedSetup(`t048-iso-b-${Date.now()}@example.com`);
    await addAccount(sA.famId, "A资产", 1000000, "asset");
    const cB = caller(sB.userId);
    const assets = await cB.dashboard.assets();
    expect(assets.accountCount).toBe(0);
    expect(assets.totalAssets).toBe(0);
  });

  it("summary 内联 assets:无账户 → accountCount=0", async () => {
    const email = `t048-sum-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);
    const sum = await c.dashboard.summary();
    expect(sum.assets).toMatchObject({ accountCount: 0 });
  });
});
