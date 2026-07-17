/**
 * T009' (029-mobile-keyboard-layout US1) — computeFooterPaddingBottom 纯函数单测。
 *
 * 项目既定模式:unit project environment 是 node(无 jsdom),不测 React 组件。
 * 把 TransactionForm embedded 根 div 的 paddingBottom 计算抽为纯函数,便于 TDD。
 *
 * 宪章原则四:测试优先。
 */
import { describe, expect, it } from "vitest";
import {
  computeFooterPaddingBottom,
  SUBMIT_BUTTON_BOTTOM_GAP_PX,
} from "@/components/transaction/compute-footer-padding-bottom";

describe("computeFooterPaddingBottom", () => {
  it("returns only the safe gap when no keyboard (desktop / keyboard closed)", () => {
    expect(computeFooterPaddingBottom(0)).toBe(SUBMIT_BUTTON_BOTTOM_GAP_PX);
  });

  it("returns keyboardHeight + gap when keyboard open", () => {
    // Typical iOS keyboard height ≈ 336px on iPhone 12.
    expect(computeFooterPaddingBottom(336)).toBe(336 + SUBMIT_BUTTON_BOTTOM_GAP_PX);
  });

  it("clamps negative keyboard height to 0 (rotation edge case)", () => {
    expect(computeFooterPaddingBottom(-50)).toBe(SUBMIT_BUTTON_BOTTOM_GAP_PX);
  });

  it("handles very tall keyboard (iPad slide-over)", () => {
    expect(computeFooterPaddingBottom(700)).toBe(700 + SUBMIT_BUTTON_BOTTOM_GAP_PX);
  });

  it("SUBMIT_BUTTON_BOTTOM_GAP_PX is 16 (spec FR-002: 按钮始终在键盘上方 16px)", () => {
    expect(SUBMIT_BUTTON_BOTTOM_GAP_PX).toBe(16);
  });
});
