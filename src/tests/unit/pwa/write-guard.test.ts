import { describe, expect, it, vi } from "vitest";
import { guardOnlineWrite, OFFLINE_WRITE_MESSAGE } from "@/lib/pwa/write-guard";

describe("offline write guard", () => {
  it("rejects an offline write before a mutation is called", () => {
    const mutation = vi.fn();
    const notify = vi.fn();

    expect(guardOnlineWrite(false, mutation, notify)).toBe(false);
    expect(mutation).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(OFFLINE_WRITE_MESSAGE);
  });

  it("executes an online write", () => {
    const mutation = vi.fn();
    expect(guardOnlineWrite(true, mutation, vi.fn())).toBe(true);
    expect(mutation).toHaveBeenCalledOnce();
  });
});
