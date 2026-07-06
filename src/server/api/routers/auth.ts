import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "@/server/api/trpc";
import { auth } from "@/server/auth/config";
import { writeAuditEvent } from "@/server/auth/hooks/audit";
import {
  checkLockoutByEmail,
  recordLoginFailure,
  clearLoginFailures,
} from "@/server/auth/hooks/lockout";
import { findRecentAuthEventsByEmail } from "@/server/db/queries/auth-events";
import { loadFamilyAndMemberByUserId } from "@/server/db/queries/family-member";
import { isPlausibleEmail } from "@/server/domain/auth/email-normalize";
import { PASSWORD_MIN_LENGTH } from "@/server/domain/auth/password-policy";

/**
 * T041: auth router — exposes register, login, logout, me, auditEvents.
 *
 * Per research.md Q12 + Q13: thin orchestration around Better-Auth API +
 * domain pure functions. Custom logic for:
 *   - email validation (zod + domain)
 *   - password length pre-check (NIST policy enforced inside Better-Auth)
 *   - audit event writes (FR-016)
 *   - 30-day sliding session config (delegated to Better-Auth, FR-008)
 *
 * Implementation will be extended in Phase 4 (lockout hooks), Phase 5
 * (logout), Phase 6 (me + auditEvents query).
 */

const registerInput = z.object({
  email: z.string().refine(isPlausibleEmail, "邮箱格式无效"),
  password: z.string().min(PASSWORD_MIN_LENGTH, `密码至少 ${PASSWORD_MIN_LENGTH} 位`),
});

const loginInput = registerInput; // same shape

/**
 * Map Better-Auth error codes to tRPC codes for consistent client UX.
 */
function mapBetterAuthError(e: unknown): TRPCError {
  const err = e as { code?: string; message?: string; retryAfterSeconds?: number };
  switch (err.code) {
    case "USER_ALREADY_EXISTS":
    case "CONFLICT":
      return new TRPCError({
        code: "CONFLICT",
        message: "该邮箱已注册,请直接登录",
        cause: e,
      });
    case "INVALID_PASSWORD":
    case "INVALID_EMAIL":
    case "USER_NOT_FOUND":
      return new TRPCError({
        code: "UNAUTHORIZED",
        message: "邮箱或密码错误",
        cause: e,
      });
    case "RATE_LIMITED":
    case "TOO_MANY_REQUESTS":
      return new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "操作过于频繁,请稍后再试",
        cause: e,
      });
    case "LOCKED":
      return new TRPCError({
        code: "CONFLICT",
        message: `账户已锁定,请 ${Math.ceil(
          (err.retryAfterSeconds ?? 300) / 60
        )} 分钟后重试`,
        cause: e,
      });
    default:
      return new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "认证失败,请稍后再试",
        cause: e,
      });
  }
}

async function loadFamilyAndMember(userId: string) {
  return loadFamilyAndMemberByUserId(userId);
}

