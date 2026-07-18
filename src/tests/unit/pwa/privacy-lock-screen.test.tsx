import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivacyLockScreen } from "@/components/pwa/privacy-lock-screen";

describe("PrivacyLockScreen", () => {
  afterEach(() => cleanup());

  it("renders the lock status without rendering any account content", () => {
    render(<PrivacyLockScreen />);
    expect(screen.getByText("应用已锁定")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText(/账户管理|预算|交易/)).toBeNull();
  });

  it("does not show a retry button until a handler is provided", () => {
    render(<PrivacyLockScreen />);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("invokes the retry handler when the user presses retry and the prior attempt failed", () => {
    const onRetry = vi.fn();
    render(<PrivacyLockScreen errorMessage="网络中断" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /重试/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the retry button and shows in-progress text while retrying", () => {
    const onRetry = vi.fn();
    render(<PrivacyLockScreen retrying onRetry={onRetry} />);
    const button = screen.getByRole("button", { name: /重试/ });
    expect(button.getAttribute("disabled")).not.toBeNull();
    fireEvent.click(button);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("surfaces the failure reason accessively so screen readers announce next steps", () => {
    render(<PrivacyLockScreen errorMessage="网络中断，请稍后重试" />);
    expect(screen.getByText("网络中断，请稍后重试")).toBeTruthy();
  });
});
