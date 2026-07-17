import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpdateAlert, type UpdateAlertState } from "@/components/pwa/update-alert";

describe("UpdateAlert", () => {
  afterEach(() => cleanup());

  it("renders nothing when there is no update", () => {
    const state: UpdateAlertState = { status: "idle" };
    const { container } = render(
      <UpdateAlert state={state} onApplyNow={vi.fn()} onLater={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows 立即更新 / 稍后 when a new build is waiting", () => {
    const onApplyNow = vi.fn();
    const onLater = vi.fn();
    render(
      <UpdateAlert
        state={{ status: "available", buildId: "abcd1234" }}
        onApplyNow={onApplyNow}
        onLater={onLater}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/新版本已准备好/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "立即更新" }));
    expect(onApplyNow).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "稍后" }));
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it("disables interaction while the new worker is activating", () => {
    render(
      <UpdateAlert
        state={{ status: "applying", buildId: "abcd1234" }}
        onApplyNow={vi.fn()}
        onLater={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "立即更新" })).toBeNull();
    expect(screen.getByText(/正在激活/)).toBeTruthy();
  });

  it("offers 重试 when activation failed and does not loop silently", () => {
    const onRetry = vi.fn();
    render(
      <UpdateAlert
        state={{ status: "failed", buildId: "abcd1234", reason: "timeout" }}
        onApplyNow={vi.fn()}
        onLater={vi.fn()}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
