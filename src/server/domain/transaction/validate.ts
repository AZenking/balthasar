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
 *
 * 027 (research R1): transfer stores +abs(正数)。余额计算时转出账户减、
 * 转入账户(toAccountId)加。applySign 对 transfer 返回 abs。
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

/**
 * Validate a transfer's source/target accounts (027 FR-014)。
 *
 * 转出账户与转入账户为同一账户时拒绝(避免自转)。
 * 账户存在性 / 同 family / 未归档校验由 procedure 层 validateAccountAndCategory
 * 负责(需 DB 访问);本纯函数只校验"不同 id"这一条无 IO 不变量。
 */
export function validateTransfer(
  accountId: string,
  toAccountId: string,
): { ok: boolean; reason?: "same_account" } {
  if (accountId === toAccountId) {
    return { ok: false, reason: "same_account" };
  }
  return { ok: true };
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
