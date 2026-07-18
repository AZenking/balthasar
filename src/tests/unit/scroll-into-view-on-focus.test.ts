import { describe, expect, it } from "vitest";

import { computeBodyScrollDelta } from "@/lib/hooks/use-scroll-into-view-on-focus";

/**
 * T004: Pure-function tests for computeBodyScrollDelta (031 "最近优先" 策略)。
 *
 * 031 R3:scroll 只作用于 Drawer.Body 内部(不调全局 scrollIntoView)。
 * 策略(031 改造后):只在字段底部被 Body 可视底边遮挡时才向上滚,刚好让字段
 * 底部贴在 (bodyBottom - bottomMargin)。已在可视区 → 不动(保留顶部 Tabs)。
 *
 * 几何(默认 bottomMargin=16):
 * - body 可视底边 bodyBottom = bodyRect.top + bodyRect.height。
 * - desiredBottom = bodyBottom - 16。
 * - targetBottom = targetRect.top + targetRect.height。
 * - targetBottom <= desiredBottom → 不滚(currentScrollTop)。
 * - 否则 newScrollTop = currentScrollTop + (targetBottom - desiredBottom)。
 */
describe("computeBodyScrollDelta (031 最近优先策略)", () => {
  // body: top 100, height 400 → bodyBottom 500, desiredBottom 484 (默认 margin 16)。
  const bodyRect = { top: 100, bottom: 500, height: 400 } as DOMRect;

  it("returns currentScrollTop when target is already fully visible (bottom within desiredBottom)", () => {
    // target: top 200, height 40 → bottom 240 <= 484 → 不滚
    const visible = { top: 200, bottom: 240, height: 40 } as DOMRect;
    expect(computeBodyScrollDelta(visible, bodyRect, 0)).toBe(0);
  });

  it("returns currentScrollTop when target bottom exactly equals desiredBottom (boundary)", () => {
    // target bottom = 484 = desiredBottom → 不滚(<=)
    const atEdge = { top: 444, bottom: 484, height: 40 } as DOMRect;
    expect(computeBodyScrollDelta(atEdge, bodyRect, 0)).toBe(0);
  });

  it("scrolls up just enough when target bottom is below desiredBottom", () => {
    // target: top 460, height 40 → bottom 500; desiredBottom 484 → delta 16
    const below = { top: 460, bottom: 500, height: 40 } as DOMRect;
    expect(computeBodyScrollDelta(below, bodyRect, 0)).toBe(16);
  });

  it("scrolls up by the full overshoot when target is far below", () => {
    // target: top 500, height 40 → bottom 540; desiredBottom 484 → delta 56
    const farBelow = { top: 500, bottom: 540, height: 40 } as DOMRect;
    expect(computeBodyScrollDelta(farBelow, bodyRect, 0)).toBe(56);
  });

  it("does NOT scroll when target is near the top (keeps top Tabs visible — FR-008)", () => {
    // target 在 body 顶部(top 110, bottom 150),远高于 desiredBottom → 不滚
    // 这正是 031 改策略的目的:聚焦金额(Tabs 正下方)不再把 Tabs 推出去。
    const nearTop = { top: 110, bottom: 150, height: 40 } as DOMRect;
    expect(computeBodyScrollDelta(nearTop, bodyRect, 0)).toBe(0);
  });

  it("respects current scrollTop (offsets compose)", () => {
    // 已滚 50;字段底部仍在 desiredBottom 之下 → newScrollTop = 50 + 56
    const farBelow = { top: 500, bottom: 540, height: 40 } as DOMRect;
    expect(computeBodyScrollDelta(farBelow, bodyRect, 50)).toBe(106);
  });

  it("honors a custom bottomMargin", () => {
    // margin=100 → desiredBottom = 400;target bottom 500 → delta 100
    const below = { top: 460, bottom: 500, height: 40 } as DOMRect;
    expect(computeBodyScrollDelta(below, bodyRect, 0, 100)).toBe(100);
  });

  it("returns currentScrollTop (no-op) when body has no height (degenerate)", () => {
    const flat = { top: 100, bottom: 100, height: 0 } as DOMRect;
    const target = { top: 100, bottom: 140, height: 40 } as DOMRect;
    expect(computeBodyScrollDelta(target, flat, 42)).toBe(42);
  });
});
