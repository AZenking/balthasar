import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  broadcastPwaEvent,
  clearPrivacyLock,
  isPrivacyLocked,
  lockPrivacy,
  subscribePwaBroadcast,
} from "@/lib/pwa/privacy-lock";

class MemoryStorage {
  store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
}

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  listeners = new Set<(message: { data: unknown }) => void>();
  posted: unknown[] = [];
  name: string;
  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }
  postMessage(data: unknown) {
    this.posted.push(data);
    for (const other of FakeBroadcastChannel.instances) {
      if (other === this) continue;
      for (const listener of other.listeners) listener({ data });
    }
  }
  addEventListener(_type: string, listener: (message: { data: unknown }) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: string, listener: (message: { data: unknown }) => void) {
    this.listeners.delete(listener);
  }
  close() {
    FakeBroadcastChannel.instances = FakeBroadcastChannel.instances.filter((c) => c !== this);
  }
}

describe("privacy lock", () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists lock and writes a non-sensitive pending logout marker", () => {
    lockPrivacy();
    expect(isPrivacyLocked()).toBe(true);
    expect(document.cookie).toContain("balthasar.pwa.pending_logout=1");
  });

  it("remains locked until an explicit confirmed completion clears it", () => {
    lockPrivacy();
    clearPrivacyLock();
    expect(isPrivacyLocked()).toBe(false);
  });

  it("broadcasts PRIVACY_LOCKED and LOGOUT_COMPLETED to other tabs", () => {
    const received: string[] = [];
    const unsubscribe = subscribePwaBroadcast((event) => {
      received.push((event as { type: string }).type);
    });

    lockPrivacy();
    // The subscribing channel sees the broadcast posted by lockPrivacy.
    expect(received).toContain("PRIVACY_LOCKED");

    clearPrivacyLock();
    expect(received).toContain("LOGOUT_COMPLETED");

    unsubscribe();
  });

  it("falls back to storage events when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const storageListeners = new Set<(event: StorageEvent) => void>();
    vi.stubGlobal("window", {
      addEventListener: (_type: string, listener: (event: StorageEvent) => void) =>
        storageListeners.add(listener),
      removeEventListener: (_type: string, listener: (event: StorageEvent) => void) =>
        storageListeners.delete(listener),
    });

    const received: string[] = [];
    subscribePwaBroadcast((event) => {
      received.push((event as { type: string }).type);
    });

    lockPrivacy();
    // Manually trigger the storage event the fallback path writes for other tabs.
    const payload = JSON.stringify({ type: "PRIVACY_LOCKED" });
    for (const listener of storageListeners) {
      listener({ key: "balthasar.pwa.broadcast.v1", newValue: payload } as StorageEvent);
    }
    expect(received).toContain("PRIVACY_LOCKED");
  });

  it("keeps the lock on the failing tab so retry can run from the lock screen", () => {
    lockPrivacy();
    // Simulate a failed signOut by NOT calling clearPrivacyLock.
    expect(isPrivacyLocked()).toBe(true);
    expect(() => broadcastPwaEvent({ type: "PRIVACY_LOCKED" })).not.toThrow();
  });
});
