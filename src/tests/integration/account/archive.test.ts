/**
 * T032-T035: Integration tests for account.archive / account.unarchive (real Postgres).
 *
 * Coverage:
 *   T032: archive idempotent (SC-004) — already archived re-archive returns 200
 *   T033: unarchive idempotent — non-archived unarchive returns 200
 *   T034: account_archived / account_unarchived audit written (FR-015)
 *   T035: cross-family archive/unarchive → NOT_FOUND (SC-003)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { account, accountEvent, family, member, user } from "@/server/db/schema";
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

describe("[T032] archive idempotent (SC-004)", () => {
  it("re-archiving already-archived account returns 200, archivedAt unchanged", async () => {
    const email = `t032-${Date.now()}@example.com`;
    const { userId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    const created = await caller.account.create({
      name: "test",
      currency: "CNY",
      initialBalance: 0,
    });

    const r1 = await caller.account.archive({ id: created.id });
    expect(r1.archivedAt).not.toBeNull();
    const firstArchivedAt = r1.archivedAt!;

    // Re-archive: should NOT error, archivedAt should not change
    const r2 = await caller.account.archive({ id: created.id });
    expect(r2.archivedAt).not.toBeNull();
    expect(r2.archivedAt!.getTime()).toBe(firstArchivedAt.getTime());
  });
});

describe("[T033] unarchive idempotent (SC-004)", () => {
  it("unarchiving non-archived account returns 200, archivedAt stays null", async () => {
    const email = `t033-${Date.now()}@example.com`;
    const { userId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    const created = await caller.account.create({
      name: "test",
      currency: "CNY",
      initialBalance: 0,
    });
    // Not yet archived
    expect(created.archivedAt).toBeNull();

    // Unarchive on non-archived: should NOT error
    const r = await caller.account.unarchive({ id: created.id });
    expect(r.archivedAt).toBeNull();
  });

  it("archive → unarchive → archive works correctly", async () => {
    const email = `t033b-${Date.now()}@example.com`;
    const { userId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    const created = await caller.account.create({
      name: "test",
      currency: "CNY",
      initialBalance: 0,
    });

    await caller.account.archive({ id: created.id });
    await caller.account.unarchive({ id: created.id });
    const r3 = await caller.account.archive({ id: created.id });
    expect(r3.archivedAt).not.toBeNull();

    // Verify final state in DB
    const rows = await db.select().from(account).where(eq(account.id, created.id));
    expect(rows[0]!.archivedAt).not.toBeNull();
  });
});

describe("[T034] account_archived / account_unarchived audit (FR-015)", () => {
  it("writes 1 event per archive/unarchive operation", async () => {
    const email = `t034-${Date.now()}@example.com`;
    const { userId, memId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    const created = await caller.account.create({
      name: "audit-test",
      currency: "CNY",
      initialBalance: 0,
    });

    await caller.account.archive({ id: created.id });
    await caller.account.unarchive({ id: created.id });

    const auditRows = await db
      .select()
      .from(accountEvent)
      .where(eq(accountEvent.accountId, created.id));

    const archivedEvent = auditRows.find((r) => r.eventType === "account_archived");
    const unarchivedEvent = auditRows.find((r) => r.eventType === "account_unarchived");

    expect(archivedEvent).toBeDefined();
    expect(archivedEvent!.actorMemberId).toBe(memId);
    expect(archivedEvent!.before).toBeNull();
    expect(archivedEvent!.after).toBeNull();

    expect(unarchivedEvent).toBeDefined();
    expect(unarchivedEvent!.actorMemberId).toBe(memId);
    expect(unarchivedEvent!.before).toBeNull();
    expect(unarchivedEvent!.after).toBeNull();

    // SC-004: no sensitive data
    const json = JSON.stringify(auditRows);
    expect(json).not.toMatch(/password|token|session/i);
  });

  it("idempotent archive does NOT write duplicate account_archived event", async () => {
    const email = `t034b-${Date.now()}@example.com`;
    const { userId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    const created = await caller.account.create({
      name: "idempotent-test",
      currency: "CNY",
      initialBalance: 0,
    });

    await caller.account.archive({ id: created.id });
    await caller.account.archive({ id: created.id }); // idempotent, no audit

    const auditRows = await db
      .select()
      .from(accountEvent)
      .where(eq(accountEvent.accountId, created.id));

    const archivedCount = auditRows.filter((r) => r.eventType === "account_archived").length;
    expect(archivedCount).toBe(1); // not 2
  });
});

describe("[T035] cross-family archive/unarchive → NOT_FOUND (SC-003)", () => {
  it("user B cannot archive user A's account", async () => {
    const emailA = `t035a-${Date.now()}@example.com`;
    const emailB = `t035b-${Date.now()}@example.com`;
    const { userId: userA } = await seedUserWithFamilyAndMember(emailA);
    const { userId: userB } = await seedUserWithFamilyAndMember(emailB);

    const callerA = authedCallerWith(userA);
    const created = await callerA.account.create({
      name: "A的账户",
      currency: "CNY",
      initialBalance: 0,
    });

    const callerB = authedCallerWith(userB);
    await expect(
      callerB.account.archive({ id: created.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Verify A's account not archived
    const rows = await db.select().from(account).where(eq(account.id, created.id));
    expect(rows[0]!.archivedAt).toBeNull();
  });

  it("user B cannot unarchive user A's account", async () => {
    const emailA = `t035c-${Date.now()}@example.com`;
    const emailB = `t035d-${Date.now()}@example.com`;
    const { userId: userA } = await seedUserWithFamilyAndMember(emailA);
    const { userId: userB } = await seedUserWithFamilyAndMember(emailB);

    const callerA = authedCallerWith(userA);
    const created = await callerA.account.create({
      name: "A的账户",
      currency: "CNY",
      initialBalance: 0,
    });
    await callerA.account.archive({ id: created.id });

    const callerB = authedCallerWith(userB);
    await expect(
      callerB.account.unarchive({ id: created.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Verify A's account still archived
    const rows = await db.select().from(account).where(eq(account.id, created.id));
    expect(rows[0]!.archivedAt).not.toBeNull();
  });
});
