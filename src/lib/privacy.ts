/**
 * Privacy mode helpers (026-cream-amber-revamp, R5).
 *
 * Reads/writes a single localStorage boolean and mirrors it onto
 * `<html>.classList['privacy-on']` so CSS can hide all `[data-amount]`
 * nodes without waiting for React hydration (prevents flash of real
 * amounts — spec FR-C009).
 *
 * Contract (data-model.md §2.8):
 *   - localStorage key is fixed: `balthasar.privacy.enabled`
 *   - value is '1' (on) or '0' (off); any other / missing value = off
 *   - `<html>.classList['privacy-on']` MUST stay in sync with the stored
 *     value (inline script in layout.tsx primes it pre-hydration; the
 *     helpers here keep it in sync after user toggles)
 *
 * SSR safety: every localStorage / DOM access is wrapped in try/catch.
 * On SSR, private mode, quota-exceeded, or any other failure the helpers
 * degrade to "privacy off" and never throw (research.md R5 Risks).
 *
 * No external dependencies — pure TS.
 */

export const PRIVACY_STORAGE_KEY = "balthasar.privacy.enabled";

/**
 * Read the current privacy state from localStorage.
 *
 * Pure client-side; returns `false` whenever localStorage is unavailable
 * (SSR, Safari private mode, quota disabled) or the stored value is not
 * exactly `'1'`. Never throws.
 */
export function isPrivacyOn(): boolean {
  try {
    return localStorage.getItem(PRIVACY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Persist the privacy state and mirror it onto `<html>.classList`.
 *
 * `localStorage.setItem` is wrapped in try/catch so a full quota or a
 * disabled storage doesn't break the toggle — the DOM class still flips
 * for the current session.
 */
export function setPrivacy(enabled: boolean): void {
  try {
    localStorage.setItem(PRIVACY_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage failures (quota / disabled); DOM class below still
    // gives the user immediate feedback for this session.
  }

  try {
    document.documentElement.classList.toggle("privacy-on", enabled);
  } catch {
    // No DOM (SSR) — inline script in layout.tsx reconciles on next load.
  }
}

/**
 * Flip the current privacy state. Reads, negates, writes.
 */
export function togglePrivacy(): void {
  setPrivacy(!isPrivacyOn());
}