export const authRouter = router({
  /**
   * POST /api/trpc/auth.register
   *
   * Phase 3 (US1): new user signs up → Better-Auth creates user →
   * family-init.hook creates Family + Member atomically → session auto-set.
   */
  register: publicProcedure
    .input(registerInput)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await auth.api.signUpEmail({
          body: {
            email: input.email,
            password: input.password,
            name: input.email.split("@")[0] ?? "用户",
          },
        });

        // NOTE: register_success audit is written by Better-Auth
        // `databaseHooks.user.create.after` in config.ts (avoids duplicate writes).

        const fam = await loadFamilyAndMember(result.user.id);

        return {
          user: {
            id: result.user.id,
            email: result.user.email,
          },
          family: fam.family
            ? { id: fam.family.id, name: fam.family.name }
            : null,
          member: fam.member
            ? { id: fam.member.id, displayName: fam.member.displayName }
            : null,
        };
      } catch (e) {
        throw mapBetterAuthError(e);
      }
    }),

  /**
   * POST /api/trpc/auth.login
   *
   * Phase 4 (US2): existing user logs in. Lockout logic is wired via
   * Better-Auth `signIn.before/after` hooks (Phase 4 T050-T053).
   * This procedure is the thin wrapper.
   */
  login: publicProcedure
    .input(loginInput)
    .mutation(async ({ input }) => {
      // T053: lockout pre-check (Phase 4 US2)
      const lockoutDecision = await checkLockoutByEmail(input.email);
      if (lockoutDecision.status === "locked") {
        const retryAfterSeconds = lockoutDecision.retryAfterSeconds ?? 300;
        // Surface as CONFLICT with retryAfterSeconds in data (matches contract test T045)
        throw new TRPCError({
          code: "CONFLICT",
          message: `账户已锁定,请 ${Math.ceil(retryAfterSeconds / 60)} 分钟后重试`,
          cause: { code: "LOCKED", retryAfterSeconds },
        });
      }

      try {
        const result = await auth.api.signInEmail({
          body: { email: input.email, password: input.password },
        });

        // T052: clear failure counter on success
        await clearLoginFailures(input.email);

        // NOTE: login_success audit is written by Better-Auth
        // `databaseHooks.session.create.after` in config.ts.

        const fam = await loadFamilyAndMember(result.user.id);

        return {
          user: {
            id: result.user.id,
            email: result.user.email,
          },
          family: fam.family
            ? { id: fam.family.id, name: fam.family.name }
            : null,
          member: fam.member
            ? { id: fam.member.id, displayName: fam.member.displayName }
            : null,
        };
      } catch (e) {
        const mapped = mapBetterAuthError(e);

        // T051: record failure on credential error (not on lockout or rate-limit)
        if (mapped.code === "UNAUTHORIZED") {
          const failResult = await recordLoginFailure(input.email);

          // Audit: login_failure (always on credential error)
          try {
            await writeAuditEvent({
              eventType: "login_failure",
              email: input.email,
              outcome: "failure",
            });
          } catch {
            // swallow
          }

          // Audit: lockout_triggered (only when this failure crosses threshold)
          if (failResult.triggeredLockout) {
            try {
              await writeAuditEvent({
                eventType: "lockout_triggered",
                email: input.email,
                outcome: "failure",
                metadata: {
                  retryAfterSeconds: failResult.retryAfterSeconds ?? 300,
                },
              });
            } catch {
              // swallow
            }
          }
        }
        throw mapped;
      }
    }),

  /**
   * POST /api/trpc/auth.logout
   *
   * Phase 5 (US3): idempotent — Better-Auth's signOut tolerates missing
   * sessions. Always returns { success: true } (T056 idempotent contract).
   *
   * NOTE: logout audit is written by `databaseHooks.session.delete.after`
   * in config.ts (fires when session actually existed and was revoked).
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    try {
      if (ctx.session) {
        await auth.api.signOut({
          headers: new Headers(),
        });
      }
    } catch {
      // Idempotent — never fail logout
    }
    return { success: true as const };
  }),

  /**
   * GET /api/trpc/auth.me
   *
   * Phase 6 (US4): returns current user/family/member, or null if unauthed.
   * Better-Auth handles sliding session renewal (updateAge: 1d) internally.
   */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session) return null;

    const fam = await loadFamilyAndMember(ctx.session.user.id);
    return {
      user: {
        id: ctx.session.user.id,
        email: ctx.session.user.email,
      },
      family: fam.family
        ? { id: fam.family.id, name: fam.family.name }
        : null,
      member: fam.member
        ? { id: fam.member.id, displayName: fam.member.displayName }
        : null,
    };
  }),

  /**
   * GET /api/trpc/auth.auditEvents
   *
   * Phase 6 (US4): returns the calling user's auth events from the last
   * 30 days. Email scope is forced from session (never from input) per FR-017.
   */
  auditEvents: protectedProcedure.query(async ({ ctx }) => {
    const events = await findRecentAuthEventsByEmail(ctx.session.user.email, 30);
    return { events };
  }),
});

export type AuthRouter = typeof authRouter;
