/**
 * Email normalization (FR-015).
 *
 * Pure domain function — no IO, no framework dependencies.
 * Per Clarification Q1 / research.md Q4: trim + lowercase only.
 *
 * Uniqueness is enforced at the DB layer (Better-Auth schema has UNIQUE
 * on `email`); this function ensures the value stored is canonical before
 * Better-Auth sees it.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Lightweight email format check (research.md Q4).
 *
 * Intentionally permissive: rejects obvious typos but accepts valid edge
 * cases (RFC 5322 strict would reject real addresses with `+` aliases or
 * new TLDs). Full validation is "user clicks verify link" (V2 feature).
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlausibleEmail(raw: string): boolean {
  return EMAIL_REGEX.test(raw);
}
