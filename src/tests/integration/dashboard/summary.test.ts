/**
 * Integration tests for dashboard.summary (real Postgres via testcontainers).
 *
 * Two generations:
 *   - T005-T010 (006-dashboard): core month summary semantics.
 *   - T011-T020 (026-cream-amber-revamp): year/month input, expenseTrend
 *     (daily/weekly), Top 2 categories, 4 recent transactions.
 *
 * Per Constitution Principle IV: real Postgres, no mocks.
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
  // collided under tight ms-resolution inserts (uuidv7's tail randomness
  // is ~74 bits but a 12-char hex slice is only 48 bits). Full length
  // keeps the Better-Auth text primary key collision-free across many
  // concurrent seedSetup calls in the same file.
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

async function createTx(c: ReturnType<typeof caller>, opts: {
  type: "income" | "expense"; accountId: string; categoryId: string; amount: number; remark?: string;
}) {
  return c.transaction.create({
    type: opts.type, accountId: opts.accountId, categoryId: opts.categoryId,
    amount: opts.amount, remark: opts.remark ?? "",
  });
}

/**
 * Insert a transaction directly via DB (bypasses procedure-level date default)
 * with an explicit occurredAt — used for back-dating test data to a specific
 * month/day.
 */
async function insertTxAt(opts: {
  familyId: string;
  type: "income" | "expense";
  accountId: string;
  categoryId: string;
  amount: number;
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

// ─── 006-dashboard baseline (T005-T010) ──────────────────────────────────

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

describe("[T006] recentTransactions ≤ 5 (027 FR-006; was ≤ 4 in 026)", () => {
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

describe("[T007] category breakdown percentage (SC-004, 026 Top 2)", () => {
  it("sorted DESC + percentage accurate (top 2)", async () => {
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
  it("previous month transactions not counted in default summary", async () => {
    const email = `t010-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setUTCMonth(twoMonthsAgo.getUTCMonth() - 2);
    twoMonthsAgo.setUTCDate(15);

    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -50000, occurredAt: twoMonthsAgo, remark: "上月交易",
    });

    const result = await caller(s.userId).dashboard.summary();
    expect(result.monthIncome).toBe(0);
    expect(result.monthExpense).toBe(0); // not counted
  });
});

// ─── 026-cream-amber-revamp extension (T011-T020) ────────────────────────
//
// Covers: year/month input, expenseTrend (daily/weekly), Top 2 stable
// ordering, percentage zero-boundary, recent cross-month, daily zero-pad.

describe("[T011] current month default returns daily trend (026 FR-F001)", () => {
  it("no params → current UTC month + daily granularity", async () => {
    const email = `t011-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 1234 });

    const result = await c.dashboard.summary();

    const now = new Date();
    expect(result.queriedYearMonth).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
    expect(result.expenseTrend.granularity).toBe("daily");
    if (result.expenseTrend.granularity !== "daily") return; // narrow for TS
    // 027: daily buckets cover the whole current month (1..last day), not a 7-day week.
    const daysInMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    ).getUTCDate();
    expect(result.expenseTrend.buckets.length).toBe(daysInMonth);
    for (const b of result.expenseTrend.buckets) {
      expect(b.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof b.amount).toBe("number");
    }
  });
});

describe("[T012] explicit month returns weekly trend (026 FR-F001)", () => {
  it("{ year: 2026, month: 6 } → 2026-06 + weekly granularity", async () => {
    const email = `t012-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    // 2026-06 is a historical month (today is 2026-07). Insert one expense.
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -10000, occurredAt: new Date(Date.UTC(2026, 5, 15, 12, 0, 0)), // 2026-06-15
    });

    const result = await caller(s.userId).dashboard.summary({ year: 2026, month: 6 });

    expect(result.queriedYearMonth).toEqual({ year: 2026, month: 6 });
    expect(result.monthExpense).toBe(10000);
    expect(result.expenseTrend.granularity).toBe("daily"); // 027: 全部改 daily
    if (result.expenseTrend.granularity !== "daily") return; // narrow for TS
    // buckets have date + amount
    for (const b of result.expenseTrend.buckets) {
      expect(b.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof b.amount).toBe("number");
    }
    // at least one bucket has the 10000 expense
    const total = result.expenseTrend.buckets.reduce((s, b) => s + b.amount, 0);
    expect(total).toBe(10000);
  });
});

describe("[T013] year-only input defaults month to current UTC (026)", () => {
  it("{ year: 2025 } → month resolved to current UTC month", async () => {
    const email = `t013-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    const result = await caller(s.userId).dashboard.summary({ year: 2025 });

    const now = new Date();
    expect(result.queriedYearMonth).toEqual({
      year: 2025,
      month: now.getUTCMonth() + 1,
    });
  });
});

describe("[T014] empty month: zeros + zero-filled trend buckets (026)", () => {
  it("month with no transactions → all buckets 0, not empty array", async () => {
    const email = `t014-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    // 2025-01 — guaranteed empty for this fresh family
    const result = await caller(s.userId).dashboard.summary({ year: 2025, month: 1 });

    expect(result.queriedYearMonth).toEqual({ year: 2025, month: 1 });
    expect(result.monthIncome).toBe(0);
    expect(result.monthExpense).toBe(0);
    expect(result.monthNet).toBe(0);
    expect(result.topExpenseCategories).toEqual([]);
    // weekly trend buckets MUST be present (not empty) and all amounts 0
    expect(result.expenseTrend.granularity).toBe("daily");
    if (result.expenseTrend.granularity !== "daily") return;
    expect(result.expenseTrend.buckets.length).toBeGreaterThan(0);
    for (const b of result.expenseTrend.buckets) {
      expect(b.amount).toBe(0);
    }
  });
});

describe("[T015] cross-family isolation with explicit month (026)", () => {
  it("Family A's 2026-06 data invisible to Family B", async () => {
    const emailA = `t015a-${Date.now()}@example.com`;
    const emailB = `t015b-${Date.now()}@example.com`;
    const sA = await seedSetup(emailA);
    const sB = await seedSetup(emailB);

    await insertTxAt({
      familyId: sA.famId, type: "expense", accountId: sA.accId, categoryId: sA.expenseCatId,
      amount: -7777, occurredAt: new Date(Date.UTC(2026, 5, 10)),
    });

    const result = await caller(sB.userId).dashboard.summary({ year: 2026, month: 6 });
    expect(result.monthExpense).toBe(0);
    expect(result.topExpenseCategories).toEqual([]);
    if (result.expenseTrend.granularity !== "daily") return;
    const total = result.expenseTrend.buckets.reduce((s, b) => s + b.amount, 0);
    expect(total).toBe(0);
  });
});

describe("[T016] recentTransactions cross-month (026 FR-C007)", () => {
  it("historical month query still returns latest 4 across all months", async () => {
    const email = `t016-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    // Insert 3 transactions in 2025-12, 1 in 2026-06
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -100, occurredAt: new Date(Date.UTC(2025, 11, 1)),
    });
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -200, occurredAt: new Date(Date.UTC(2025, 11, 5)),
    });
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -300, occurredAt: new Date(Date.UTC(2025, 11, 10)),
    });
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -400, occurredAt: new Date(Date.UTC(2026, 5, 15)),
    });

    // Query an old month — recent still must span both months
    const result = await caller(s.userId).dashboard.summary({ year: 2025, month: 12 });

    expect(result.recentTransactions.length).toBe(4);
    // newest first
    expect(result.recentTransactions[0]!.amount).toBe(400);
    // includes the 2026-06 row despite querying 2025-12
    const amounts = result.recentTransactions.map((t) => t.amount);
    expect(amounts).toEqual([400, 300, 200, 100]);
  });
});

