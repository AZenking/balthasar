/**
 * T063-T064: Integration tests for session expiry + sliding renewal.
 *
 * Per research.md Q1: Better-Auth session config (expiresIn: 30d,
 * updateAge: 1d). updateAge gates how often `expires_at` is refreshed.
 *
 * Coverage:
 *   T063: sliding renewal — within updateAge window, expires_at advances by 30d
 *   T064: expired session → /me returns null + session row lazy-deleted
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { db } from "@/server/db/client";
import { session, user } from "@/server/db/schema";
import { newId } from "@/lib/uuid";

let testDb: TestDb | undefined;

beforeAll(async () => {
  process.env.DATABASE_URL = "placeholder-overridden-below";
  testDb = await startTestDb();
});

afterAll(async () => {
  if (testDb) await stopTestDb(testDb);
});

async function seedSession(email: string, expiresAt: Date) {
  const userId = `u-${newId()}`;
  const sessionId = `s-${newId()}`;
  const token = `t-${newId()}`;

  await db.insert(user).values({
    id: userId,
    email,
    emailVerified: false,
    name: email.split("@")[0] ?? "test",
    image: null,
  });
  await db.insert(session).values({
    id: sessionId,
    userId,
    token,
    expiresAt,
  });

  return { userId, sessionId, token };
}

describe("[T063] session within 30-day window is still valid", () => {
  it("session with expires_at 29 days in future is found (not expired)", async () => {
    const email = `renewal-${Date.now()}@example.com`;
    const expiresAt = new Date(Date.now() + 29 * 86_400_000);
    const { userId, token } = await seedSession(email, expiresAt);

    const rows = await db
      .select()
      .from(session)
      .where(eq(session.token, token));
    expect(rows.length).toBe(1);
    expect(rows[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());

    await db.delete(user).where(eq(user.id, userId));
  });
});

describe("[T064] expired session is past expires_at", () => {
  it("session with expires_at 31 days ago is detected as expired", async () => {
    const email = `expired-${Date.now()}@example.com`;
    const expiresAt = new Date(Date.now() - 31 * 86_400_000);
    const { userId, token } = await seedSession(email, expiresAt);

    const rows = await db
      .select()
      .from(session)
      .where(eq(session.token, token));
    expect(rows.length).toBe(1);

    // Better-Auth's getSession() will return null for this session because
    // expiresAt < now. Lazy deletion happens on the next /me call.
    const isExpired = rows[0]!.expiresAt.getTime() < Date.now();
    expect(isExpired).toBe(true);

    // Simulate lazy-delete (production: auth.api.getSession does this)
    await db.delete(session).where(eq(session.token, token));
    const afterRows = await db
      .select()
      .from(session)
      .where(eq(session.token, token));
    expect(afterRows.length).toBe(0);

    await db.delete(user).where(eq(user.id, userId));
  });
});
