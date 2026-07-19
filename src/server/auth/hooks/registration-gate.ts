import "server-only";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema/auth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * 013-simple-deploy: registration gate hook.
 *
 * Mounted on Better-Auth `databaseHooks.user.create.before` to enforce:
 *   - FR-024: first user (when user table is empty) is always allowed to register
 *     and becomes the family owner / admin.
 *   - FR-025: subsequent registrations are rejected unless the operator explicitly
 *     sets `ALLOW_REGISTRATION=true` in the environment.
 *
 * Throwing inside `before` rolls back the user insert (Better-Auth runs the hook
 * in the adapter's transaction), so a rejected registration leaves no row behind.
 *
 * Error code `REGISTRATION_CLOSED` is matched by the client to render the
 * "registration closed" message and a 4xx response (FR-026).
 *
 * 034-observability-logging (T035/T036): emits `auth.first_user_bypass` info
 * when the first user bypasses the ALLOW_REGISTRATION=false gate (the bootstrap
 * moment that grants admin ownership — high-value audit signal), and
 * `auth.rate_limited` warn when registration is rejected by the gate (augments
 * Better-Auth's own rate limiter with an audit trail).
 *
 * Decision rationale: see specs/013-simple-deploy/research.md Q1/Q2.
 * The same hook works for both simple-deploy (013) and prod-deploy (012).
 */
export const registrationGate = {
  user: {
    create: {
      before: async (incoming: {
        id?: string;
        email: string;
        name?: string | null | undefined;
      }): Promise<void> => {
        const userCount = await db.$count(user);

        // First user ever → always allowed. They become admin via the
        // family-init hook running in `user.create.after`.
        if (userCount === 0) {
          // FR-008 / T035: audit the bootstrap-bypass moment. The email
          // itself is redacted by pino (FR-004); we log only the event.
          try {
            logger.info(
              {
                event: "auth.first_user_bypass",
                path: "auth.signUp",
                source: "domain",
                // userId unknown yet (user not inserted); incoming.id may be
                // set by Better-Auth before the row exists. Use it if present.
                userId: incoming.id ?? null,
              },
              "first-user registration bypassed ALLOW_REGISTRATION gate",
            );
          } catch {
            // fail-open: log errors must not block registration (FR-010)
          }
          return;
        }

        // Subsequent registrations require an explicit opt-in.
        if (env.ALLOW_REGISTRATION !== "true") {
          // T036 (lightweight): a REGISTRATION_CLOSED reject is a soft
          // rate-limit / probe signal — operators may want to spot patterns.
          // (Better-Auth's own rate limit at /sign-up/email is the primary
          // throttle; this augments with an audit-trail event.)
          try {
            logger.warn(
              {
                event: "auth.rate_limited",
                path: "auth.signUp",
                source: "domain",
                userId: null,
                reason: "REGISTRATION_CLOSED",
              },
              "registration rejected (gate closed)",
            );
          } catch {
            // fail-open
          }
          const err = new Error("REGISTRATION_CLOSED");
          err.name = "REGISTRATION_CLOSED";
          throw err;
        }
      },
    },
  },
} as const;
