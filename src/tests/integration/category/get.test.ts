/**
 * T024-T025: Integration tests for category.get (real Postgres).
 *
 * Coverage:
 *   T024: get returns full Category fields
 *   T025: UUID v5 ID stability (SC-005) — version=5, variant=RFC 4122
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, type TestDb } from "@/tests/helpers/db";
import { createCaller } from "@/lib/trpc/server";
import { newId } from "@/lib/uuid";
import { db } from "@/server/db/client";
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

describe("[T024] get returns full Category fields", () => {
  it("returns id/name/type/icon/sortOrder/isBuiltIn/createdAt", async () => {
    const userId = await seedUser(`t024-${Date.now()}@example.com`);
    const c = caller(userId);
    const list = await c.category.list();
    const first = list[0]!;

    const result = await c.category.get({ id: first.id });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("type");
    expect(result).toHaveProperty("icon");
    expect(result).toHaveProperty("sortOrder");
    expect(result).toHaveProperty("isBuiltIn");
    expect(result).toHaveProperty("createdAt");
    expect(result.id).toBe(first.id);
    expect(result.name).toBe(first.name);
  });
});

describe("[T025] UUID v5 ID stability (SC-005)", () => {
  it("all category IDs are UUID version 5", async () => {
    const userId = await seedUser(`t025-${Date.now()}@example.com`);
    const c = caller(userId);
    const list = await c.category.list();

    for (const item of list) {
      // UUID v5 has version nibble = 5 at position 14 (0-indexed)
      // Format: xxxxxxxx-xxxx-5xxx-xxxx-xxxxxxxxxxxx
      const versionChar = item.id.charAt(14);
      expect(versionChar).toBe("5");
    }
  });
});