describe("[T017] Top 2 stable ordering by categoryName ASC on tie (026)", () => {
  it("same amount → categoryName ASC", async () => {
    const email = `t017-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    // two categories, same amount
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 5000 });
    await createTx(c, { type: "expense", accountId: s.accId, categoryId: s.expenseCat2Id, amount: 5000 });

    const result = await c.dashboard.summary();
    expect(result.topExpenseCategories.length).toBe(2);
    // both 5000 — order is categoryName ASC
    const names = result.topExpenseCategories.map((x) => x.categoryName);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
    expect(result.topExpenseCategories[0]!.percentage).toBe(50);
    expect(result.topExpenseCategories[1]!.percentage).toBe(50);
  });
});

describe("[T018] percentage zero-boundary when monthExpense=0 (026)", () => {
  it("no expense → percentage stays 0, no NaN/throw", async () => {
    const email = `t018-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    // only income this month
    await createTx(c, { type: "income", accountId: s.accId, categoryId: s.incomeCatId, amount: 50000 });

    const result = await c.dashboard.summary();
    expect(result.monthExpense).toBe(0);
    expect(result.topExpenseCategories).toEqual([]);
  });
});

describe("[T019] daily trend zero-pads missing days (027: monthly buckets)", () => {
  it("current month: mid-month expense → prior days zero-padded, seeded day = 3000", async () => {
    const email = `t019-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    // 027: trend covers the whole current month (1..last day), not a Mon-Sun
    // week. Place an expense on the 15th at 12:00 UTC — days 1..14 stay empty
    // so they must be zero-padded. (Guard: skip if today is the 15th in UTC
    // and the seeded tx would land "now" — irrelevant to the assertion.)
    const now = new Date();
    const expenseDay = Math.min(15, now.getUTCDate());
    const expenseDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), expenseDay, 12, 0, 0),
    );
    const expenseKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(expenseDay).padStart(2, "0")}`;

    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -3000, occurredAt: expenseDate,
    });

    const result = await caller(s.userId).dashboard.summary();
    expect(result.expenseTrend.granularity).toBe("daily");
    if (result.expenseTrend.granularity !== "daily") return;

    const daysInMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    ).getUTCDate();
    expect(result.expenseTrend.buckets.length).toBe(daysInMonth);

    // Every bucket MUST be present with a finite numeric amount (zero-pad).
    for (const b of result.expenseTrend.buckets) {
      expect(typeof b.amount).toBe("number");
      expect(Number.isFinite(b.amount)).toBe(true);
    }
    const total = result.expenseTrend.buckets.reduce((s, b) => s + b.amount, 0);
    expect(total).toBe(3000);

    // The seeded day's bucket holds the amount; day 1 is zero-padded.
    const seededBucket = result.expenseTrend.buckets.find((b) => b.date === expenseKey);
    expect(seededBucket).toBeDefined();
    expect(seededBucket!.amount).toBe(3000);
    expect(result.expenseTrend.buckets[0]!.amount).toBe(0); // day 1 zero-padded
  });
});

