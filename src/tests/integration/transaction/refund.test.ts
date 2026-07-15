/**
 * T059 (027 Polish) — 退款(isRefund)冲减原支出分类集成测试。
 *
 * 退款 = type='expense' + isRefund=true,procedure 跳过 applySign 存 +abs(amount)。
 * 聚合 getCategoryBreakdown 用 SUM(ABS(amount)),同分类正负 ABS 相加后净额下降。
 *
 * research R9 + contracts/transaction-create.md §Business Rule 3 + data-model §3.2。
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
  const cats = await db.select().from(user).then(async () => {
    const { category } = await import("@/server/db/schema");
    return db.select().from(category);
  });
  const expenseCat = cats.find((c) => c.type === "expense")!;
  return { userId, accId, expenseCatId: expenseCat.id };
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

describe("[T059] refund isRefund (027 Polish, C2 决策)", () => {
  it("退款冲减:−¥100 expense + ¥30 退款 → 净支出 ¥70", async () => {
    const email = `t059-refund-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    // 普通支出 ¥100
    await c.transaction.create({
      type: "expense",
      accountId: s.accId,
      categoryId: s.expenseCatId,
      amount: 10000,
    });
    // 退款 ¥30(isRefund=true)
    await c.transaction.create({
      type: "expense",
      accountId: s.accId,
      categoryId: s.expenseCatId,
      amount: 3000,
      isRefund: true,
    });

    const sum = await c.dashboard.summary();
    // type-driven expense 聚合(修复后):signed SUM + ABS
    // −10000 + 退款 +3000 = −7000 → ABS = 7000(净支出,退款真正冲减)
    expect(sum.monthExpense).toBe(7000);
  });
});
