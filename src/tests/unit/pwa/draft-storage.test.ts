import { describe, expect, it, vi } from "vitest";
import { createDraftStorage } from "@/lib/pwa/draft-storage";

class MemoryStorage {
  store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
}

const form = { type: "expense" as const, accountId: "a", toAccountId: "", categoryId: "c", amount: "12.50", remark: "lunch", occurredAt: "2026-07-16" };
const transferForm = { type: "transfer" as const, accountId: "a", toAccountId: "b", categoryId: "", amount: "100", remark: "move", occurredAt: "2026-07-16" };

describe("transaction draft storage", () => {
  it("round-trips a user-scoped complete draft and clears precisely", () => {
    const storage = new MemoryStorage();
    const drafts = createDraftStorage(storage, () => new Date("2026-07-16T00:00:00Z"));
    drafts.saveNow("A", form);
    expect(drafts.read("A")).toMatchObject({ kind: "valid", draft: { userScope: "A", form } });
    expect(drafts.read("B")).toEqual({ kind: "scope-mismatch" });
    drafts.clear();
    expect(drafts.read("A")).toEqual({ kind: "absent" });
  });

  it("preserves every field on round-trip including transfer fields", () => {
    const storage = new MemoryStorage();
    const drafts = createDraftStorage(storage, () => new Date("2026-07-16T00:00:00Z"));
    drafts.saveNow("A", transferForm);
    const result = drafts.read("A");
    expect(result).toMatchObject({
      kind: "valid",
      draft: {
        form: transferForm,
        status: "editing",
        attemptedAt: null,
      },
    });
  });

  it("expires and removes stale, corrupted, or unknown-version records", () => {
    const storage = new MemoryStorage();
    const drafts = createDraftStorage(storage, () => new Date("2026-07-18T00:00:01Z"));
    storage.setItem("balthasar.pwa.transaction-draft.v1", "not json");
    expect(drafts.read("A")).toEqual({ kind: "corrupt" });
    expect(storage.getItem("balthasar.pwa.transaction-draft.v1")).toBeNull();

    // Unknown schema version is also corrupt and must be discarded.
    storage.setItem(
      "balthasar.pwa.transaction-draft.v1",
      JSON.stringify({ schemaVersion: 99, data: {} }),
    );
    expect(drafts.read("A")).toEqual({ kind: "corrupt" });
  });

  it("expires drafts past the 24h TTL and clears them", () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const now = new Date("2026-07-16T00:00:00Z");
    const drafts = createDraftStorage(storage, () => now);
    drafts.saveNow("A", form);
    // 24h + 1ms later
    now.setTime(now.getTime() + 24 * 60 * 60 * 1000 + 1);
    expect(drafts.read("A")).toEqual({ kind: "expired" });
    expect(storage.getItem("balthasar.pwa.transaction-draft.v1")).toBeNull();
    vi.useRealTimers();
  });

  it("debounces writes for 300ms and can flush immediately", () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const drafts = createDraftStorage(storage, () => new Date("2026-07-16T00:00:00Z"));
    drafts.schedule("A", form);
    expect(storage.store.size).toBe(0);
    // Scheduling again resets the timer.
    drafts.schedule("A", { ...form, amount: "20" });
    vi.advanceTimersByTime(299);
    expect(storage.store.size).toBe(0);
    vi.advanceTimersByTime(1);
    const result = drafts.read("A");
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.draft.form.amount).toBe("20");
    }
    vi.useRealTimers();
  });

  it("flush completes the pending write synchronously on pagehide / visibilitychange", () => {
    const storage = new MemoryStorage();
    const drafts = createDraftStorage(storage, () => new Date("2026-07-16T00:00:00Z"));
    drafts.schedule("A", form);
    expect(storage.store.size).toBe(0);
    const outcome = drafts.flush();
    expect(outcome.kind).toBe("saved");
    expect(storage.store.size).toBe(1);
  });

  it("degrades safely when localStorage throws on read or write", () => {
    const failingRead = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => {},
      removeItem: () => {},
    };
    const draftsRO = createDraftStorage(failingRead as unknown as Storage);
    expect(draftsRO.read("A")).toEqual({ kind: "absent" });

    const failingWrite = {
      getItem: () => null,
      setItem: () => { throw new Error("denied"); },
      removeItem: () => {},
    };
    const draftsWO = createDraftStorage(failingWrite as unknown as Storage);
    expect(draftsWO.saveNow("A", form)).toEqual({ kind: "failed" });
    expect(draftsWO.flush()).toEqual({ kind: "idle" });
  });

  it("marks a draft uncertain without clearing it, so the controller can disable auto-retry", () => {
    const storage = new MemoryStorage();
    const drafts = createDraftStorage(storage, () => new Date("2026-07-16T00:00:00Z"));
    drafts.saveNow("A", form);
    const outcome = drafts.markUncertain("A");
    expect(outcome.kind).toBe("marked");
    const after = drafts.read("A");
    expect(after.kind).toBe("valid");
    if (after.kind === "valid") {
      expect(after.draft.status).toBe("uncertain");
      expect(after.draft.attemptedAt).not.toBeNull();
    }
  });

  it("refuses to mark uncertain when no draft or wrong scope exists", () => {
    const storage = new MemoryStorage();
    const drafts = createDraftStorage(storage, () => new Date("2026-07-16T00:00:00Z"));
    expect(drafts.markUncertain("A").kind).toBe("absent");
    drafts.saveNow("A", form);
    expect(drafts.markUncertain("B").kind).toBe("scope-mismatch");
  });
});
