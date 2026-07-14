import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "@/server/api/trpc";
import { findRecentAuthEventsByEmail } from "@/server/db/queries/auth-events";
import { loadFamilyAndMemberByUserId } from "@/server/db/queries/family-member";
import { db } from "@/server/db/client";
import { member } from "@/server/db/schema";

/**
 * auth router — read-only queries that don't need cookie management.
 *
 * Phase 7 refactor: register / login / logout moved out of tRPC to Better-Auth's
 * native endpoints at /api/auth/* (fixes Set-Cookie bug — Better-Auth's tRPC
 * shim doesn't propagate Set-Cookie to the outer HTTP response).
 *
 * Frontend now calls:
 *   - authClient.signUpEmail()  → POST /api/auth/sign-up/email  (注册, sets cookie)
 *   - authClient.signInEmail()  → POST /api/auth/sign-in/email  (登录, sets cookie)
 *   - authClient.signOut()      → POST /api/auth/sign-out       (登出, clears cookie)
 *
 * tRPC retains:
 *   - auth.me           (read-only session + family/member lookup)
 *   - auth.auditEvents  (read-only, protectedProcedure)
 *
 * Lockout + audit-event writes happen in the Better-Auth wrapper route
 * (src/app/api/auth/[...all]/route.ts), not in tRPC.
 */
export const authRouter = router({
  /**
   * GET /api/trpc/auth.me
   *
   * Returns current user/family/member from session, or null if unauthed.
   * Sliding renewal handled by Better-Auth internally (updateAge: 1d).
   */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session) return null;

    const fam = await loadFamilyAndMemberByUserId(ctx.session.user.id);
    return {
      user: {
        id: ctx.session.user.id,
        email: ctx.session.user.email,
      },
      family: fam.family,
      member: fam.member,
    };
  }),

  /**
   * GET /api/trpc/auth.auditEvents
   *
   * Returns the calling user's auth events from the last 30 days.
   * Email scope forced from session (FR-017).
   */
  auditEvents: protectedProcedure.query(async ({ ctx }) => {
    const events = await findRecentAuthEventsByEmail(ctx.session.user.email, 30);
    return { events };
  }),

  /**
   * POST /api/trpc/auth.updateNickname
   *
   * 026 Switch PR Phase 2: update the calling user's member.display_name.
   *
   * Target member is resolved server-side via `userId === ctx.session.user.id`
   * — the client CANNOT inject memberId / familyId (cross-user hard isolation).
   *
   * Zero schema change: no `updatedAt` column, no audit log (display_name is a
   * low-sensitivity field, outside the Constitution v3 audit scope).
   *
   * Contract: specs/026-cream-amber-revamp/contracts/auth-update-nickname.md
   */
  updateNickname: protectedProcedure
    .input(
      z.object({
        displayName: z
          .string()
          .trim()
          .min(1, "昵称不能为空")
          .max(30, "昵称不超过 30 字符"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Resolve target member by session.user.id (cross-user isolation).
      const target = await db.query.member.findFirst({
        where: eq(member.userId, ctx.session.user.id),
      });
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "成员不存在",
        });
      }

      // 2. UPDATE + RETURNING subset (no userId / familyId / createdAt leak).
      const [updated] = await db
        .update(member)
        .set({ displayName: input.displayName })
        .where(eq(member.id, target.id))
        .returning({
          id: member.id,
          displayName: member.displayName,
        });

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "昵称更新失败",
        });
      }

      return { member: updated };
    }),
});

export type AuthRouter = typeof authRouter;
