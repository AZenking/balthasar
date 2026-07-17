/**
 * T004 (029-mobile-keyboard-layout Foundational) — useScrollIntoViewOnFocus hook 单元测试。
 *
 * 项目既定模式:unit project environment 是 node(无 jsdom),不测 React 集成,
 * 只测 hook 暴露的常量契约(`SCROLL_INTO_VIEW_OPTIONS`、`KEYBOARD_ANIMATION_DELAY_MS`)
 * 与 helper(`isFocusableElement`)。
 *
 * 宪章原则四:测试优先。
 */
import { describe, expect, it } from "vitest";
import {
  KEYBOARD_ANIMATION_DELAY_MS,
  SCROLL_INTO_VIEW_OPTIONS,
} from "@/lib/hooks/use-scroll-into-view-on-focus";

describe("useScrollIntoViewOnFocus — contract constants", () => {
  it("SCROLL_INTO_VIEW_OPTIONS targets center alignment (not nearest)", () => {
    // 'block: center' 是 spec FR-001 的可测代理 —— 'nearest' 仍可能让字段
    // 部分留在键盘后面。research.md R2 决策。
    expect(SCROLL_INTO_VIEW_OPTIONS).toEqual({
      behavior: "smooth",
      block: "center",
    });
  });

  it("KEYBOARD_ANIMATION_DELAY_MS is 300 (iOS keyboard ≈ 250ms + 50ms margin)", () => {
    // research.md R2:rAF + setTimeout(300) 等待 iOS 键盘动画完成,
    // 太短(< 200ms)会导致 scrollIntoView 在键盘还没到位时调用,
    // 太长(> 500ms)用户感知延迟。
    expect(KEYBOARD_ANIMATION_DELAY_MS).toBe(300);
  });
});
