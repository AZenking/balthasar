/**
 * Integration tests for dashboard.report (026-cream-amber-revamp Phase 2b).
 *
 * Covers the 8 contract scenarios in
 * `specs/026-cream-amber-revamp/contracts/dashboard-report.md`:
 *
 *  1. default target month (no params)
 *  2. explicit target month { endYear, endMonth }
 *  3. cross-year rollover (endYear=2026, endMonth=2 → 2025-09..2026-02)
 *  4. empty target month (no transactions → breakdown=[], trend zeros)
 *  5. mixed months (only 3 of 6 have transactions, rest stay 0)
 *  6. category percentage (¥100 / 餐饮 ¥60 → 60.0)
 *  7. cross-family isolation
 *  8. label format `${year}年${month}月`
 *
 * Real Postgres via testcontainers — Constitution v3.0.0 Principle IV.
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
  // Full uuidv7 for userId — `u-` prefix + 12-char slice historically
  // collided under tight ms-resolution inserts. Full length keeps the
  // Better-Auth text primary key collision-free.
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
  const incomeCats = cats.filter((c) => c.type === "income");

  return {
    userId,
    famId,
    memId,
    accId,
    expenseCatId: expenseCats[0]!.id,
    expenseCat2Id: expenseCats[1]!.id,
    incomeCatId: incomeCats[0]!.id,
  };
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

/**
 * Insert a transaction directly via DB with an explicit occurredAt,
 * bypassing the procedure's "now" default. Used to back-date test data
 * into specific months of the 6-month trend window.
 *
 * Amount is signed: pass negative for expense to mirror real writes
 * (e.g. createTx stores expense as negative in the table).
 */
async function insertTxAt(opts: {
  familyId: string;
  type: "income" | "expense";
  accountId: string;
  categoryId: string;
  amount: number; // signed
  occurredAt: Date;
  remark?: string;
}) {
  await db.insert(transaction).values({
    familyId: opts.familyId,
    type: opts.type,
    accountId: opts.accountId,
    categoryId: opts.categoryId,
    amount: opts.amount,
    remark: opts.remark ?? "",
    occurredAt: opts.occurredAt,
  });
}

/** Mid-month UTC timestamp for (year, monthZeroIndexed, day=15). */
function utcMid(year: number, monthIdx: number, day = 15): Date {
  return new Date(Date.UTC(year, monthIdx, day, 12, 0, 0));
}

// ─── 8 contract scenarios ────────────────────────────────────────────────

describe("[R001] default target month = current UTC (Scenario 1)", () => {
  it("no params → 6-month window ending at current UTC month", async () => {
    const email = `r001-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    const result = await caller(s.userId).dashboard.report();

    const now = new Date();
    expect(result.endYearMonth).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
    expect(result.monthlyTrend).toHaveLength(6);
    // monthlyTrend[0] = current UTC month
    expect(result.monthlyTrend[0]!.year).toBe(now.getUTCFullYear());
    expect(result.monthlyTrend[0]!.month).toBe(now.getUTCMonth() + 1);
  });
});

describe("[R002] explicit target month (Scenario 2)", () => {
  it("{ endYear: 2026, endMonth: 6 } → 2026-01..2026-06, target in [0]", async () => {
    const email = `r002-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    const result = await caller(s.userId).dashboard.report({ endYear: 2026, endMonth: 6 });

    expect(result.endYearMonth).toEqual({ year: 2026, month: 6 });
    expect(result.monthlyTrend).toHaveLength(6);
    // 6 items, descending, ending 2026-06 at index 0
    const months = result.monthlyTrend.map((m) => `${m.year}-${m.month}`);
    expect(months).toEqual([
      "2026-6", "2026-5", "2026-4", "2026-3", "2026-2", "2026-1",
    ]);
  });
});

describe("[R003] cross-year rollover (Scenario 3)", () => {
  it("{ endYear: 2026, endMonth: 2 } → 2025-09..2026-02, order correct", async () => {
    const email = `r003-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    const result = await caller(s.userId).dashboard.report({ endYear: 2026, endMonth: 2 });

    expect(result.endYearMonth).toEqual({ year: 2026, month: 2 });
    expect(result.monthlyTrend).toHaveLength(6);
    const months = result.monthlyTrend.map((m) => `${m.year}-${m.month}`);
    expect(months).toEqual([
      "2026-2", "2026-1", "2025-12", "2025-11", "2025-10", "2025-9",
    ]);
  });
});

describe("[R004] empty target month (Scenario 4)", () => {
  it("target month has no tx → breakdown=[], trend row all zeros", async () => {
    const email = `r004-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    // 2025-01 guaranteed empty for a fresh family
    const result = await caller(s.userId).dashboard.report({ endYear: 2025, endMonth: 1 });

    expect(result.endYearMonth).toEqual({ year: 2025, month: 1 });
    // target month (index 0) all zeros
    expect(result.monthlyTrend[0]!.income).toBe(0);
    expect(result.monthlyTrend[0]!.expense).toBe(0);
    expect(result.monthlyTrend[0]!.net).toBe(0);
    // breakdown empty
    expect(result.targetMonthCategoryBreakdown).toEqual([]);
    // still 6 items in trend
    expect(result.monthlyTrend).toHaveLength(6);
  });
});

