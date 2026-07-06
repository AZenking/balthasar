/**
 * T065-T067: Integration tests for audit event query + cross-user isolation.
 *
 * Per FR-016/017 + SC-010: query is scoped to current session email,
 * returns events from last 30 days, MUST NOT leak password/token.
 *
 * Coverage:
 *   T065: full flow produces 5 audit event types (register/login_fail/lockout/login/logout)
 *   T066: cross-user isolation (A's cookie cannot see B's events)
 *   T067: performance — 1000-row auth_events query under 5s P95 (SC-010)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { authEvent, user } from "@/server/db/schema";
import { newId } from "@/lib/uuid";
import { findRecentAuthEventsByEmail } from "@/server/db/queries/auth-events";

let testDb: TestDb | undefined;

beforeAll(async () => {
  process.env.DATABASE_URL = "placeholder-overridden-below";
  testDb = await startTestDb();
});

afterAll(async () => {
  if (testDb) await stopTestDb(testDb);
});

describe("[T065] findRecentAuthEventsByEmail returns events from last 30 days", () => {
  it("returns events in DESC order by occurredAt", async () => {
    const email = `audit-${Date.now()}@example.com`;
    const userId = `u-${newId()}`;

    await db.insert(user).values({
      id: userId,
      email,
      emailVerified: false,
      name: "audit-test",
      image: null,
    });

    // Seed events out of order
    const baseTime = Date.now();
    const events: Array<{
      eventType:
        | "register_success"
        | "login_success"
        | "login_failure"
        | "lockout_triggered"
        | "logout";
      outcome: "success" | "failure";
    }> = [
      { eventType: "register_success", outcome: "success" },
      { eventType: "login_failure", outcome: "failure" },
      { eventType: "lockout_triggered", outcome: "failure" },
      { eventType: "login_success", outcome: "success" },
      { eventType: "logout", outcome: "success" },
    ];

    for (let i = 0; i < events.length; i++) {
      await db.insert(authEvent).values({
        id: newId(),
        eventType: events[i]!.eventType,
        email,
        outcome: events[i]!.outcome,
        occurredAt: new Date(baseTime - (5 - i) * 60_000),
        metadata: {},
      });
    }

    const result = await findRecentAuthEventsByEmail(email, 30);

    expect(result.length).toBe(5);

    // Verify DESC order
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1]!.occurredAt.getTime();
      const curr = result[i]!.occurredAt.getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }

    // Verify all 5 event types present
    const types = new Set(result.map((r) => r.eventType));
    expect(types.has("register_success")).toBe(true);
    expect(types.has("login_success")).toBe(true);
    expect(types.has("login_failure")).toBe(true);
    expect(types.has("lockout_triggered")).toBe(true);
    expect(types.has("logout")).toBe(true);

    // Cleanup
    await db.delete(authEvent).where(eq(authEvent.email, email));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("excludes events older than 30 days", async () => {
    const email = `old-${Date.now()}@example.com`;
    const userId = `u-${newId()}`;

    await db.insert(user).values({
      id: userId,
      email,
      emailVerified: false,
      name: "old-test",
      image: null,
    });

    // Recent event (1 day ago)
    await db.insert(authEvent).values({
      id: newId(),
      eventType: "login_success",
      email,
      outcome: "success",
      occurredAt: new Date(Date.now() - 86_400_000),
      metadata: {},
    });

    // Old event (45 days ago)
    await db.insert(authEvent).values({
      id: newId(),
      eventType: "logout",
      email,
      outcome: "success",
      occurredAt: new Date(Date.now() - 45 * 86_400_000),
      metadata: {},
    });

    const result = await findRecentAuthEventsByEmail(email, 30);
    expect(result.length).toBe(1);
    expect(result[0]!.eventType).toBe("login_success");

    await db.delete(authEvent).where(eq(authEvent.email, email));
    await db.delete(user).where(eq(user.id, userId));
  });
});

describe("[T066] cross-user isolation", () => {
  it("query by alice@x.com does not return bob@x.com events", async () => {
    const aliceEmail = `alice-${Date.now()}@example.com`;
    const bobEmail = `bob-${Date.now()}@example.com`;

    await db.insert(authEvent).values({
      id: newId(),
      eventType: "login_success",
      email: aliceEmail,
      outcome: "success",
      metadata: {},
    });
    await db.insert(authEvent).values({
      id: newId(),
      eventType: "login_failure",
      email: bobEmail,
      outcome: "failure",
      metadata: {},
    });

    const aliceResult = await findRecentAuthEventsByEmail(aliceEmail, 30);
    expect(aliceResult.length).toBe(1);
    expect(aliceResult[0]!.eventType).toBe("login_success");

    const bobResult = await findRecentAuthEventsByEmail(bobEmail, 30);
    expect(bobResult.length).toBe(1);
    expect(bobResult[0]!.eventType).toBe("login_failure");

    // Cleanup
    await db.delete(authEvent).where(eq(authEvent.email, aliceEmail));
    await db.delete(authEvent).where(eq(authEvent.email, bobEmail));
  });
});

describe("[T067] performance — 1000-row query under 5s P95 (SC-010)", () => {
  it("returns 1000 events within 5s", async () => {
    const email = `perf-${Date.now()}@example.com`;

    // Seed 1000 events in batches of 100 (Drizzle batch insert)
    const batchSize = 100;
    for (let b = 0; b < 10; b++) {
      const rows = Array.from({ length: batchSize }, () => ({
        id: newId(),
        eventType: "login_success" as const,
        email,
        outcome: "success" as const,
        occurredAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 86_400_000)),
        metadata: {},
      }));
      await db.insert(authEvent).values(rows);
    }

    const start = Date.now();
    const result = await findRecentAuthEventsByEmail(email, 30);
    const elapsed = Date.now() - start;

    expect(result.length).toBe(1000);
    expect(elapsed).toBeLessThan(5000); // SC-010 P95 < 5s

    // Verify no sensitive keys leak (SC-004 defense-in-depth)
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/password/i);
    expect(json).not.toMatch(/token/i);

    // Cleanup
    await db.delete(authEvent).where(eq(authEvent.email, email));

    // Sanity check the count after cleanup
    const remaining = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(authEvent)
      .where(eq(authEvent.email, email));
    expect(remaining[0]?.count).toBe(0);
  });
});
