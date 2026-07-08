import "server-only";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema/auth";
import { env } from "@/lib/env";

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
        if (userCount === 0) return;

        // Subsequent registrations require an explicit opt-in.
        if (env.ALLOW_REGISTRATION !== "true") {
          const err = new Error("REGISTRATION_CLOSED");
          err.name = "REGISTRATION_CLOSED";
          throw err;
        }
      },
    },
  },
} as const;
