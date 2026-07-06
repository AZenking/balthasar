/**
 * Password strength policy (FR-003, Clarification Q2).
 *
 * NIST 800-63B aligned: length ≥ 8 + breach blocklist, NO forced complexity.
 *
 * Pure domain function — no IO. Tests in password-policy.test.ts cover:
 * - Boundary at 8 chars (7 fails, 8 passes if not blocklisted)
 * - Blocklist hits (e.g., "password", "12345678", "qwerty123")
 * - Unicode passwords counted by UTF-16 code unit (NIST allows either)
 */

const MIN_LENGTH = 8;

/**
 * Top weak passwords from OWASP / SecLists common-1k.
 * Truncated to ~50 entries for MVP; expand via external file in V2 if needed.
 */
const WEAK_PASSWORD_BLOCKLIST = new Set<string>([
  "12345678",
  "password",
  "password1",
  "password123",
  "qwerty123",
  "11111111",
  "00000000",
  "12341234",
  "iloveyou",
  "admin123",
  "letmein1",
  "welcome1",
  "monkey123",
  "football",
  "baseball",
  "dragon12",
  "sunshine",
  "princess",
  "superman",
  "trustno1",
  "abc12345",
  "asdfasdf",
  "qwertyui",
  "1q2w3e4r",
  "passw0rd",
  "p@ssw0rd",
  "p@ssword",
  "111111ab",
  "98765432",
  "123456789",
  "1234567890",
  "qwerty1!",
  "1qaz2wsx",
  "zaq12wsx",
  "!qaz2wsx",
  "welcome!",
  "changeme",
  "guest1234",
  "default1",
  "master12",
  "test1234",
  "root1234",
  "toor1234",
  "flower12",
  "summer12",
  "winter12",
  "spring12",
  "autumn123",
  "michael1",
  "jennifer",
]);

export interface PasswordPolicyResult {
  ok: boolean;
  reason?: "too_short" | "weak_password";
  minLength: number;
}

export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < MIN_LENGTH) {
    return { ok: false, reason: "too_short", minLength: MIN_LENGTH };
  }
  if (WEAK_PASSWORD_BLOCKLIST.has(password.toLowerCase())) {
    return { ok: false, reason: "weak_password", minLength: MIN_LENGTH };
  }
  return { ok: true, minLength: MIN_LENGTH };
}

export const PASSWORD_MIN_LENGTH = MIN_LENGTH;
