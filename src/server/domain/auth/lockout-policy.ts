/**
 * Lockout policy (FR-009, Clarification Q4).
 *
 * Pure decision function — given the current counter state and the current
 * time, decide whether a login attempt should be:
 * - "allowed"            → proceed with credential check
 * - "locked"             → reject with retryAfterSeconds in response
 *
 * Per Clarification Q4: when locked, the response MUST explicitly say
 * "已锁定,请 N 分钟后重试" (not a generic error).
 *
 * Threshold: 5 consecutive failures → 5-minute lockout window.
 */

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export interface LockoutDecision {
  status: "allowed" | "locked";
  retryAfterSeconds?: number;
}

export interface LockoutState {
  failedCount: number;
  lockedUntil: Date | null;
  lastAttemptAt: Date;
}

/**
 * Decide whether to allow or reject a login attempt given the current state.
 *
 * Note: this function does NOT mutate state — the caller (lockout.hook.ts)
 * is responsible for incrementing counters / setting locked_until based on
 * the outcome of the credential check.
 */
export function decideLockout(
  state: LockoutState | null,
  now: Date = new Date()
): LockoutDecision {
  // No prior failures — allow.
  if (!state || state.failedCount === 0) {
    return { status: "allowed" };
  }

  // Locked and still within window — reject with remaining time.
  if (state.lockedUntil && state.lockedUntil > now) {
    const remainingMs = state.lockedUntil.getTime() - now.getTime();
    return {
      status: "locked",
      retryAfterSeconds: Math.ceil(remainingMs / 1000),
    };
  }

  // Window expired (locked_until is past) — treat as unlocked.
  // The hook should reset failedCount to 0 on next attempt.
  return { status: "allowed" };
}

/**
 * Compute the next state after a failure.
 * Returns the values to persist in auth_failure_counters.
 */
export function nextFailureState(
  current: LockoutState | null,
  now: Date = new Date()
): {
  failedCount: number;
  lockedUntil: Date | null;
  lastAttemptAt: Date;
  /** True if this failure transitioned the counter to a locked state. */
  triggeredLockout: boolean;
} {
  const prevCount = current?.failedCount ?? 0;
  // If the window expired, start fresh (1 failure on this attempt).
  const isWindowExpired =
    current?.lockedUntil !== null && current?.lockedUntil !== undefined
      ? current.lockedUntil <= now
      : false;

  const newCount = isWindowExpired ? 1 : prevCount + 1;
  const triggeredLockout = newCount >= LOCKOUT_THRESHOLD;
  const lockedUntil = triggeredLockout
    ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
    : null;

  return {
    failedCount: newCount,
    lockedUntil,
    lastAttemptAt: now,
    triggeredLockout,
  };
}
