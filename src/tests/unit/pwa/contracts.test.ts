import { describe, expect, it } from "vitest";

import {
  PWA_SCHEMA_VERSION,
  createConnectivityState,
  parseVersionedEnvelope,
  transitionConnectivity,
} from "@/lib/pwa/contracts";

describe("PWA runtime contracts", () => {
  it("rejects a payload with an unknown schema version", () => {
    const result = parseVersionedEnvelope({
      schemaVersion: PWA_SCHEMA_VERSION + 1,
      data: { value: "draft" },
    });

    expect(result).toEqual({ ok: false, reason: "unknown-version" });
  });

  it("rejects corrupted storage payloads without throwing", () => {
    expect(parseVersionedEnvelope("not-json")).toEqual({
      ok: false,
      reason: "invalid-payload",
    });
    expect(parseVersionedEnvelope({ schemaVersion: PWA_SCHEMA_VERSION })).toEqual({
      ok: false,
      reason: "invalid-payload",
    });
  });

  it("debounces browser connectivity changes until the configured stability window passes", () => {
    const initial = createConnectivityState(true);
    const pending = transitionConnectivity(initial, false, 1_000);

    expect(pending.stableOnline).toBe(true);
    expect(pending.pendingOnline).toBe(false);
    expect(transitionConnectivity(pending, false, 1_299).stableOnline).toBe(true);
    expect(transitionConnectivity(pending, false, 1_300).stableOnline).toBe(false);
  });

  it("keeps service reachability distinct from browser offline state", () => {
    const initial = createConnectivityState(true);
    const unreachable = transitionConnectivity(initial, "unreachable", 2_000);

    expect(unreachable.stableOnline).toBe(true);
    expect(unreachable.serviceReachability).toBe("unreachable");
  });
});
