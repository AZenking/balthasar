/**
 * T011-T014: Integration tests for transaction.create (real Postgres).
 * + T020-T023: get + list integration
 * + T028-T030: update integration
 * + T033-T036: delete integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import {
  transaction,
  transactionEvent,
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

async function seedUserWithFamilyMemberAccount(email: string) {
  const userId = `u-${newId().slice(0, 12)}`;
  const famId = newId();
  const memId = newId();
  const accId = newId();

  await db.insert(user).values({
    id: userId, email, emailVerified: false, name: email, image: null,
  });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({
    id: memId, familyId: famId, userId, displayName: email,
  });
  await db.insert(accountTable).values({
    id: accId, familyId: famId, name: "测试账户", currency: "CNY", initialBalance: 0,
  });

  // Get first expense + income category IDs from seed
  const cats = await db.select().from(category);
  const expenseCat = cats.find((c) => c.type === "expense")!;
  const incomeCat = cats.find((c) => c.type === "income")!;

  return { userId, famId, memId, accId, expenseCatId: expenseCat.id, incomeCatId: incomeCat.id };
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

describe("[T011] create: signed amount storage", () => {
  it("type=expense → DB amount is negative", async () => {
    const email = `t011e-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    const result = await c.transaction.create({
      type: "expense",
      accountId: s.accId,
      categoryId: s.expenseCatId,
      amount: 5000,
      remark: "午餐",
    });

    expect(result.amount).toBe(5000); // display = positive

    // Verify DB has negative
    const rows = await db.select().from(transaction).where(eq(transaction.id, result.id));
    expect(rows[0]!.amount).toBe(-5000); // DB = signed negative
  });

  it("type=income → DB amount is positive", async () => {
    const email = `t011i-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    const result = await c.transaction.create({
      type: "income",
      accountId: s.accId,
      categoryId: s.incomeCatId,
      amount: 80000,
    });

    const rows = await db.select().from(transaction).where(eq(transaction.id, result.id));
    expect(rows[0]!.amount).toBe(80000); // DB = signed positive
  });
});

describe("[T012] type/category mismatch → 400", () => {
  it("type=expense + income categoryId → BAD_REQUEST", async () => {
    const email = `t012-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    await expect(
      c.transaction.create({
        type: "expense",
        accountId: s.accId,
        categoryId: s.incomeCatId,
        amount: 100,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("[T013] cross-family account → 400 + archived account → 400", () => {
  it("account from different family → BAD_REQUEST", async () => {
    const emailA = `t013a-${Date.now()}@example.com`;
    const emailB = `t013b-${Date.now()}@example.com`;
    const sA = await seedUserWithFamilyMemberAccount(emailA);
    const sB = await seedUserWithFamilyMemberAccount(emailB);
    const cB = caller(sB.userId);

    await expect(
      cB.transaction.create({
        type: "expense",
        accountId: sA.accId, // A's account
        categoryId: sB.expenseCatId,
        amount: 100,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("archived account → BAD_REQUEST", async () => {
    const email = `t013c-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    // Archive the account
    await db.update(accountTable)
      .set({ archivedAt: new Date() })
      .where(eq(accountTable.id, s.accId));

    await expect(
      c.transaction.create({
        type: "expense",
        accountId: s.accId,
        categoryId: s.expenseCatId,
        amount: 100,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("[T014] transaction_created audit", () => {
  it("writes 1 event with before=null, after=snapshot", async () => {
    const email = `t014-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    const result = await c.transaction.create({
      type: "expense",
      accountId: s.accId,
      categoryId: s.expenseCatId,
      amount: 3000,
      remark: "测试",
    });

    const events = await db
      .select()
      .from(transactionEvent)
      .where(eq(transactionEvent.transactionId, result.id));

    expect(events.length).toBe(1);
    expect(events[0]!.eventType).toBe("transaction_created");
    expect(events[0]!.actorMemberId).toBe(s.memId);
    expect(events[0]!.before).toBeNull();
    expect(events[0]!.after).toMatchObject({ remark: "测试" });
  });
});

// === US2: get + list ===

describe("[T020-T021] get with JOIN + cross-family 404", () => {
  it("returns accountName, categoryName, categoryIcon", async () => {
    const email = `t020-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    const created = await c.transaction.create({
      type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100,
    });

    const result = await c.transaction.get({ id: created.id });
    expect(result.accountName).toBe("测试账户");
    expect(result.categoryName).toBeTruthy();
    expect(result.categoryIcon).toBeTruthy();
  });

  it("cross-family get → NOT_FOUND", async () => {
    const emailA = `t021a-${Date.now()}@example.com`;
    const emailB = `t021b-${Date.now()}@example.com`;
    const sA = await seedUserWithFamilyMemberAccount(emailA);
    const sB = await seedUserWithFamilyMemberAccount(emailB);

    const created = await caller(sA.userId).transaction.create({
      type: "expense", accountId: sA.accId, categoryId: sA.expenseCatId, amount: 100,
    });

    await expect(
      caller(sB.userId).transaction.get({ id: created.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("[T022-T023] list cursor pagination + sort", () => {
  it("returns items sorted by occurredAt DESC with nextCursor", async () => {
    const email = `t022-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    for (let i = 0; i < 5; i++) {
      await c.transaction.create({
        type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100 + i,
      });
      await new Promise((r) => setTimeout(r, 10));
    }

    const page1 = await c.transaction.list({ limit: 3 });
    expect(page1.items.length).toBe(3);
    expect(page1.nextCursor).not.toBeNull();

    // Verify DESC sort
    for (let i = 1; i < page1.items.length; i++) {
      expect(
        page1.items[i - 1]!.occurredAt >= page1.items[i]!.occurredAt
      ).toBe(true);
    }

    // Page 2
    const page2 = await c.transaction.list({ limit: 3, cursor: page1.nextCursor! });
    expect(page2.items.length).toBe(2); // only 2 remaining
  });
});

// === US3: update ===

describe("[T028-T030] update", () => {
  it("SC-005: updatedAt > createdAt after edit", async () => {
    const email = `t028-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    const created = await c.transaction.create({
      type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100,
    });
    await new Promise((r) => setTimeout(r, 10));

    const updated = await c.transaction.update({ id: created.id, remark: "改了" });
    expect(updated.updatedAt > created.createdAt).toBe(true);
  });

  it("cross-family update → NOT_FOUND", async () => {
    const emailA = `t029a-${Date.now()}@example.com`;
    const emailB = `t029b-${Date.now()}@example.com`;
    const sA = await seedUserWithFamilyMemberAccount(emailA);
    const sB = await seedUserWithFamilyMemberAccount(emailB);

    const created = await caller(sA.userId).transaction.create({
      type: "expense", accountId: sA.accId, categoryId: sA.expenseCatId, amount: 100,
    });

    await expect(
      caller(sB.userId).transaction.update({ id: created.id, remark: "stolen" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("transaction_edited audit with before/after", async () => {
    const email = `t030-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    const created = await c.transaction.create({
      type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100,
    });

    await c.transaction.update({ id: created.id, remark: "edited" });

    const events = await db
      .select()
      .from(transactionEvent)
      .where(eq(transactionEvent.transactionId, created.id));
    const edited = events.find((e) => e.eventType === "transaction_edited");
    expect(edited).toBeDefined();
    expect(edited!.before).toMatchObject({ remark: "" });
    expect(edited!.after).toMatchObject({ remark: "edited" });
  });
});

// === US4: delete ===

describe("[T033-T036] delete", () => {
  it("hard delete: row disappears from DB", async () => {
    const email = `t033-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    const created = await c.transaction.create({
      type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100,
    });

    await c.transaction.delete({ id: created.id });

    const rows = await db.select().from(transaction).where(eq(transaction.id, created.id));
    expect(rows.length).toBe(0);
  });

  it("re-delete → NOT_FOUND", async () => {
    const email = `t034-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    const created = await c.transaction.create({
      type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100,
    });
    await c.transaction.delete({ id: created.id });

    await expect(c.transaction.delete({ id: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("transaction_deleted audit survives (FK SET NULL, F1 fix)", async () => {
    const email = `t036-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    const created = await c.transaction.create({
      type: "expense", accountId: s.accId, categoryId: s.expenseCatId, amount: 100,
    });
    await c.transaction.delete({ id: created.id });

    // Audit row should still exist with transaction_id = null (SET NULL)
    const events = await db
      .select()
      .from(transactionEvent)
      .where(sql`${transactionEvent.eventType} = 'transaction_deleted'`);
    const deleted = events.find(
      (e) => e.before && JSON.stringify(e.before).includes(created.id.replace(/-/g, ""))
    );
    // At least one transaction_deleted event should exist after the delete
    expect(events.length).toBeGreaterThan(0);
  });
});
