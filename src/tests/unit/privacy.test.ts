/**
 * T-unit: Unit tests for privacy mode helpers (026-cream-amber-revamp, R5).
 *
 * Covers the PrivacyState contract (data-model.md §2.8):
 *   - default value is `false` on empty storage
 *   - write/read round-trip is consistent
 *   - toggle flips state
 *   - `<html>.classList['privacy-on']` stays in sync with localStorage
 *   - SSR / quota / private-mode failures degrade to `false`, never throw
 *
 * Environment note: this project's `unit` vitest project runs under node
 * (vitest.config.ts), and neither `jsdom` nor `happy-dom` is installed.
 * Rather than pull a DOM package into devDependencies for one util, we
 * stub `localStorage` and `document.documentElement.classList` with
 * minimal in-memory fakes via `vi.stubGlobal`. The stubs are reset
 * between tests in `beforeEach`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRIVACY_STORAGE_KEY,
  isPrivacyOn,
  setPrivacy,
  togglePrivacy,
} from "@/lib/privacy";

// ─── In-memory fakes ───────────────────────────────────────────────

class FakeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

class FakeClassList {
  private classes = new Set<string>();
  add(cls: string): void {
    this.classes.add(cls);
  }
  remove(cls: string): void {
    this.classes.delete(cls);
  }
  contains(cls: string): boolean {
    return this.classes.has(cls);
  }
  // DOM spec signature: toggle(token, force?) — when `force` is a boolean,
  // add if true, remove if false.
  toggle(cls: string, force?: boolean): boolean {
    const shouldAdd = typeof force === "boolean" ? force : !this.classes.has(cls);
    if (shouldAdd) this.classes.add(cls);
    else this.classes.delete(cls);
    return shouldAdd;
  }
  _reset(): void {
    this.classes.clear();
  }
}

let fakeStorage: FakeLocalStorage;
let fakeClassList: FakeClassList;

function stubDom(): void {
  fakeStorage = new FakeLocalStorage();
  fakeClassList = new FakeClassList();
  vi.stubGlobal("localStorage", fakeStorage);
  vi.stubGlobal("document", {
    documentElement: { classList: fakeClassList },
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("privacy helpers", () => {
  beforeEach(() => {
    stubDom();
  });

  // 1. Default value: empty localStorage → privacy off.
  it("isPrivacyOn returns false when storage is empty", () => {
    expect(isPrivacyOn()).toBe(false);
  });

  // 2. Write/read consistency.
  it("setPrivacy(true) then isPrivacyOn() === true; setPrivacy(false) then === false", () => {
    setPrivacy(true);
    expect(isPrivacyOn()).toBe(true);
    expect(localStorage.getItem(PRIVACY_STORAGE_KEY)).toBe("1");

    setPrivacy(false);
    expect(isPrivacyOn()).toBe(false);
    expect(localStorage.getItem(PRIVACY_STORAGE_KEY)).toBe("0");
  });

  // 3. toggle flips the current state.
  it("togglePrivacy flips false → true → false", () => {
    expect(isPrivacyOn()).toBe(false);
    togglePrivacy();
    expect(isPrivacyOn()).toBe(true);
    togglePrivacy();
    expect(isPrivacyOn()).toBe(false);
  });

  // 4. <html>.classList['privacy-on'] stays in sync.
  it("setPrivacy toggles the 'privacy-on' class on documentElement", () => {
    setPrivacy(true);
    expect(document.documentElement.classList.contains("privacy-on")).toBe(true);

    setPrivacy(false);
    expect(document.documentElement.classList.contains("privacy-on")).toBe(false);
  });

  // 5. localStorage.getItem throwing (Safari private mode / disabled) →
  //    isPrivacyOn degrades to false, never throws.
  it("isPrivacyOn returns false (no throw) when localStorage.getItem throws", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("quota / private mode");
    });
    expect(() => isPrivacyOn()).not.toThrow();
    expect(isPrivacyOn()).toBe(false);
  });

  // 6. localStorage.setItem throwing (quota exceeded) → setPrivacy still
  //    flips the DOM class for the current session and never throws.
  it("setPrivacy does not throw when localStorage.setItem throws (DOM class still flips)", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => setPrivacy(true)).not.toThrow();
    // DOM class still mirrors intent even though storage failed — gives
    // the user immediate feedback for this session.
    expect(document.documentElement.classList.contains("privacy-on")).toBe(true);
  });
});
