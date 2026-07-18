import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstallSection } from "@/components/pwa/install-section";

describe("InstallSection", () => {
  afterEach(cleanup);
  it("calls the Chromium install action only after an explicit user press", () => {
    const onInstall = vi.fn();
    render(
      <InstallSection
        state={{ mode: "prompt", canInstall: true }}
        onInstall={onInstall}
        variant="settings"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "安装应用" }));
    expect(onInstall).toHaveBeenCalledOnce();
  });

  it("explains the manual iOS flow without attempting a native prompt", () => {
    render(
      <InstallSection
        state={{ mode: "ios-guide", canInstall: false }}
        onInstall={vi.fn()}
        variant="settings"
      />,
    );

    expect(screen.getByText("分享 → 添加到主屏幕")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "安装应用" })).toBeNull();
  });

  it("renders no install entry point in standalone mode", () => {
    const { container } = render(
      <InstallSection
        state={{ mode: "installed", canInstall: false }}
        onInstall={vi.fn()}
        variant="settings"
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("keeps the settings entry visible even after the proactive CTA is suppressed", () => {
    render(
      <InstallSection
        state={{ mode: "prompt", canInstall: true }}
        onInstall={vi.fn()}
        variant="settings"
      />,
    );
    expect(screen.getByRole("button", { name: "安装应用" })).toBeTruthy();
  });

  it("refuses to render a proactive CTA that has been suppressed", () => {
    const { container } = render(
      <InstallSection
        state={{ mode: "prompt", canInstall: true }}
        onInstall={vi.fn()}
        variant="cta"
        visible={false}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders a dismissible proactive CTA when visible", () => {
    const onDismiss = vi.fn();
    render(
      <InstallSection
        state={{ mode: "prompt", canInstall: true }}
        onInstall={vi.fn()}
        variant="cta"
        visible
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "稍后" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
