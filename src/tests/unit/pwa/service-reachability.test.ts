import { describe, expect, it } from "vitest";
import { classifyRequestOutcome } from "@/lib/pwa/service-reachability";

describe("service reachability classification", () => {
  it("marks a successful real request as reachable", () => {
    expect(classifyRequestOutcome({ kind: "success" }, true)).toBe("reachable");
  });

  it.each(["network", "timeout", "5xx"] as const)("marks %s failures unavailable while online", (kind) => {
    expect(classifyRequestOutcome({ kind }, true)).toBe("unreachable");
  });

  it("does not turn 4xx business and auth errors into service outages", () => {
    expect(classifyRequestOutcome({ kind: "4xx" }, true)).toBe("reachable");
  });

  it("does not invent a service health result while browser is offline", () => {
    expect(classifyRequestOutcome({ kind: "network" }, false)).toBe("unknown");
  });
});
