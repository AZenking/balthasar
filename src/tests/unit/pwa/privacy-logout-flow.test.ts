import { describe, expect, it, vi } from "vitest";
import { performPrivacyLogout } from "@/lib/pwa/privacy-logout-flow";

function makeApis(overrides: Partial<{
  signOut: ReturnType<typeof vi.fn>;
  verifySessionCleared: ReturnType<typeof vi.fn>;
  lock: ReturnType<typeof vi.fn>;
  unlock: ReturnType<typeof vi.fn>;
  clearAllCaches: ReturnType<typeof vi.fn>;
  reloadToLogin: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    lock: overrides.lock ?? vi.fn(),
    unlock: overrides.unlock ?? vi.fn(),
    clearAllCaches: overrides.clearAllCaches ?? vi.fn(),
    signOut: overrides.signOut ?? vi.fn().mockResolvedValue({ error: null }),
    verifySessionCleared:
      overrides.verifySessionCleared ?? vi.fn().mockResolvedValue({ data: null, error: null }),
    reloadToLogin: overrides.reloadToLogin ?? vi.fn(),
  };
}

describe("performPrivacyLogout", () => {
  it("locks and clears caches before any network call", async () => {
    const apis = makeApis();
    await performPrivacyLogout(apis);
    expect(apis.lock).toHaveBeenCalledTimes(1);
    expect(apis.clearAllCaches).toHaveBeenCalledTimes(1);
    const lockOrder = apis.lock.mock.invocationCallOrder[0];
    const cacheOrder = apis.clearAllCaches.mock.invocationCallOrder[0];
    const signOutOrder = apis.signOut.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(cacheOrder);
    expect(cacheOrder).toBeLessThan(signOutOrder!);
  });

  it("unlocks and reloads only after getSession confirms the session is gone", async () => {
    const apis = makeApis();
    await performPrivacyLogout(apis);
    expect(apis.verifySessionCleared).toHaveBeenCalledTimes(1);
    expect(apis.unlock).toHaveBeenCalledTimes(1);
    expect(apis.reloadToLogin).toHaveBeenCalledTimes(1);
  });

  it("keeps the lock when signOut returns an error and surfaces a retryable reason", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: { message: "network down" } });
    const apis = makeApis({ signOut });
    const outcome = await performPrivacyLogout(apis);
    expect(outcome).toEqual({ ok: false, reason: "network down" });
    expect(apis.unlock).not.toHaveBeenCalled();
    expect(apis.reloadToLogin).not.toHaveBeenCalled();
  });

  it("keeps the lock when getSession still resolves to a session", async () => {
    const verifySessionCleared = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const apis = makeApis({ verifySessionCleared });
    const outcome = await performPrivacyLogout(apis);
    expect(outcome.ok).toBe(false);
    expect(apis.unlock).not.toHaveBeenCalled();
  });

  it("keeps the lock when getSession itself errors", async () => {
    const verifySessionCleared = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "503" } });
    const apis = makeApis({ verifySessionCleared });
    const outcome = await performPrivacyLogout(apis);
    expect(outcome).toEqual({ ok: false, reason: "503" });
    expect(apis.unlock).not.toHaveBeenCalled();
  });

  it("keeps the lock when signOut throws", async () => {
    const signOut = vi.fn().mockRejectedValue(new Error("timeout"));
    const apis = makeApis({ signOut });
    const outcome = await performPrivacyLogout(apis);
    expect(outcome).toEqual({ ok: false, reason: "timeout" });
    expect(apis.unlock).not.toHaveBeenCalled();
  });
});
