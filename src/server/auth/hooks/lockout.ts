import "server-only";
import { db } from "@/server/db/client";
import { authFailureCounter } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  decideLockout,
  nextFailureState,
  type LockoutDecision,
  type LockoutState,
} from "@/server/domain/auth/lockout-policy";

/**
 * T050-T052: Login lockout hooks (FR-009, Clarification Q4).
 *
 * Three operations, all DB-backed (per research.md Q3):
 *   checkLockoutByEmail  → read counter, return decision (allowed | locked)
 *   recordLoginFailure   → increment counter, possibly trigger lockout
 *   clearLoginFailures   → on successful login, delete counter row
 *
 * Per Clarification Q4: when locked, decision carries `retryAfterSeconds`
 * which the login procedure surfaces to the user (SC-007).
 *
 * These are NOT Better-Auth `databaseHooks` (those only fire on user/session
 * create/delete, not on sign-in). They are pure functions the auth router's
 * `login` procedure calls around the `auth.api.signInEmail` invocation.
 *
 * Phase 4 wires these in src/server/api/routers/auth.ts login procedure.
 */

export type { LockoutDecision, LockoutState };

/**
 * T050: Pre-flight check before credential validation.
 * Returns the decision (allowed | locked + retryAfterSeconds).
 * Does NOT mutate state — caller is responsible for using the result.
 */
export async function checkLockoutByEmail(email: string): Promise<LockoutDecision> {
  const rows = await db
    .select()
    .from(authFailureCounter)
    .where(eq(authFailureCounter.email, email))
    .limit(1);

  const state: LockoutState | null = rows[0]
    ? {
        failedCount: rows[0].failedCount,
        lockedUntil: rows[0].lockedUntil,
        lastAttemptAt: rows[0].lastAttemptAt,
      }
    : null;

  return decideLockout(state);
}

/**
 * T051: Record a failed login attempt.
 * Increments the counter; triggers lockout (sets locked_until) at threshold.
 * Returns whether this failure caused the lockout (for audit purposes).
 */
export async function recordLoginFailure(
  email: string
): Promise<{ triggeredLockout: boolean; retryAfterSeconds?: number }> {
  const existing = await db
    .select()
    .from(authFailureCounter)
    .where(eq(authFailureCounter.email, email))
    .limit(1);

  const currentState: LockoutState | null = existing[0]
    ? {
        failedCount: existing[0].failedCount,
        lockedUntil: existing[0].lockedUntil,
        lastAttemptAt: existing[0].lastAttemptAt,
      }
    : null;

  const next = nextFailureState(currentState);

  if (existing[0]) {
    await db
      .update(authFailureCounter)
      .set({
        failedCount: next.failedCount,
        lockedUntil: next.lockedUntil,
        lastAttemptAt: next.lastAttemptAt,
      })
      .where(eq(authFailureCounter.email, email));
  } else {
    await db.insert(authFailureCounter).values({
      email,
      failedCount: next.failedCount,
      lockedUntil: next.lockedUntil,
      lastAttemptAt: next.lastAttemptAt,
    });
  }

  return {
    triggeredLockout: next.triggeredLockout,
    retryAfterSeconds: next.lockedUntil
      ? Math.ceil((next.lockedUntil.getTime() - Date.now()) / 1000)
      : undefined,
  };
}

/**
 * T052: Clear all failures for an email (called on successful login).
 * Removes the counter row entirely.
 */
export async function clearLoginFailures(email: string): Promise<void> {
  await db
    .delete(authFailureCounter)
    .where(eq(authFailureCounter.email, email));
}
