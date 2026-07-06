import { router, publicProcedure, protectedProcedure } from "@/server/api/trpc";
import { findRecentAuthEventsByEmail } from "@/server/db/queries/auth-events";
import { loadFamilyAndMemberByUserId } from "@/server/db/queries/family-member";

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
});

export type AuthRouter = typeof authRouter;
