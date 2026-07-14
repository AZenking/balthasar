/**
 * T009 (027-mobile-home-revamp US2) — dashboard.summary Top4 分类 + recent 5。
 *
 * 027 FR-004:支出分类默认展示 Top 4(026 是 Top 2)。
 * 027 FR-006:最近账单 5 条(后端 limit 5)。
 *
 * 宪章原则四:真实 PostgreSQL(testcontainers),不 mock。
 *
 * 数据契约:specs/027-mobile-home-revamp/contracts/dashboard-summary.md
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import {
  transaction,
  account as accountTable,
  family,
  member,
  user,
  category,
} from "@/server/db/schema";
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

  const cats = await db.select().from(category);
  const expenseCats = cats.filter((c) => c.type === "expense");
  return { userId, famId, memId, accId, expenseCats };
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

describe("[T009] dashboard.summary Top4 categories (027 FR-004)", () => {
  it("returns up to 4 expense categories sorted DESC", async () => {
    const email = `t009-top4-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    // 内置 expense 分类应 ≥ 4(seedSetup 返回全部 expense cats)。
    const cats = s.expenseCats.slice(0, 4);
    expect(cats.length).toBeGreaterThanOrEqual(4);

    // 4 个分类各记一笔,金额递减(餐饮 > 购物 > 交通 > 娱乐)。
    await c.transaction.create({ type: "expense", accountId: s.accId, categoryId: cats[0]!.id, amount: 126000 });
    await c.transaction.create({ type: "expense", accountId: s.accId, categoryId: cats[1]!.id, amount: 84000 });
    await c.transaction.create({ type: "expense", accountId: s.accId, categoryId: cats[2]!.id, amount: 52000 });
    await c.transaction.create({ type: "expense", accountId: s.accId, categoryId: cats[3]!.id, amount: 30000 });

    const result = await c.dashboard.summary();
    expect(result.topExpenseCategories.length).toBe(4);
    // 降序:最高在前。
    expect(result.topExpenseCategories[0]!.amount).toBe(126000);
    expect(result.topExpenseCategories[3]!.amount).toBe(30000);
    // 每项含 categoryId/categoryName/percentage。
    expect(result.topExpenseCategories[0]!.categoryId).toBe(cats[0]!.id);
    expect(result.topExpenseCategories[0]!.percentage).toBeGreaterThan(0);
  });

  it("fewer than 4 categories → returns only available (no padding)", async () => {
    const email = `t009-few-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    // 仅记 2 个分类。
    const cats = s.expenseCats.slice(0, 2);
    await c.transaction.create({ type: "expense", accountId: s.accId, categoryId: cats[0]!.id, amount: 5000 });
    await c.transaction.create({ type: "expense", accountId: s.accId, categoryId: cats[1]!.id, amount: 3000 });

    const result = await c.dashboard.summary();
    expect(result.topExpenseCategories.length).toBe(2);
  });

  it("recentTransactions returns 5 (027 FR-006, was 4 in 026)", async () => {
    const email = `t009-recent5-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    for (let i = 0; i < 6; i++) {
      await c.transaction.create({ type: "expense", accountId: s.accId, categoryId: s.expenseCats[0]!.id, amount: 100 + i });
      await new Promise((r) => setTimeout(r, 5));
    }

    const result = await c.dashboard.summary();
    expect(result.recentTransactions.length).toBe(5);
  });
});
