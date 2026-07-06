/**
 * Account validation pure functions (research.md Q6 — domain layer).
 *
 * Per spec FR-002 (name) + FR-004 (initialBalance) + SC-005 (Unicode):
 * - Name: 1-50 chars by UTF-16 code unit (covers emoji edge cases)
 * - initialBalance: integer in Number.MAX_SAFE_INTEGER range, allows negative
 *
 * No IO. zod schema in procedures calls these for fine-grained error messages.
 */
export const ACCOUNT_NAME_MIN_LENGTH = 1;
export const ACCOUNT_NAME_MAX_LENGTH = 50;

export interface NameValidation {
  ok: boolean;
  reason?: "too_short" | "too_long";
  length: number;
}

export function validateAccountName(name: string): NameValidation {
  // JS .length counts UTF-16 code units (1 per BMP char, 2 per surrogate pair).
  // Matches NIST/accounting convention; emoji surrogate pairs cost 2.
  const length = name.length;
  if (length < ACCOUNT_NAME_MIN_LENGTH) {
    return { ok: false, reason: "too_short", length };
  }
  if (length > ACCOUNT_NAME_MAX_LENGTH) {
    return { ok: false, reason: "too_long", length };
  }
  return { ok: true, length };
}

export interface BalanceValidation {
  ok: boolean;
  reason?: "not_integer" | "out_of_safe_range";
}

/**
 * Validate initial balance input.
 *
 * - Integer (no fractional 分)
 * - Within JS Number.MAX_SAFE_INTEGER range (≤ 2^53 - 1)
 * - Negative allowed (credit card / loan scenario)
 */
export function validateInitialBalance(value: unknown): BalanceValidation {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, reason: "not_integer" };
  }
  if (!Number.isInteger(value)) {
    return { ok: false, reason: "not_integer" };
  }
  if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    return { ok: false, reason: "out_of_safe_range" };
  }
  return { ok: true };
}
