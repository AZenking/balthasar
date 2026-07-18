import { describe, expect, it, vi } from "vitest";
import { synchronizeAccountScope } from "@/lib/pwa/account-scope";

describe("account scope", () => {
  it("clears private state exactly when server scope changes A to B or null", () => {
    const clear = vi.fn();
    expect(synchronizeAccountScope("A", "A", clear)).toBe("A");
    expect(clear).not.toHaveBeenCalled();
    expect(synchronizeAccountScope("A", "B", clear)).toBe("B");
    expect(clear).toHaveBeenCalledWith("A");
    expect(synchronizeAccountScope("B", null, clear)).toBeNull();
    expect(clear).toHaveBeenLastCalledWith("B");
  });

  it("never clears when transitioning from anonymous to a confirmed account", () => {
    const clear = vi.fn();
    expect(synchronizeAccountScope(null, "A", clear)).toBe("A");
    expect(clear).not.toHaveBeenCalled();
  });

  it("passes the OLD scope to the clearer so the caller can drop the right cache", () => {
    const clear = vi.fn();
    synchronizeAccountScope("user-1", "user-2", clear);
    expect(clear).toHaveBeenCalledWith("user-1");
    expect(clear).not.toHaveBeenCalledWith("user-2");
  });
});
