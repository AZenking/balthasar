/**
 * T026-T028 + SC-006: Integration tests for account.update (real Postgres).
 *
 * Coverage:
 *   SC-006: updatedAt > createdAt after edit (Drizzle $onUpdate hook)
 *   T026: archived account update → CONFLICT (FR-011)
 *   T027: cross-family update → NOT_FOUND (SC-003)
 *   T028: account_edited audit written (FR-015), before/after only mutable
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

describe("[SC-006] updatedAt advances after edit", () => {
  it("response.updatedAt > original createdAt after name change", async () => {
    const email = `sc006-${Date.now()}@example.com`;
    const { userId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    const created = await caller.account.create({
      name: "原名",
      currency: "CNY",
      initialBalance: 0,
    });
    await new Promise((r) => setTimeout(r, 10)); // ensure updatedAt advances

    const updated = await caller.account.update({
      id: created.id,
      name: "新名",
    });

    expect(updated.name).toBe("新名");
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.createdAt.getTime());
  });
});

describe("[T026] archived account cannot be edited (FR-011)", () => {
  it("update on archived account → CONFLICT", async () => {
    const email = `t026-${Date.now()}@example.com`;
    const { userId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    const created = await caller.account.create({
      name: "test",
      currency: "CNY",
      initialBalance: 0,
    });

    // Directly archive via DB (US4 procedure not yet implemented)
    await db.update(account).set({ archivedAt: new Date() }).where(eq(account.id, created.id));

    await expect(
      caller.account.update({ id: created.id, name: "改名" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("[T027] cross-family update → NOT_FOUND (SC-003)", () => {
  it("user B cannot edit user A's account — gets NOT_FOUND, not FORBIDDEN", async () => {
    const emailA = `t027a-${Date.now()}@example.com`;
    const emailB = `t027b-${Date.now()}@example.com`;
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
      callerB.account.update({ id: created.id, name: "stolen" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Verify A's account unchanged
    const rows = await db.select().from(account).where(eq(account.id, created.id));
    expect(rows[0]!.name).toBe("A的账户");
  });
});

describe("[T028] account_edited audit written (FR-015)", () => {
  it("writes 1 account_event row with event_type=account_edited, before+after jsonb", async () => {
    const email = `t028-${Date.now()}@example.com`;
    const { userId, memId } = await seedUserWithFamilyAndMember(email);
    const caller = authedCallerWith(userId);

    const created = await caller.account.create({
      name: "原名",
      currency: "CNY",
      initialBalance: 100000,
    });

    await caller.account.update({
      id: created.id,
      name: "新名",
      currency: "USD",
    });

    const auditRows = await db
      .select()
      .from(accountEvent)
      .where(eq(accountEvent.accountId, created.id));

    const editedEvent = auditRows.find((r) => r.eventType === "account_edited");
    expect(editedEvent).toBeDefined();
    expect(editedEvent!.actorMemberId).toBe(memId);
    expect(editedEvent!.before).toMatchObject({ name: "原名", currency: "CNY" });
    expect(editedEvent!.after).toMatchObject({ name: "新名", currency: "USD" });

    // SC-004: initialBalance not in before/after (only mutable fields tracked)
    expect(editedEvent!.before).not.toHaveProperty("initialBalance");
    expect(editedEvent!.after).not.toHaveProperty("initialBalance");

    // SC-004: no sensitive keys
    const json = JSON.stringify({ before: editedEvent!.before, after: editedEvent!.after });
    expect(json).not.toMatch(/password|token|session/i);
  });
});
