import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConnectivityAlert } from "@/components/pwa/connectivity-alert";

afterEach(cleanup);

describe("ConnectivityAlert", () => {
  it("announces browser offline without blocking the main content", () => {
    render(<ConnectivityAlert connectivity={{ stableOnline: false, pendingOnline: null, pendingSince: null, serviceReachability: "unknown" }} />);
    expect(screen.getByRole("status").textContent).toContain("当前离线");
  });

  it("calls an unavailable service an outage, not device offline", () => {
    render(<ConnectivityAlert connectivity={{ stableOnline: true, pendingOnline: null, pendingSince: null, serviceReachability: "unreachable" }} />);
    expect(screen.getByRole("status").textContent).toContain("服务暂不可用");
    expect(screen.getByRole("status").textContent).not.toContain("当前离线");
  });
});
