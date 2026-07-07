/**
 * T005-T010: Integration tests for dashboard.summary (real Postgres).
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
  const userId = `u-${newId().slice(0, 12)}`;
  const famId = newId();
  const memId = newId();
  const accId = newId();

  await db.insert(user).values({ id: userId, email, emailVerified: false, name: email, image: null });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({ id: memId, familyId: famId, userId, displayName: email });
  await db.insert(accountTable).values({ id: accId, familyId: famId, name: "测试账户", currency: "CNY", initialBalance: 0 });

  const cats = await db.select().from(category);
  const expenseCats = cats.filter((c) => c.type === "expense");
  const incomeCats = cats.filter((c) => c.type === "income");

  return { userId, famId, memId, accId, expenseCatId: expenseCats[0]!.id, expenseCat2Id: expenseCats[1]!.id, incomeCatId: incomeCats[0]!.id };
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

async function createTx(c: ReturnType<typeof caller>, opts: {
  type: "income" | "expense"; accountId: string; categoryId: string; amount: number; remark?: string;
}) {
  return c.transaction.create({
    type: opts.type, accountId: opts.accountId, categoryId: opts.categoryId,
    amount: opts.amount, remark: opts.remark ?? "",
  });
}

describe("[T005] month summary accuracy (SC-003)", () => {
  it("income/expense/net correct", async () => {
    const email = `t005-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 5000 });
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 3000 });
    await createTx(c, { type: "income", accountId: s.accId, categoryId: s.incomeCatId, amount: 20000 });

    const result = await c.dashboard.summary();
    expect(result.monthIncome).toBe(20000);
    expect(result.monthExpense).toBe(8000);
    expect(result.monthNet).toBe(12000);
  });
});

describe("[T006] recentTransactions ≤ 5 (SC-007)", () => {
  it("returns at most 5 with JOIN fields", async () => {
    const email = `t006-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    for (let i = 0; i < 7; i++) {
      await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100 + i });
      await new Promise((r) => setTimeout(r, 5));
    }

    const result = await c.dashboard.summary();
    expect(result.recentTransactions.length).toBe(5);
    expect(result.recentTransactions[0]!.accountName).toBe("测试账户");
    expect(result.recentTransactions[0]!.categoryName).toBeTruthy();
    expect(result.recentTransactions[0]!.categoryIcon).toBeTruthy();
  });
});

describe("[T007] category breakdown percentage (SC-004)", () => {
  it("sorted DESC + percentage accurate", async () => {
    const email = `t007-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 8000 });
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCat2Id, amount: 2000 });

    const result = await c.dashboard.summary();
    expect(result.topExpenseCategories.length).toBe(2);
    expect(result.topExpenseCategories[0]!.amount).toBe(8000);
    expect(result.topExpenseCategories[0]!.percentage).toBe(80);
    expect(result.topExpenseCategories[1]!.amount).toBe(2000);
    expect(result.topExpenseCategories[1]!.percentage).toBe(20);
  });
});

describe("[T008] no transactions → all zeros (SC-006)", () => {
  it("empty family → zeros + empty arrays", async () => {
    const email = `t008-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    const result = await c.dashboard.summary();
    expect(result.monthIncome).toBe(0);
    expect(result.monthExpense).toBe(0);
    expect(result.monthNet).toBe(0);
    expect(result.recentTransactions).toEqual([]);
    expect(result.topExpenseCategories).toEqual([]);
  });
});

describe("[T009] cross-family isolation (SC-005)", () => {
  it("user B sees only B's data", async () => {
    const emailA = `t009a-${Date.now()}@example.com`;
    const emailB = `t009b-${Date.now()}@example.com`;
    const sA = await seedSetup(emailA);
    const sB = await seedSetup(emailB);

    await createTx(caller(sA.userId), { type: "expense", accountId: sA.accId, categoryId: sA.expenseCatId, amount: 9999 });

    const result = await caller(sB.userId).dashboard.summary();
    expect(result.monthIncome).toBe(0);
    expect(result.monthExpense).toBe(0);
    expect(result.recentTransactions).toEqual([]);
  });
});

describe("[T010] last month excluded (FR-007)", () => {
  it("previous month transactions not counted", async () => {
    const email = `t010-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    // Insert a transaction dated 2 months ago directly via DB
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setUTCMonth(twoMonthsAgo.getUTCMonth() - 2);
    twoMonthsAgo.setUTCDate(15);

    await db.insert(transaction).values({
      familyId: s.famId,
      type: "expense",
      accountId: s.accId,
      categoryId: s.expenseCatId,
      amount: -50000,
      remark: "上月交易",
      occurredAt: twoMonthsAgo,
    });

    const result = await caller(s.userId).dashboard.summary();
    expect(result.monthIncome).toBe(0);
    expect(result.monthExpense).toBe(0); // last month's 50000 not counted
  });
});
