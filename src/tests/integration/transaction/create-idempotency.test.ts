/**
 * T007-T009 (033 US0 / R3): transaction.create 幂等去重集成测试。
 *
 * 033 research R3:Background Sync 的 at-least-once 投递 + SW retry / 前台 flush
 * 竞态必然导致同一笔交易被多次提交。服务器端用 (family_id, client_request_id)
 * 唯一约束去重,重复提交返回既有 transaction(不报错,retry 幂等)。
 *
 * 这是财务完整性的硬保证(重复记账 = 余额错),最高优先级。
 *
 * 测试覆盖(US0 acceptance 1-4):
 * - T007:retry 返回原 transaction(同 clientRequestId 两次 → 同 id,DB 仅 +1)
 * - T008:并发兜底(两个并发漏 SELECT → 唯一索引 → 最终仅 1 行)
 * - T009:向后兼容(不带 clientRequestId → 走原逻辑,NULL 字段正常建)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
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

/**
 * T007 (US0 acceptance 1 + 2):retry 返回原 transaction。
 *
 * 同一 clientRequestId 两次 create → 第二次返回与第一次同 id;
 * DB 该 family 下仅 +1 行(非 +2)。模拟"服务器收到但响应丢失"→ 客户端 retry。
 */
describe("[T007] create idempotency: retry returns original transaction", () => {
  it("same clientRequestId twice → same id, DB +1 (not +2)", async () => {
    const email = `t007-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);
    const clientRequestId = newId();

    const beforeCount = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(transaction)
      .where(eq(transaction.familyId, s.famId));
    const before = beforeCount[0]!.cnt;

    const payload = {
      type: "expense" as const,
      accountId: s.accId,
      categoryId: s.expenseCatId,
      amount: 4200,
      remark: "午餐(retry 测试)",
      clientRequestId,
    };

    const first = await c.transaction.create(payload);
    // 第二次:模拟 retry,同 clientRequestId + 相同 payload
    const second = await c.transaction.create(payload);

    // retry 幂等:第二次返回与第一次同 id(既有 transaction)
    expect(second.id).toBe(first.id);

    // DB 仅 +1(去重生效,没有建第二笔)
    const afterCount = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(transaction)
      .where(eq(transaction.familyId, s.famId));
    expect(afterCount[0]!.cnt).toBe(before + 1);
  });

  it("clientRequestId recorded on the created row", async () => {
    const email = `t007b-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);
    const clientRequestId = newId();

    const created = await c.transaction.create({
      type: "income",
      accountId: s.accId,
      categoryId: s.incomeCatId,
      amount: 10000,
      clientRequestId,
    });

    const rows = await db
      .select({ clientRequestId: transaction.clientRequestId })
      .from(transaction)
      .where(eq(transaction.id, created.id));
    expect(rows[0]!.clientRequestId).toBe(clientRequestId);
  });
});

/**
 * T008 (US0 acceptance 3):并发兜底。
 *
 * 两个并发 create 带 same clientRequestId(Promise.all)—— 漏过 SELECT 检查时,
 * 唯一索引兜底:第二个 INSERT 触发唯一约束 → procedure catch 后回退返回既有;
 * 最终 DB 仅 1 行,两个 caller 都拿到相同 id(不抛错给客户端)。
 */
describe("[T008] create idempotency: concurrent duplicate hits unique index", () => {
  it("two concurrent same-clientRequestId creates → 1 row, both get same id", async () => {
    const email = `t008-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);
    const clientRequestId = newId();

    const payload = {
      type: "expense" as const,
      accountId: s.accId,
      categoryId: s.expenseCatId,
      amount: 1500,
      remark: "并发测试",
      clientRequestId,
    };

    // 并发提交两次(漏过 SELECT 检查的窗口)
    const [r1, r2] = await Promise.all([
      c.transaction.create(payload),
      c.transaction.create(payload),
    ]);

    // 两个结果都拿到同一 id(无论哪个先 INSERT,另一个命中去重)
    expect(r1.id).toBe(r2.id);

    // DB 仅 1 行
    const rows = await db
      .select({ id: transaction.id })
      .from(transaction)
      .where(eq(transaction.clientRequestId, clientRequestId));
    expect(rows.length).toBe(1);
  });
});

/**
 * T009 (US0 acceptance 4):向后兼容。
 *
 * 不带 clientRequestId 的 create → 走原逻辑,clientRequestId 字段 NULL,正常建。
 * 既有 API Key `/api/v1/` 路径与老客户端不破。
 */
describe("[T009] create idempotency: backward compat without clientRequestId", () => {
  it("create without clientRequestId → succeeds, field NULL", async () => {
    const email = `t009-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    const created = await c.transaction.create({
      type: "expense",
      accountId: s.accId,
      categoryId: s.expenseCatId,
      amount: 3000,
      // 不带 clientRequestId —— 老路径
    });

    // 正常创建
    expect(created.id).toBeTruthy();

    // clientRequestId 字段 NULL(向后兼容)
    const rows = await db
      .select({ clientRequestId: transaction.clientRequestId })
      .from(transaction)
      .where(eq(transaction.id, created.id));
    expect(rows[0]!.clientRequestId).toBeNull();
  });

  it("two creates without clientRequestId → 2 distinct rows (no false dedup)", async () => {
    const email = `t009b-${Date.now()}@example.com`;
    const s = await seedUserWithFamilyMemberAccount(email);
    const c = caller(s.userId);

    // 两次相同 payload 但都不带 clientRequestId —— 应建 2 笔(不误判重复)
    const a = await c.transaction.create({
      type: "expense",
      accountId: s.accId,
      categoryId: s.expenseCatId,
      amount: 1000,
      remark: "第一笔",
    });
    const b = await c.transaction.create({
      type: "expense",
      accountId: s.accId,
      categoryId: s.expenseCatId,
      amount: 1000,
      remark: "第二笔(同金额,但独立交易)",
    });

    expect(a.id).not.toBe(b.id);
  });
});
