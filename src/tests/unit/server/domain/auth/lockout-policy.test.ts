import { describe, expect, it } from "vitest";
import {
  decideLockout,
  nextFailureState,
  LOCKOUT_THRESHOLD,
  LOCKOUT_DURATION_MS,
  type LockoutState,
} from "@/server/domain/auth/lockout-policy";

/**
 * T046: Unit tests for lockout-policy (FR-009, Clarification Q4).
 *
 * Pure decision function — no IO, no clock side effects (uses injected `now`).
 */
describe("lockout-policy", () => {
  const NOW = new Date("2026-07-06T12:00:00Z");

  describe("decideLockout", () => {
    it("allows when no prior state (first attempt)", () => {
      const result = decideLockout(null, NOW);
      expect(result.status).toBe("allowed");
      expect(result.retryAfterSeconds).toBeUndefined();
    });

    it("allows when failed count is 0", () => {
      const state: LockoutState = {
        failedCount: 0,
        lockedUntil: null,
        lastAttemptAt: NOW,
      };
      const result = decideLockout(state, NOW);
      expect(result.status).toBe("allowed");
    });

    it("allows when within failure threshold (count < 5) and not locked", () => {
      const state: LockoutState = {
        failedCount: 3,
        lockedUntil: null,
        lastAttemptAt: NOW,
      };
      const result = decideLockout(state, NOW);
      expect(result.status).toBe("allowed");
    });

    it("locks when lockedUntil > now", () => {
      const lockedUntil = new Date(NOW.getTime() + 4 * 60 * 1000); // 4 min remaining
      const state: LockoutState = {
        failedCount: 5,
        lockedUntil,
        lastAttemptAt: NOW,
      };
      const result = decideLockout(state, NOW);
      expect(result.status).toBe("locked");
      expect(result.retryAfterSeconds).toBe(240); // 4 min in seconds
    });

    it("allows when lockout window expired (lockedUntil <= now)", () => {
      const lockedUntil = new Date(NOW.getTime() - 1000); // expired 1 sec ago
      const state: LockoutState = {
        failedCount: 5,
        lockedUntil,
        lastAttemptAt: new Date(NOW.getTime() - LOCKOUT_DURATION_MS - 1000),
      };
      const result = decideLockout(state, NOW);
      expect(result.status).toBe("allowed");
      // Note: counter reset is the hook's responsibility, not decideLockout's
    });

    it("retryAfterSeconds rounds up to at least 1", () => {
      const lockedUntil = new Date(NOW.getTime() + 500); // 0.5 sec remaining
      const state: LockoutState = {
        failedCount: 5,
        lockedUntil,
        lastAttemptAt: NOW,
      };
      const result = decideLockout(state, NOW);
      expect(result.status).toBe("locked");
      expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });
  });

  describe("nextFailureState", () => {
    it("increments from null state to 1 (no lockout)", () => {
      const result = nextFailureState(null, NOW);
      expect(result.failedCount).toBe(1);
      expect(result.lockedUntil).toBeNull();
      expect(result.triggeredLockout).toBe(false);
    });

    it("increments existing counter", () => {
      const state: LockoutState = {
        failedCount: 2,
        lockedUntil: null,
        lastAttemptAt: NOW,
      };
      const result = nextFailureState(state, NOW);
      expect(result.failedCount).toBe(3);
      expect(result.triggeredLockout).toBe(false);
    });

    it(`triggers lockout at threshold (${LOCKOUT_THRESHOLD})`, () => {
      const state: LockoutState = {
        failedCount: LOCKOUT_THRESHOLD - 1,
        lockedUntil: null,
        lastAttemptAt: NOW,
      };
      const result = nextFailureState(state, NOW);
      expect(result.failedCount).toBe(LOCKOUT_THRESHOLD);
      expect(result.triggeredLockout).toBe(true);
      expect(result.lockedUntil).toEqual(new Date(NOW.getTime() + LOCKOUT_DURATION_MS));
    });

    it("resets counter when window expired (starts fresh from 1)", () => {
      const state: LockoutState = {
        failedCount: 5,
        lockedUntil: new Date(NOW.getTime() - 1000), // expired
        lastAttemptAt: new Date(NOW.getTime() - LOCKOUT_DURATION_MS - 1000),
      };
      const result = nextFailureState(state, NOW);
      expect(result.failedCount).toBe(1);
      expect(result.triggeredLockout).toBe(false);
      expect(result.lockedUntil).toBeNull();
    });

    it("sets lastAttemptAt to now", () => {
      const result = nextFailureState(null, NOW);
      expect(result.lastAttemptAt).toEqual(NOW);
    });
  });

  describe("constants", () => {
    it("LOCKOUT_THRESHOLD is 5", () => {
      expect(LOCKOUT_THRESHOLD).toBe(5);
    });

    it("LOCKOUT_DURATION_MS is 5 minutes", () => {
      expect(LOCKOUT_DURATION_MS).toBe(5 * 60 * 1000);
    });
  });
});
