import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const beginLogout = vi.fn();

vi.mock("@/components/pwa/pwa-provider", () => ({
  usePwaRuntime: () => ({
    privacy: { beginLogout, locked: false },
    install: { state: { mode: "unsupported", canInstall: false }, request: vi.fn() },
    connectivity: {
      stableOnline: true,
      pendingOnline: null,
      pendingSince: null,
      serviceReachability: "unknown",
    },
  }),
}));

import { LogoutSection } from "@/components/pwa/logout-section";

describe("LogoutSection", () => {
  afterEach(() => {
    cleanup();
    beginLogout.mockClear();
  });

  beforeEach(() => {
    beginLogout.mockReset();
  });

  it("opens an AlertDialog to confirm before any lock or signOut fires", () => {
    render(<LogoutSection />);
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    // Cancel keeps everything untouched.
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(beginLogout).not.toHaveBeenCalled();
  });

  it("starts the privacy-preserving logout flow only after the user confirms", async () => {
    beginLogout.mockResolvedValue({ ok: true });
    render(<LogoutSection />);
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    const confirm = screen.getAllByRole("button", { name: "退出登录" }).pop()!;
    fireEvent.click(confirm);
    expect(beginLogout).toHaveBeenCalledTimes(1);
  });

  it("keeps the confirmation button enabled when the prior attempt failed so the user can retry", async () => {
    beginLogout.mockResolvedValue({ ok: false, reason: "网络中断" });
    render(<LogoutSection />);
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    const confirm = screen.getAllByRole("button", { name: "退出登录" }).pop()!;
    fireEvent.click(confirm);
    await vi.waitFor(() => expect(beginLogout).toHaveBeenCalledTimes(1));
    // The confirm button must not be permanently disabled by a failed attempt.
    expect(confirm.getAttribute("disabled")).toBeNull();
  });
});
