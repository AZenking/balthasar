/**
 * T028 (027-mobile-home-revamp US4) — 转账不进收支聚合 + 自转拒绝。
 *
 * 对应 contracts/transaction-create.md Test Scenarios 4-7:
 *   - transfer 创建:type/toAccountId/amount 正确
 *   - 自转拒绝(FR-014)
 *   - transfer 不计入 monthIncome/monthExpense(FR-013 / SC-006)
 *
 * 宪章原则四:真实 PostgreSQL(testcontainers),不 mock。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import {
  account as accountTable,
  user,
  family,
  member,
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
  const accA = newId();
  const accB = newId();

  await db.insert(user).values({ id: userId, email, emailVerified: false, name: email, image: null });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({ id: memId, familyId: famId, userId, displayName: email });
  await db.insert(accountTable).values({ id: accA, familyId: famId, name: "账户A", currency: "CNY", initialBalance: 100000 });
  await db.insert(accountTable).values({ id: accB, familyId: famId, name: "账户B", currency: "CNY", initialBalance: 0 });

  return { userId, famId, memId, accA, accB };
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

describe("[T028] transfer (027 US4)", () => {
  it("transfer 创建:type/toAccountId/amount 正确", async () => {
    const email = `t028-create-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    const created = await c.transaction.create({
      type: "transfer",
      accountId: s.accA,
      toAccountId: s.accB,
      amount: 30000, // ¥300
    });

    expect(created.type).toBe("transfer");
    expect(created.amount).toBe(30000);
    expect(created.toAccountId).toBe(s.accB);
  });

  it("自转拒绝(FR-014):accountId === toAccountId → BAD_REQUEST", async () => {
    const email = `t028-self-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    await expect(
      c.transaction.create({
        type: "transfer",
        accountId: s.accA,
        toAccountId: s.accA,
        amount: 10000,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("transfer 不计入 monthIncome/monthExpense(SC-006)", async () => {
    const email = `t028-agg-${Date.now()}@example.com`;
    const s = await seedSetup(email);
    const c = caller(s.userId);

    await c.transaction.create({
      type: "transfer",
      accountId: s.accA,
      toAccountId: s.accB,
      amount: 50000,
    });

    const summary = await c.dashboard.summary();
    // 转账不计入收支:无 income/expense 交易 → 两项为 0
    expect(summary.monthIncome).toBe(0);
    expect(summary.monthExpense).toBe(0);
  });
});
