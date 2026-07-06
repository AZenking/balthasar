/**
 * T021-T022: Integration tests for account.list (real Postgres via testcontainers).
 *
 * Per Constitution v2.0.0 Principle IV: real DB, no mocks.
 *
 * Coverage:
 *   T021: cross-family isolation (SC-003) — user A's accounts invisible to user B
 *   T022: 100-account performance — list P95 < 200ms (SC-002)
 *
 * Also covers (implicitly):
 *   - default excludes archived
 *   - includeArchived=true returns all
 *   - sort by createdAt DESC
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { account, family, member, user } from "@/server/db/schema";
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

async function seedUserWithFamilyAndMember(email: string) {
  const userId = `u-${newId().slice(0, 12)}`;
  const famId = newId();
  const memId = newId();

  await db.insert(user).values({
    id: userId,
    email,
    emailVerified: false,
    name: email.split("@")[0] ?? "test",
    image: null,
  });
  await db.insert(family).values({
    id: famId,
    ownerUserId: userId,
    name: "我的家庭",
  });
  await db.insert(member).values({
    id: memId,
    familyId: famId,
    userId,
    displayName: email.split("@")[0] ?? "test",
  });

  return { userId, famId, memId };
}

function authedCallerWith(userId: string) {
  return createCaller({
    session: {
      user: {
        id: userId,
        email: "test@example.com",
        emailVerified: false,
        name: "test",
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "s_test",
        userId,
        token: `tok-${newId()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  });
}

describe("[T021] cross-family isolation (SC-003)", () => {
  it("user A's accounts are invisible to user B", async () => {
    const emailA = `t021a-${Date.now()}@example.com`;
    const emailB = `t021b-${Date.now()}@example.com`;
    const { userId: userA, famId: famA } = await seedUserWithFamilyAndMember(emailA);
    const { userId: userB } = await seedUserWithFamilyAndMember(emailB);

    // User A creates 2 accounts
    const callerA = authedCallerWith(userA);
    for (const name of ["A1", "A2"]) {
      await callerA.account.create({ name, currency: "CNY", initialBalance: 0 });
    }

    // User B lists — must see 0 of A's accounts
    const callerB = authedCallerWith(userB);
    const result = await callerB.account.list();
    expect(result).toHaveLength(0);
    expect(result.every((a) => a.familyId !== famA)).toBe(true);
  });
});

describe("[T018+T020] default excludes archived + sort DESC", () => {
  it("default list returns only active (non-archived) accounts, newest first", async () => {
    const email = `t018-${Date.now()}@example.com`;
    const { userId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    // Create 3 active accounts
    const created1 = await caller.account.create({ name: "active-1", currency: "CNY", initialBalance: 0 });
    await new Promise((r) => setTimeout(r, 5)); // ensure distinct timestamps
    const created2 = await caller.account.create({ name: "active-2", currency: "CNY", initialBalance: 0 });
    await new Promise((r) => setTimeout(r, 5));
    const created3 = await caller.account.create({ name: "active-3", currency: "CNY", initialBalance: 0 });

    // Directly archive one via DB (skip US4 not-yet-implemented archive procedure)
    await db.update(account).set({ archivedAt: new Date() }).where(eq(account.id, created1.id));

    const list = await caller.account.list();
    expect(list).toHaveLength(2); // created1 is archived, excluded
    expect(list.map((a) => a.name).sort()).toEqual(["active-2", "active-3"].sort());

    // Sort DESC by createdAt: newest (created3) first
    expect(list[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(list[1]!.createdAt.getTime());
    expect(list[0]!.id).toBe(created3.id);

    void created2;
  });
});

describe("[T019] includeArchived=true returns all", () => {
  it("includeArchived includes archived accounts", async () => {
    const email = `t019-${Date.now()}@example.com`;
    const { userId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    const a1 = await caller.account.create({ name: "active", currency: "CNY", initialBalance: 0 });
    const a2 = await caller.account.create({ name: "archived", currency: "CNY", initialBalance: 0 });

    await db.update(account).set({ archivedAt: new Date() }).where(eq(account.id, a2.id));

    const defaultList = await caller.account.list();
    expect(defaultList).toHaveLength(1);
    expect(defaultList[0]!.id).toBe(a1.id);

    const fullList = await caller.account.list({ includeArchived: true });
    expect(fullList).toHaveLength(2);
    expect(fullList.map((a) => a.id).sort()).toEqual([a1.id, a2.id].sort());
  });
});

describe("[T022] performance — 100 accounts P95 < 200ms (SC-002)", () => {
  it("returns 100 accounts within 200ms (warm cache)", async () => {
    const email = `t022-${Date.now()}@example.com`;
    const { userId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    // Seed 100 accounts in batches
    for (let batch = 0; batch < 10; batch++) {
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          caller.account.create({
            name: `bench-${batch}-${i}`,
            currency: "CNY",
            initialBalance: 0,
          })
        )
      );
    }

    // Warm-up + measurement
    await caller.account.list();
    const timings: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await caller.account.list();
      timings.push(Date.now() - start);
    }
    timings.sort((a, b) => a - b);
    const p95 = timings[Math.ceil(timings.length * 0.95) - 1]!;

    expect(p95).toBeLessThan(200); // SC-002
  });
});