describe("[R005] mixed data — sparse months stay in trend with zeros (Scenario 5)", () => {
  it("only 3 of 6 months have transactions; rest income/expense/net=0", async () => {
    const email = `r005-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    // Target = 2026-06. Seed tx in 2026-06, 2026-04, 2026-02 only.
    // 2026-05, 2026-03, 2026-01 should remain all-zero but still appear.
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -1000, occurredAt: utcMid(2026, 5), // 2026-06
    });
    await insertTxAt({
      familyId: s.famId, type: "income", accountId: s.accId, categoryId: s.incomeCatId,
      amount: 5000, occurredAt: utcMid(2026, 3), // 2026-04
    });
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCat2Id,
      amount: -2000, occurredAt: utcMid(2026, 1), // 2026-02
    });

    const result = await caller(s.userId).dashboard.report({ endYear: 2026, endMonth: 6 });

    const trend = result.monthlyTrend;
    expect(trend).toHaveLength(6);
    // index mapping (target first):
    // 0=2026-06 (expense 1000), 1=2026-05 (none), 2=2026-04 (income 5000),
    // 3=2026-03 (none), 4=2026-02 (expense 2000), 5=2026-01 (none)
    expect(trend[0]).toMatchObject({ year: 2026, month: 6, expense: 1000, income: 0, net: -1000 });
    expect(trend[1]).toMatchObject({ year: 2026, month: 5, income: 0, expense: 0, net: 0 });
    expect(trend[2]).toMatchObject({ year: 2026, month: 4, income: 5000, expense: 0, net: 5000 });
    expect(trend[3]).toMatchObject({ year: 2026, month: 3, income: 0, expense: 0, net: 0 });
    expect(trend[4]).toMatchObject({ year: 2026, month: 2, income: 0, expense: 2000, net: -2000 });
    expect(trend[5]).toMatchObject({ year: 2026, month: 1, income: 0, expense: 0, net: 0 });
  });
});

describe("[R006] category percentage (Scenario 6)", () => {
  it("target ¥100 expense, 餐饮 ¥60 → percentage=60.0", async () => {
    const email = `r006-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    // Seed ¥100 expense in target month split ¥60 / ¥40 across two categories
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -6000, occurredAt: utcMid(2026, 5), // 2026-06 (¥60)
    });
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCat2Id,
      amount: -4000, occurredAt: utcMid(2026, 5), // 2026-06 (¥40)
    });

    const result = await caller(s.userId).dashboard.report({ endYear: 2026, endMonth: 6 });

    // target month total expense = 10000 cents (¥100)
    expect(result.monthlyTrend[0]!.expense).toBe(10000);
    expect(result.targetMonthCategoryBreakdown).toHaveLength(2);
    // sorted DESC by amount → 6000 first
    const first = result.targetMonthCategoryBreakdown[0]!;
    expect(first.amount).toBe(6000);
    expect(first.percentage).toBe(60.0);
    const second = result.targetMonthCategoryBreakdown[1]!;
    expect(second.amount).toBe(4000);
    expect(second.percentage).toBe(40.0);
    // percentages sum to 100.0
    const total = result.targetMonthCategoryBreakdown.reduce((a, b) => a + b.percentage, 0);
    expect(total).toBeCloseTo(100.0, 1);
  });
});

describe("[R007] cross-family isolation (Scenario 7)", () => {
  it("Family A's 2026-06 tx invisible to Family B's report", async () => {
    const emailA = `r007a-${Date.now()}@example.com`;
    const emailB = `r007b-${Date.now()}@example.com`;
    const sA = await seedSetup(emailA);
    const sB = await seedSetup(emailB);

    await insertTxAt({
      familyId: sA.famId, type: "expense", accountId: sA.accId, categoryId: sA.expenseCatId,
      amount: -8888, occurredAt: utcMid(2026, 5), // 2026-06
    });

    const result = await caller(sB.userId).dashboard.report({ endYear: 2026, endMonth: 6 });

    // Family B's trend for 2026-06 must be zero
    expect(result.monthlyTrend[0]!.income).toBe(0);
    expect(result.monthlyTrend[0]!.expense).toBe(0);
    expect(result.monthlyTrend[0]!.net).toBe(0);
    expect(result.targetMonthCategoryBreakdown).toEqual([]);
  });
});

describe("[R008] label format (Scenario 8)", () => {
  it("monthlyTrend[i].label === `${year}年${month}月` (no leading zero)", async () => {
    const email = `r008-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    const result = await caller(s.userId).dashboard.report({ endYear: 2026, endMonth: 2 });

    for (const item of result.monthlyTrend) {
      expect(item.label).toBe(`${item.year}年${item.month}月`);
    }
    // spot-check cross-year item (2025-9 not 2025-09)
    const last = result.monthlyTrend[5]!;
    expect(last).toMatchObject({ year: 2025, month: 9 });
    expect(last.label).toBe("2025年9月");
    // spot-check first item (2026-2 not 2026-02)
    const first = result.monthlyTrend[0]!;
    expect(first.label).toBe("2026年2月");
  });
});
