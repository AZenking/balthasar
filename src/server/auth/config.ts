import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { env } from "@/lib/env";
import { checkPasswordPolicy } from "@/server/domain/auth/password-policy";

/**
 * Better-Auth server configuration.
 *
 * Per research.md Q12 (Better-Auth integration boundary):
 * - emailAndPassword plugin: enabled
 * - session: 30-day expiry, 1-day sliding renewal (FR-008, SC-009)
 * - rate limit: 10/hour on sign-up-email (FR-018, SC-011)
 * - password policy: NIST 800-63B length+blocklist (FR-003)
 *
 * Business hooks (family-init / lockout / audit) are wired in their
 * respective US phases (Phase 3, 4, 6). At Foundational stage, only the
 * base config is live.
 */
export const auth = betterAuth({
  database: {
    adapter: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
  },
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    /**
     * NIST 800-63B password policy (FR-003, Clarification Q2).
     * Better-Auth calls this on every password set (sign-up + change).
     */
    password: {
      policy: {
        async validate(password: string) {
          const result = checkPasswordPolicy(password);
          if (!result.ok) {
            throw new Error(
              result.reason === "too_short"
                ? `密码至少 ${result.minLength} 位`
                : "密码过于常见,请使用更强的密码"
            );
          }
        },
      },
    },
  },
  session: {
    /**
     * 30-day sliding window (FR-008, SC-009).
     * `updateAge: 1d` means we update `expires_at` at most once per day,
     * avoiding a DB write on every request.
     */
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // cache session in cookie 5 min for fast RSC reads
    },
  },
  rateLimit: {
    window: 60,
    max: 100,
    rules: {
      "sign-up-email": {
        window: 3600,
        max: 10,
      },
      "sign-in-email": {
        window: 60,
        max: 20,
      },
    },
  },
  /**
   * Hooks go here in later phases:
   *   databaseHooks.user.create.after → family-init.hook (Phase 3)
   *   databaseHooks.session.create.after → audit.hook (Phase 3)
   *   signIn.before / signIn.after      → lockout hooks (Phase 4)
   */
  advanced: {
    cookies: {
      sessionToken: {
        name: "balthasar.session_token",
        attributes: {
          httpOnly: true,
          sameSite: "lax",
          secure: env.NODE_ENV === "production",
          path: "/",
        },
      },
    },
  },
});

export type Auth = typeof auth;
