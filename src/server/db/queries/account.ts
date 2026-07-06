import "server-only";
import { TRPCError } from "@trpc/server";
import { loadFamilyAndMemberByUserId } from "./family-member";

/**
 * Resolve familyId for a given user (research.md Q3).
 *
 * Reuses 001's `loadFamilyAndMemberByUserId` (T007) — single source of truth
 * for the user→family→member relationship. This file is a thin convenience
 * wrapper that returns only `family.id` and throws if the relationship is
 * broken (which shouldn't happen given 001 SC-005 invariant).
 *
 * Per Constitution Principle III DDD: cross-aggregate reference uses ID only;
 * this function is the canonical way to derive the current family context.
 */
export async function loadFamilyIdByUserId(userId: string): Promise<string> {
  const fam = await loadFamilyAndMemberByUserId(userId);
  if (!fam.family) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "用户未关联家庭 (数据完整性问题,1:1:1 不变量被破坏)",
    });
  }
  return fam.family.id;
}

/**
 * Resolve familyId + memberId for a given user (both are needed by
 * account.create procedure for audit `actorMemberId`).
 */
export async function loadFamilyAndMemberIdsByUserId(
  userId: string
): Promise<{ familyId: string; memberId: string }> {
  const fam = await loadFamilyAndMemberByUserId(userId);
  if (!fam.family || !fam.member) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "用户未关联家庭/成员 (数据完整性问题)",
    });
  }
  return { familyId: fam.family.id, memberId: fam.member.id };
}
