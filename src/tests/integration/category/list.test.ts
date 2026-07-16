/**
 * T013-T017: Integration tests for category.list + seed integrity (real Postgres).
 *
 * Coverage:
 *   T013: seed ≥ 20 (SC-001) + expense ≥ 12 (SC-002) + income ≥ 5 (SC-003)
 *         + name.length 1-30 (SC-006) + icon.length ≤ 4 (SC-008)
 *   T014: 排序 sortOrder ASC, name ASC (FR-003)
 *   T015: 跨家庭一致 (FR-007)
 *   T016: seed 幂等 (SC-005, FR-009)
 *   T017: P95 < 100ms (SC-004, FR-012)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { category } from "@/server/db/schema";
import { createCaller } from "@/lib/trpc/server";
import { newId } from "@/lib/uuid";
import { family, member, user } from "@/server/db/schema";

let testDb: TestDb | undefined;

beforeAll(async () => {
  process.env.DATABASE_URL = "placeholder-overridden-below";
  testDb = await startTestDb();
});

afterAll(async () => {
  if (testDb) await stopTestDb(testDb);
});

async function seedUser(email: string) {
  const userId = `u-${newId().slice(0, 12)}`;
  const famId = newId();
  const memId = newId();
  await db.insert(user).values({ id: userId, email, emailVerified: false, name: email, image: null });
  await db.insert(family).values({ id: famId, ownerUserId: userId, name: "我的家庭" });
  await db.insert(member).values({ id: memId, familyId: famId, userId, displayName: email });
  return userId;
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

describe("[T013] seed integrity (SC-001/002/003/006/008)", () => {
  it("has ≥ 20 total, ≥ 12 expense, ≥ 5 income", async () => {
    const userId = await seedUser(`t013-${Date.now()}@example.com`);
    const c = caller(userId);
    const items = await c.category.list();

    expect(items.length).toBeGreaterThanOrEqual(20);
    const expense = items.filter((x) => x.type === "expense");
    const income = items.filter((x) => x.type === "income");
    expect(expense.length).toBeGreaterThanOrEqual(12);
    expect(income.length).toBeGreaterThanOrEqual(5);
  });

  it("every row: name 1-30, icon is valid lucide name, type ∈ {income,expense}", async () => {
    const userId = await seedUser(`t013b-${Date.now()}@example.com`);
    const c = caller(userId);
    const items = await c.category.list();

    for (const item of items) {
      expect(item.name.length).toBeGreaterThanOrEqual(1);
      expect(item.name.length).toBeLessThanOrEqual(30);
      // 028 迁移后 icon 是 lucide kebab-case 名(如 "utensils"),非 emoji
      expect(item.icon).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(item.icon.length).toBeGreaterThanOrEqual(2);
      expect(item.icon.length).toBeLessThanOrEqual(30);
      expect(["income", "expense"]).toContain(item.type);
      expect(item.sortOrder).toBeGreaterThan(0);
    }
  });
});

describe("[T014] sort order (FR-003)", () => {
  it("items sorted by sortOrder ASC, name ASC", async () => {
    const userId = await seedUser(`t014-${Date.now()}@example.com`);
    const c = caller(userId);
    const items = await c.category.list();

    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1]!;
      const curr = items[i]!;
      const prevKey = `${prev.sortOrder}:${prev.name}`;
      const currKey = `${curr.sortOrder}:${curr.name}`;
      expect(prevKey.localeCompare(currKey)).toBeLessThanOrEqual(0);
    }
  });
});

describe("[T015] cross-family consistency (FR-007)", () => {
  it("user A and user B see identical categories", async () => {
    const userA = await seedUser(`t015a-${Date.now()}@example.com`);
    const userB = await seedUser(`t015b-${Date.now()}@example.com`);
    const listA = await caller(userA).category.list();
    const listB = await caller(userB).category.list();
    const idsA = listA.map((x) => x.id).sort();
    const idsB = listB.map((x) => x.id).sort();
    expect(idsA).toEqual(idsB);
  });
});

describe("[T016] seed idempotency (SC-005, FR-009)", () => {
  it("row count stable after re-query (seed ON CONFLICT DO NOTHING)", async () => {
    const userId = await seedUser(`t016-${Date.now()}@example.com`);
    const c = caller(userId);
    const count1 = (await c.category.list()).length;
    const count2 = (await c.category.list()).length;
    expect(count1).toBe(count2);
  });
});

describe("[T017] performance (SC-004, FR-012)", () => {
  it("P95 < 100ms over 20 requests", async () => {
    const userId = await seedUser(`t017-${Date.now()}@example.com`);
    const c = caller(userId);
    await c.category.list(); // warm-up

    const timings: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = Date.now();
      await c.category.list();
      timings.push(Date.now() - start);
    }
    timings.sort((a, b) => a - b);
    const p95 = timings[Math.ceil(timings.length * 0.95) - 1]!;
    expect(p95).toBeLessThan(100);
  });
});
