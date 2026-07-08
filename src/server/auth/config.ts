import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db";
import { user, session, verification, oAuthAccount } from "@/server/db/schema/auth";
import { env } from "@/lib/env";
import { onUserCreated } from "@/server/auth/hooks/family-init";
import { writeAuditEvent } from "@/server/auth/hooks/audit";
import { registrationGate } from "@/server/auth/hooks/registration-gate";

/**
 * Curated schema for Better-Auth's drizzle adapter.
 *
 * Better-Auth resolves models by **TypeScript variable name**, not by the
 * underlying `pgTable("name")`. The repo exports two conflicting variables:
 *   - `account`     → business table "accounts"   (family ledger accounts)
 *   - `oAuthAccount` → Better-Auth table "account" (OAuth/password credentials)
 *
 * If we pass the full schema (`import * as schema`), Better-Auth picks the
 * business `account` and crashes looking for `userId`. So we hand it a minimal
 * auth-only object with `account` explicitly remapped to `oAuthAccount`.
 */
const authSchema = {
  user,
  session,
  verification,
  account: oAuthAccount,
};

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
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
    transaction: true,
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    /**
     * 30-day sliding window (FR-008, SC-009).
     * `updateAge: 1d` means we update `expires_at` at most once per day,
     * avoiding a DB write on every request.
     *
     * cookieCache DISABLED — Better-Auth's cookie cache causes sign-out to
     * only clear browser cookie without revoking the DB row, breaking SC-008.
     * Re-enable in V2 if RSC session-read latency becomes a concern (and
     * pair with explicit revoke-on-signout logic).
     */
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    // storage omitted — defaults to "memory". Counters reset on restart,
    // acceptable for MVP per research.md Q3. Switch to "database" in V2
    // (requires adding `rateLimit` model to schema).
    customRules: {
      "/sign-up/email": {
        window: 3600,
        max: 10,
      },
      "/sign-in/email": {
        window: 60,
        max: 20,
      },
    },
  },
  /**
   * Lifecycle hooks (T038 family-init + T040 audit).
   *
   * Phase 3 wires:
   * - `user.create.after` → onUserCreated (creates default Family + Member)
   * - `user.create.after` → audit writeAuditEvent("register_success")
   * - `session.create.after` → audit writeAuditEvent("login_success")
   * - `session.delete.after` → audit writeAuditEvent("logout")
   *
   * Phase 4 will add (in lockout.hook.ts):
   * - signIn.before → lockout check (FR-009)
   * - signIn.after error → counter increment + lockout_triggered audit
   *
   * Note: Better-Auth databaseHooks share the adapter's transaction;
   * if `after` throws, the user insert rolls back (atomic per FR-004).
   */
  databaseHooks: {
    user: {
      create: {
        before: registrationGate.user.create.before,
        after: async (createdUser) => {
          await onUserCreated(createdUser);
          await writeAuditEvent({
            eventType: "register_success",
            email: createdUser.email,
            outcome: "success",
          });
        },
      },
    },
    session: {
      create: {
        after: async (createdSession) => {
          // Resolve email from user for audit (session only has userId)
          const userRow = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, createdSession.userId),
          });
          if (userRow) {
            await writeAuditEvent({
              eventType: "login_success",
              email: userRow.email,
              outcome: "success",
            });
          }
        },
      },
      delete: {
        after: async (deletedSession) => {
          const userRow = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, deletedSession.userId),
          });
          if (userRow) {
            await writeAuditEvent({
              eventType: "logout",
              email: userRow.email,
              outcome: "success",
            });
          }
        },
      },
    },
  },
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
