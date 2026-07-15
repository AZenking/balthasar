/**
 * T049 (027-mobile-home-revamp US6) — account.create 含 type + migration 向后兼容。
 *
 * 对应 contracts/account-create.md Test Scenarios:
 *   - 创建 debt 账户 → type='debt'
 *   - type 默认 asset(不传 type)
 *   - debt 进入 totalLiabilities
 *   - migration 向后兼容:存量账户(无 type 列数据)type='asset'
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

describe("[T049] account.create type (027 US6)", () => {
  it("创建 debt 账户 → 返回 type='debt'", async () => {
    const email = `t049-debt-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);
    const created = await c.account.create({
      name: "信用卡",
      currency: "CNY",
      initialBalance: -200000,
      type: "debt",
    });
    expect(created.type).toBe("debt");
  });

  it("不传 type → 默认 asset", async () => {
    const email = `t049-default-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);
    const created = await c.account.create({
      name: "银行卡",
      currency: "CNY",
      initialBalance: 100000,
    } as any);
    expect(created.type).toBe("asset");
  });

  it("migration 向后兼容:直接 DB 插入(不带 type)→ type='asset'(DEFAULT)", async () => {
    const email = `t049-compat-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    // 直接 DB 插入,不指定 type(模拟存量数据)
    const id = newId();
    await db.insert(accountTable).values({
      id,
      familyId: s.famId,
      name: "存量账户",
      currency: "CNY",
      initialBalance: 0,
    } as any);
    const rows = await db.select().from(accountTable);
    const row = rows.find((r) => r.id === id);
    expect(row?.type).toBe("asset"); // DEFAULT 'asset'
  });
});
