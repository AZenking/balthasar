import "server-only";
import { db } from "@/server/db/client";
import { family, member } from "@/server/db/schema";
import { newId } from "@/lib/uuid";

/**
 * T037: family-init hook.
 *
 * Triggered by Better-Auth's `databaseHooks.user.create.after` callback.
 * Creates a default `Family` (with this user as owner) and an initial
 * `Member` (representing the user within that family) in a single
 * Drizzle transaction.
 *
 * Per FR-004 / SC-005 (1:1:1 invariant): user → family → member must be
 * strictly 1:1:1 in MVP. The UNIQUE index on `families.owner_user_id` and
 * `members.user_id` enforces this at the DB level.
 *
 * Per FR-005: default family name is "我的家庭".
 *
 * If the family/member insert fails, the hook throws — Better-Auth's
 * `databaseHooks.user.create.after` should rollback the user insert.
 * The integration test T034 verifies this atomic guarantee.
 *
 * @param createdUser - The user row Better-Auth just created
 */
export async function onUserCreated(
  createdUser: { id: string; email: string; name?: string | null | undefined }
): Promise<void> {
  const familyId = newId();
  const memberId = newId();

  // Default display name = email local-part (per Assumptions in spec.md)
  const displayName = createdUser.email.split("@")[0] ?? "成员";

  await db.transaction(async (tx) => {
    const [newFamily] = await tx
      .insert(family)
      .values({
        id: familyId,
        ownerUserId: createdUser.id,
        name: "我的家庭",
      })
      .returning();

    if (!newFamily) {
      throw new Error("Failed to create default family");
    }

    const [newMember] = await tx
      .insert(member)
      .values({
        id: memberId,
        familyId: newFamily.id,
        userId: createdUser.id,
        displayName,
      })
      .returning();

    if (!newMember) {
      throw new Error("Failed to create initial member");
    }
  });
}
