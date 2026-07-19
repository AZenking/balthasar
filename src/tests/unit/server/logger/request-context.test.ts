import { describe, it, expect, beforeEach } from "vitest";

/**
 * T007: AsyncLocalStorage request-context tests (FR-001, research.md R2).
 *
 * Verifies the two critical invariants of the hybrid requestId propagation:
 *  1. Same requestId survives across `await` boundaries within one request.
 *  2. Concurrent requests (independent async scopes) get isolated stores.
 *
 * Also verifies the fail-open contract: getRequestContext() outside any
 * request scope returns null (no throw).
 */

import {
  startRequestContext,
  getRequestContext,
  setUserId,
} from "@/lib/request-context";

describe("request-context — AsyncLocalStorage isolation (FR-001, R2)", () => {
  beforeEach(() => {
    // No global reset needed — ALS isolates by async scope.
  });

  it("returns null outside any request scope (fail-open)", () => {
    expect(getRequestContext()).toBeNull();
  });

  it("preserves requestId across await boundaries within one scope", async () => {
    const requestId = "req-aaa-111";
    await startRequestContext(requestId, async () => {
      expect(getRequestContext()?.requestId).toBe(requestId);
      expect(getRequestContext()?.userId).toBeNull();

      // await an empty microtask
      await Promise.resolve();
      expect(getRequestContext()?.requestId).toBe(requestId);

      // await a real timer
      await new Promise((r) => setTimeout(r, 5));
      expect(getRequestContext()?.requestId).toBe(requestId);

      // mutate userId mid-request
      setUserId("user-bbb-222");
      expect(getRequestContext()?.userId).toBe("user-bbb-222");
    });

    // after scope exits, no context again
    expect(getRequestContext()).toBeNull();
  });

  it("isolates two concurrent requests (no cross-contamination)", async () => {
    const observed: string[] = [];

    const makeRequest = (id: string, delayMs: number) =>
      startRequestContext(id, async () => {
        // interleave: read id at start, sleep, read again at end
        const startId = getRequestContext()?.requestId;
        await new Promise((r) => setTimeout(r, delayMs));
        const endId = getRequestContext()?.requestId;
        observed.push(`${id}:${startId === id && endId === id ? "isolated" : "CROSS-CONTAMINATED"}`);
      });

    // Two concurrent requests with overlapping execution windows.
    // If ALS were broken (e.g. global var), the second to start would
    // overwrite the first's store and we'd see CROSS-CONTAMINATED.
    await Promise.all([makeRequest("req-111", 10), makeRequest("req-222", 5)]);

    expect(observed).toContain("req-111:isolated");
    expect(observed).toContain("req-222:isolated");
    expect(observed).not.toContain(expect.stringContaining("CROSS-CONTAMINATED"));
  });

  it("supports nested startRequestContext (inner restores outer on exit)", async () => {
    const outer = "req-outer";
    const inner = "req-inner";
    await startRequestContext(outer, async () => {
      expect(getRequestContext()?.requestId).toBe(outer);
      await startRequestContext(inner, async () => {
        expect(getRequestContext()?.requestId).toBe(inner);
      });
      // ALS.run restores the prior store automatically
      expect(getRequestContext()?.requestId).toBe(outer);
    });
  });
});
