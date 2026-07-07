/**
 * T003-T011 + T013-T017: Integration tests for transaction.list
 * filters + summary (005-transactions-list, real Postgres).
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

async function seedFullSetup(email: string) {
  const userId = `u-${newId().slice(0, 12)}`;
  const famId = newId();
  const memId = newId();
  const accId = newId();
  const accId2 = newId();

  await db.insert(user).values({ id: userId, email, emailVerified: false, name: email, image: null });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({ id: memId, familyId: famId, userId, displayName: email });
  await db.insert(accountTable).values({ id: accId, familyId: famId, name: "账户A", currency: "CNY", initialBalance: 0 });
  await db.insert(accountTable).values({ id: accId2, familyId: famId, name: "账户B", currency: "CNY", initialBalance: 0 });

  const cats = await db.select().from(category);
  const expenseCats = cats.filter((c) => c.type === "expense");
  const incomeCats = cats.filter((c) => c.type === "income");

  return { userId, famId, memId, accId, accId2, expenseCatId: expenseCats[0]!.id, expenseCat2Id: expenseCats[1]!.id, incomeCatId: incomeCats[0]!.id };
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

// === US1: Filters ===

describe("[T003] type filter", () => {
  it("type=expense returns only expense", async () => {
    const email = `t003-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100 });
    await createTx(c, { type: "income", accountId: s.accId, categoryId: s.incomeCatId, amount: 200 });

    const result = await c.transaction.list({ type: "expense" });
    expect(result.items.every((t) => t.type === "expense")).toBe(true);
    expect(result.items.length).toBe(1);
  });
});

describe("[T004] accountId filter", () => {
  it("returns only that account's transactions", async () => {
    const email = `t004-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100 });
    await createTx(c, { type: "expense", accountId: s.accId2, categoryId: s.expenseCatId, amount: 200 });

    const result = await c.transaction.list({ accountId: s.accId });
    expect(result.items.every((t) => t.accountId === s.accId)).toBe(true);
  });
});

describe("[T005] categoryId filter", () => {
  it("returns only that category's transactions", async () => {
    const email = `t005-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100 });
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCat2Id, amount: 200 });

    const result = await c.transaction.list({ categoryId: s.expenseCatId });
    expect(result.items.every((t) => t.categoryId === s.expenseCatId)).toBe(true);
  });
});

describe("[T006] date range filter", () => {
  it("startDate/endDate filters by occurredAt", async () => {
    const email = `t006-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);

    // Create a tx, then filter by a narrow window around it
    const tx = await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100 });

    const start = new Date(tx.occurredAt.getTime() - 60000).toISOString();
    const end = new Date(tx.occurredAt.getTime() + 60000).toISOString();

    const result = await c.transaction.list({ startDate: start, endDate: end });
    expect(result.items.length).toBe(1);
  });

  it("SC-006: startDate > endDate → empty", async () => {
    const email = `t006b-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100 });

    const result = await c.transaction.list({
      startDate: "2026-12-01T00:00:00Z",
      endDate: "2026-01-01T00:00:00Z",
    });
    expect(result.items.length).toBe(0);
  });
});

describe("[T007] keyword ILIKE", () => {
  it("matches remark containing keyword", async () => {
    const email = `t007-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100, remark: "星巴克咖啡" });
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 200, remark: "午餐" });

    const result = await c.transaction.list({ keyword: "咖啡" });
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.remark).toContain("咖啡");
  });

  it("case-insensitive for English", async () => {
    const email = `t007b-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100, remark: "Starbucks Coffee" });

    const result = await c.transaction.list({ keyword: "starbucks" });
    expect(result.items.length).toBe(1);
  });
});

describe("[T008] multiple filters AND", () => {
  it("type + accountId combined", async () => {
    const email = `t008-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100 });
    await createTx(c, { type: "income", accountId: s.accId, categoryId: s.incomeCatId, amount: 200 });
    await createTx(c, { type: "expense", accountId: s.accId2, categoryId: s.expenseCatId, amount: 300 });

    const result = await c.transaction.list({ type: "expense", accountId: s.accId });
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.amount).toBe(100);
  });
});

describe("[T009] cross-family accountId → empty", () => {
  it("SC-005: other family's account → empty list", async () => {
    const emailA = `t009a-${Date.now()}@example.com`;
    const emailB = `t009b-${Date.now()}@example.com`;
    const sA = await seedFullSetup(emailA);
    const sB = await seedFullSetup(emailB);
    const c = caller(sB.userId);

    const result = await c.transaction.list({ accountId: sA.accId });
    expect(result.items.length).toBe(0);
  });
});

describe("[T011] cursor + filter continuity", () => {
  it("SC-007: page 2 with cursor + same filter is continuous", async () => {
    const email = `t011-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);

    // Create 5 expense transactions
    for (let i = 0; i < 5; i++) {
      await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100 + i });
      await new Promise((r) => setTimeout(r, 10));
    }

    // Page 1: limit=2, type=expense
    const page1 = await c.transaction.list({ limit: 2, type: "expense" });
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).not.toBeNull();

    // Page 2: same filter + cursor
    const page2 = await c.transaction.list({ limit: 2, type: "expense", cursor: page1.nextCursor! });
    expect(page2.items.length).toBe(2);

    // Verify no overlap
    const page1Ids = new Set(page1.items.map((t) => t.id));
    const overlap = page2.items.filter((t) => page1Ids.has(t.id));
    expect(overlap.length).toBe(0);
  });
});

// === US2: Summary ===

describe("[T013] includeSummary accuracy", () => {
  it("SC-003: income/expense/net correct", async () => {
    const email = `t013-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);
    // 3 expense: 5000 + 3000 + 8000 = 16000
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 5000 });
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 3000 });
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 8000 });
    // 2 income: 20000 + 5000 = 25000
    await createTx(c, { type: "income", accountId: s.accId, categoryId: s.incomeCatId, amount: 20000 });
    await createTx(c, { type: "income", accountId: s.accId, categoryId: s.incomeCatId, amount: 5000 });

    const result = await c.transaction.list({ includeSummary: true });
    expect(result.summary).toBeDefined();
    expect(result.summary!.income).toBe(25000);
    expect(result.summary!.expense).toBe(16000);
    expect(result.summary!.net).toBe(9000);
  });
});

describe("[T014] summary covers all pages", () => {
  it("summary reflects all matching, not just current page", async () => {
    const email = `t014-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);

    for (let i = 0; i < 10; i++) {
      await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 1000 });
    }

    const result = await c.transaction.list({ limit: 3, includeSummary: true });
    expect(result.items.length).toBe(3); // only 3 on page
    expect(result.summary!.expense).toBe(10000); // but summary = all 10
  });
});

describe("[T015] type filter + summary", () => {
  it("type=expense + summary → income=0", async () => {
    const email = `t015-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 5000 });
    await createTx(c, { type: "income", accountId: s.accId, categoryId: s.incomeCatId, amount: 20000 });

    const result = await c.transaction.list({ type: "expense", includeSummary: true });
    expect(result.summary!.income).toBe(0);
    expect(result.summary!.expense).toBe(5000);
  });
});

describe("[T016] empty + summary → all zeros", () => {
  it("no transactions → summary 0,0,0", async () => {
    const email = `t016-${Date.now()}@example.com`;
    const s = await seedFullSetup(email);
    const c = caller(s.userId);

    const result = await c.transaction.list({ includeSummary: true });
    expect(result.items.length).toBe(0);
    expect(result.summary!.income).toBe(0);
    expect(result.summary!.expense).toBe(0);
    expect(result.summary!.net).toBe(0);
  });
});