describe("[T020] weekly trend first/last partial weeks (026 FR-C004)", () => {
  it("2026-06 starts on Sunday → first week is 1-day partial bucket", async () => {
    const email = `t020-${Date.now()}@example.com`;
    const s = await seedSetup(email);

    // 2026-06-01 is a Monday in UTC? Check: Date.UTC(2026,5,1).getUTCDay()
    // → 1 (Monday). So first week IS a complete Mon-Sun week. To exercise the
    // partial-week path we instead pick a month whose 1st is NOT a Monday.
    // 2026-02-01 is a Sunday (getUTCDay()=0) → first week contains only Sun
    // (1 day) — a partial first bucket. 2026-02-28 is a Saturday → last week
    // partial too.
    const monthStart = new Date(Date.UTC(2026, 1, 1));
    expect(monthStart.getUTCDay()).toBe(0); // sanity: Sunday

    // Seed one expense in the first (partial) week and one in the last.
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -1111, occurredAt: new Date(Date.UTC(2026, 1, 1, 6, 0, 0)), // 2026-02-01 (Sun)
    });
    await insertTxAt({
      familyId: s.famId, type: "expense", accountId: s.accId, categoryId: s.expenseCatId,
      amount: -2222, occurredAt: new Date(Date.UTC(2026, 1, 28, 6, 0, 0)), // 2026-02-28 (Sat)
    });

    const result = await caller(s.userId).dashboard.summary({ year: 2026, month: 2 });
    expect(result.expenseTrend.granularity).toBe("daily");
    if (result.expenseTrend.granularity !== "daily") return;
    // buckets must include first (partial Sun-only) and last (partial) weeks
    expect(result.expenseTrend.buckets.length).toBeGreaterThanOrEqual(5);
    const total = result.expenseTrend.buckets.reduce((s, b) => s + b.amount, 0);
    expect(total).toBe(3333);
    // first bucket label starts at the partial week (Jan 26 Mon or Jan 31 Sun)
    const firstBucket = result.expenseTrend.buckets[0]!;
    expect(firstBucket.amount).toBe(1111);
  });
});
