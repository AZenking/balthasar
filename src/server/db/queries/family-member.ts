import "server-only";
import { db } from "@/server/db/client";
import { family, member } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Load a user's family + member records by user ID.
 *
 * Used by auth router's register/login/me procedures to assemble the
 * { user, family, member } response shape.
 *
 * Pulled out to a standalone query module so procedure contract tests
 * can mock this single module (Constitution v2.0.0 Principle II
 * Feature-Sliced: pure data access lives in src/server/db/queries/).
 */
export async function loadFamilyAndMemberByUserId(userId: string): Promise<{
  family: { id: string; name: string } | null;
  member: { id: string; displayName: string } | null;
}> {
  const families = await db
    .select({ id: family.id, name: family.name })
    .from(family)
    .where(eq(family.ownerUserId, userId))
    .limit(1);
  const members = await db
    .select({ id: member.id, displayName: member.displayName })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);

  return {
    family: families[0] ?? null,
    member: members[0] ?? null,
  };
}
