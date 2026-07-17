import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DraftRecoveryDialog } from "@/components/pwa/draft-recovery-dialog";

describe("DraftRecoveryDialog", () => {
  afterEach(() => cleanup());

  it("shows only the saved timestamp, never account/amount/category fields", () => {
    render(
      <DraftRecoveryDialog
        isOpen
        savedAt="2026-07-16 14:31"
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/2026-07-16 14:31/)).toBeTruthy();
    // Account names, amounts and categories must not appear — those are the
    // private fields the dialog deliberately hides until the user opts in.
    expect(screen.queryByText(/账户|金额|分类|备注/)).toBeNull();
  });

  it("invokes onRestore when the user chooses 恢复", () => {
    const onRestore = vi.fn();
    const onDiscard = vi.fn();
    render(
      <DraftRecoveryDialog
        isOpen
        savedAt="2026-07-16 14:31"
        onRestore={onRestore}
        onDiscard={onDiscard}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "恢复" }));
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("invokes onDiscard when the user chooses 丢弃", () => {
    const onRestore = vi.fn();
    const onDiscard = vi.fn();
    render(
      <DraftRecoveryDialog
        isOpen
        savedAt="2026-07-16 14:31"
        onRestore={onRestore}
        onDiscard={onDiscard}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "丢弃" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("does not auto-fill when the user closes without picking (Esc / backdrop)", () => {
    const onRestore = vi.fn();
    const onDiscard = vi.fn();
    const onClose = vi.fn();
    render(
      <DraftRecoveryDialog
        isOpen
        savedAt="2026-07-16 14:31"
        onRestore={onRestore}
        onDiscard={onDiscard}
        onClose={onClose}
      />,
    );
    // Pressing the explicit "稍后" path keeps the draft in storage but does
    // not touch the form. Restore and discard are both inert.
    fireEvent.click(screen.getByRole("button", { name: "稍后" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
  });
});
