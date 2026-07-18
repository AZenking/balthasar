import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deriveInstallState,
  NO_INSTALL_PREFERENCE,
  readInstallPreference,
  writeInstallPreference,
  isInstallSuppressed,
  shouldShowProactiveInstallCTA,
} from "@/lib/pwa/install-state";

class MemoryStorage {
  store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
}

describe("install state", () => {
  it("offers the deferred Chromium install action only when it is usable", () => {
    expect(
      deriveInstallState({
        userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
        standalone: false,
        hasDeferredPrompt: true,
      })
    ).toMatchObject({ mode: "prompt", canInstall: true });
  });

  it("shows manual Home Screen guidance on iOS", () => {
    expect(
      deriveInstallState({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1",
        standalone: false,
        hasDeferredPrompt: false,
      })
    ).toMatchObject({ mode: "ios-guide", canInstall: false });
  });

  it("hides all install entry points when already standalone", () => {
    expect(
      deriveInstallState({
        userAgent: "Chrome",
        standalone: true,
        hasDeferredPrompt: true,
      })
    ).toMatchObject({ mode: "installed", canInstall: false });
  });

  it("falls back to ordinary web when install APIs are unavailable", () => {
    expect(
      deriveInstallState({
        userAgent: "Firefox",
        standalone: false,
        hasDeferredPrompt: false,
      })
    ).toMatchObject({ mode: "unavailable", canInstall: false });
  });
});

describe("install preference (V1)", () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("reads a trusted V1 envelope and ignores malformed payloads", () => {
    writeInstallPreference(storage, {
      dismissed: false,
      suppressUntil: null,
      coreActionPromptedAt: null,
      installedAt: null,
    });
    expect(readInstallPreference(storage, 0)).toEqual(NO_INSTALL_PREFERENCE);

    storage.setItem(
      "balthasar.pwa.install-pref.v1",
      JSON.stringify({ schemaVersion: 99, data: { dismissed: true } }),
    );
    expect(readInstallPreference(storage, 0)).toEqual(NO_INSTALL_PREFERENCE);

    storage.setItem("balthasar.pwa.install-pref.v1", "not json");
    expect(readInstallPreference(storage, 0)).toEqual(NO_INSTALL_PREFERENCE);
  });

  it("is suppressed for 30 days after the user dismisses the proactive CTA", () => {
    const now = 1_700_000_000_000;
    writeInstallPreference(storage, {
      dismissed: true,
      suppressUntil: now + 30 * 24 * 60 * 60 * 1000,
      coreActionPromptedAt: null,
      installedAt: null,
    });
    expect(isInstallSuppressed(readInstallPreference(storage, now), now)).toBe(true);
    expect(isInstallSuppressed(readInstallPreference(storage, now + 30 * 24 * 60 * 60 * 1000 + 1), now + 30 * 24 * 60 * 60 * 1000 + 1)).toBe(false);
  });

  it("shows the proactive CTA only once per core-action milestone, when not suppressed, and never when installed", () => {
    const now = 1_700_000_000_000;
    expect(
      shouldShowProactiveInstallCTA({
        preference: NO_INSTALL_PREFERENCE,
        mode: "prompt",
        hasReachedCoreActionMilestone: true,
        now,
      })
    ).toBe(true);

    // After the CTA has been shown once for this milestone, it stays quiet.
    expect(
      shouldShowProactiveInstallCTA({
        preference: { ...NO_INSTALL_PREFERENCE, coreActionPromptedAt: now },
        mode: "prompt",
        hasReachedCoreActionMilestone: true,
        now,
      })
    ).toBe(false);

    // Dismissed + within 30 days → silent.
    expect(
      shouldShowProactiveInstallCTA({
        preference: { ...NO_INSTALL_PREFERENCE, dismissed: true, suppressUntil: now + 1000 },
        mode: "prompt",
        hasReachedCoreActionMilestone: true,
        now,
      })
    ).toBe(false);

    // Standalone / iOS / unsupported → never proactively prompt.
    expect(
      shouldShowProactiveInstallCTA({
        preference: NO_INSTALL_PREFERENCE,
        mode: "installed",
        hasReachedCoreActionMilestone: true,
        now,
      })
    ).toBe(false);

    // No milestone yet — wait until the user actually succeeds at the core action.
    expect(
      shouldShowProactiveInstallCTA({
        preference: NO_INSTALL_PREFERENCE,
        mode: "prompt",
        hasReachedCoreActionMilestone: false,
        now,
      })
    ).toBe(false);
  });
});
