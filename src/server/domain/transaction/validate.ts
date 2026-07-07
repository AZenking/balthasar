import type { TransactionType } from "@/server/db/schema";

/**
 * Transaction domain pure functions (004-transaction, research.md Q1).
 *
 * - applySign: converts frontend positive amount to signed DB value
 *   (income → positive, expense → negative)
 * - validateOccurredAt: ensures date is not too far in the future
 * - validateRemark: ensures remark length ≤ 200
 *
 * No IO. Unit-testable.
 */

/**
 * Convert frontend positive amount to signed DB storage value.
 *
 * Per Clarification Q1: income stores positive, expense stores negative.
 * Frontend always sends positive; server applies sign based on type.
 */
export function applySign(type: TransactionType, amount: number): number {
  if (amount === 0) return 0;
  return type === "expense" ? -Math.abs(amount) : Math.abs(amount);
}

/**
 * Convert DB signed amount back to positive for frontend display.
 */
export function toDisplayAmount(signedAmount: number): number {
  return Math.abs(signedAmount);
}

export const REMARK_MAX_LENGTH = 200;
export const OCCURRED_AT_FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Validate occurredAt is not too far in the future.
 * Per FR-008 + Clarification Q2: UTC comparison, tolerance ±1 day.
 */
export function validateOccurredAt(date: Date, now: Date = new Date()): {
  ok: boolean;
  reason?: "future_date";
} {
  const maxFuture = new Date(now.getTime() + OCCURRED_AT_FUTURE_TOLERANCE_MS);
  if (date > maxFuture) {
    return { ok: false, reason: "future_date" };
  }
  return { ok: true };
}

/**
 * Validate remark length ≤ 200 characters.
 * Per FR-009: allows empty string (default "").
 */
export function validateRemark(remark: string): {
  ok: boolean;
  reason?: "too_long";
  length: number;
} {
  const length = remark.length;
  if (length > REMARK_MAX_LENGTH) {
    return { ok: false, reason: "too_long", length };
  }
  return { ok: true, length };
}
