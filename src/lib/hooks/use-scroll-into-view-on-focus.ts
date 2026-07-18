"use client";

import { useCallback, useRef } from "react";

/**
 * useScrollIntoViewOnFocus — 031-drawer-keyboard-and-tabs Foundational hook
 * (在 029 的基础上改造)。
 *
 * ## 为什么改造(031 R1 / R3)
 * 029 的实现聚焦时调用**全局** `target.scrollIntoView({ block: "center" })`。
 * 在 iOS Safari/PWA 上,该调用会滚动最近的可滚动祖先——可能是 <html>/<body> 或
 * Visual Viewport——而不是 Drawer.Body,于是 `position: fixed`(相对 window)的
 * Drawer.Content 被带着上移,产生"Drawer 底部与键盘之间空隙 + 背景页透出"。
 *
 * 031 收敛为:**只调整 Drawer.Body(scroll container)自身的 scrollTop**,物理上
 * 不可能带动 fixed 祖先。同时去掉 029 的 300ms setTimeout(高度钳制 R2 已让字段在
 * 键盘动画期间可见),并加 rAF 去抖(spec FR-007)。
 *
 * ## 用法
 * ```tsx
 * const { scrollContainerRef, attachRef } = useScrollIntoViewOnFocus<HTMLDivElement>();
 * <div ref={scrollContainerRef}>        {/* = Drawer.Body,overflow:auto *​/}
 *   <form ref={attachRef}>{...}</form>  {/* focusin 委托根 *​/}
 * </div>
 * ```
 *
 * 宪章原则七合规:不替换 HeroUI 组件,只在容器层加 ref 回调协调滚动。
 */

/**
 * 纯函数:计算聚焦字段所需的 scrollTop 新值(031 改造后的"最近优先"策略)。
 *
 * 抽出来便于在 node 环境(无 DOM)单测(宪章原则四只测纯函数)。
 *
 * ## 策略演变(031 R3)
 * 029 用"滚到中心"(block:center),会把聚焦字段强制移到 Body 视觉中心,
 * 连带把 Tabs 等顶部内容推出可视区(031 FR-008 要求 Tabs 始终可见)。
 *
 * 031 改为"最近优先 + 底部留白":只在字段**底部**降到 Body 可视区底部以下
 * (减去 bottomMargin,模拟键盘上沿留白)时才向上滚,刚好让字段底部贴在
 * (可视区底部 - bottomMargin)。字段已在可视区 → 不动,顶部 Tabs 不被推出。
 *
 * 几何:
 * - body 可视底边 `bodyBottom = bodyRect.top + bodyRect.height`。
 * - 字段底边 `targetBottom = targetRect.top + targetRect.height`。
 * - 期望字段底边停在 `bodyBottom - bottomMargin`。
 * - 若 targetBottom <= bodyBottom - bottomMargin:已够可见,不动(currentScrollTop)。
 * - 否则内容需上移 `targetBottom - (bodyBottom - bottomMargin)`,
 *   scrollTop 增加同量。
 *
 * @returns 新的 scrollTop 值;已可见或 body 无高度时返回 currentScrollTop。
 */
export function computeBodyScrollDelta(
  targetRect: DOMRect,
  bodyRect: DOMRect,
  currentScrollTop: number,
  bottomMargin = 16,
): number {
  if (bodyRect.height === 0) return currentScrollTop;
  const bodyBottom = bodyRect.top + bodyRect.height;
  const targetBottom = targetRect.top + targetRect.height;
  const desiredBottom = bodyBottom - bottomMargin;
  if (targetBottom <= desiredBottom) return currentScrollTop; // 已可见
  return currentScrollTop + (targetBottom - desiredBottom);
}

/**
 * React hook:订阅 attachRef 节点的 `focusin`(冒泡),任意子字段聚焦时,
 * 用"最近优先"策略调整 scrollContainerRef(Drawer.Body)的 scrollTop
 * (见 computeBodyScrollDelta):只在字段底部被遮挡时才向上滚一点,
 * 保持顶部 Tabs 始终可见(031 FR-008)。
 *
 * - **不调用** `target.scrollIntoView`(消除 iOS fixed 容器被滚的根因)。
 * - 用 `requestAnimationFrame` 等 React 渲染完毕;新 focusin 进来时
 *   `cancelAnimationFrame` 上一个 pending(去抖,FR-007)。
 * - ref callback 用 cleanup 模式,避免 React 18+ Strict Mode 重复挂载。
 */
export function useScrollIntoViewOnFocus<T extends HTMLElement = HTMLElement>(): {
  /** 指向可滚动容器(Drawer.Body)。hook 修改它的 scrollTop。 */
  scrollContainerRef: React.RefObject<T | null>;
  /** 挂到表单根(`<form>` 或 wrapping `<div>`)。focusin 事件委托根。 */
  attachRef: (node: T | null) => void;
} {
  const scrollContainerRef = useRef<T | null>(null);
  // 跟踪 pending rAF id + 已绑 node 的 cleanup(Strict Mode 安全)。
  const rafIdRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const attachRef = useCallback((node: T | null) => {
    // 卸载旧 node
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    // 清掉残留 pending rAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (!node) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      const container = scrollContainerRef.current;
      if (!container) return; // 防御:容器未挂载时不动作

      // 去抖:新 focusin 取消上一个 pending rAF(FR-007)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const targetRect = target.getBoundingClientRect();
        const bodyRect = container.getBoundingClientRect();
        container.scrollTop = computeBodyScrollDelta(
          targetRect,
          bodyRect,
          container.scrollTop,
        );
      });
    };

    node.addEventListener("focusin", handleFocusIn);
    cleanupRef.current = () => {
      node.removeEventListener("focusin", handleFocusIn);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  return { scrollContainerRef, attachRef };
}
