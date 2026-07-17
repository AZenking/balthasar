"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * useScrollIntoViewOnFocus — 029-mobile-keyboard-layout Foundational hook.
 *
 * 当 Drawer/Modal 内的表单字段聚焦时,在 iOS 键盘动画(~250ms)完成之后主动
 * scrollIntoView,让聚焦字段滚到可视区域中心。research.md R2 决策。
 *
 * 为什么不依赖 HeroUI/React Aria 自带的 focus scroll?
 *   GitHub issue heroui-inc/heroui#6447 指出 React Aria 在 Modal scroll="inside"
 *   下的 scrollIntoView 可能"卡住"。我们在 HeroUI 外层加薄薄 workaround
 *   (spec clarification Q2 允许),用 rAF + setTimeout 显式等键盘动画完成。
 *
 * 宪章原则七合规:Hook 不替换 HeroUI 组件,只在容器层加 ref 回调。
 */

/**
 * iOS 键盘滑出动画 ≈ 250ms,加 50ms 余量。
 * 太短会与键盘动画竞态;太长用户感知"延迟"。
 */
export const KEYBOARD_ANIMATION_DELAY_MS = 300;

/**
 * scrollIntoView 调用参数契约。
 *
 * block: "center" —— 把聚焦字段滚到 Drawer.Body 视觉中心(不是 nearest,
 *   nearest 仍可能让字段部分留在键盘之后)。
 * behavior: "smooth" —— 与 Drawer.Body 的 native scrolling 配合,避免瞬时跳变。
 */
export const SCROLL_INTO_VIEW_OPTIONS = {
  behavior: "smooth",
  block: "center",
} as const;

/**
 * ref callback:挂到表单根容器(`<form>` 或 wrapping `<div>`)。
 *
 * 监听 `focusin`(focus 事件的冒泡版本),任意子字段聚焦时触发。
 * 用 focusin 而非 focus 是为了支持事件委托 —— 不需要给每个输入框单独绑。
 */
export function useScrollIntoViewOnFocus<T extends HTMLElement = HTMLElement>() {
  // 跟踪已绑定的 node + cleanup,避免 React 18+ Strict Mode 重复挂载。
  const cleanupRef = useRef<(() => void) | null>(null);

  return useCallback((node: T | null) => {
    // 卸载旧 node 的事件
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!node) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.scrollIntoView !== "function") return;
      // 双重保险:rAF 确保 React 渲染完毕,setTimeout 等键盘动画完成。
      requestAnimationFrame(() => {
        window.setTimeout(() => {
          target.scrollIntoView(SCROLL_INTO_VIEW_OPTIONS);
        }, KEYBOARD_ANIMATION_DELAY_MS);
      });
    };

    node.addEventListener("focusin", handleFocusIn);
    cleanupRef.current = () => {
      node.removeEventListener("focusin", handleFocusIn);
    };
  }, []);
}

/**
 * 同步 effect 版本(可选):用于已存在的 ref 不能改造的场景。
 *
 * 通常 ref callback 模式更好(无需 effect + dependency),但若组件已有 forwardRef
 * 或必须用 useEffect,可以用本 helper。
 */
export function useScrollIntoViewOnFocusEffect<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.scrollIntoView !== "function") return;
      requestAnimationFrame(() => {
        window.setTimeout(() => {
          target.scrollIntoView(SCROLL_INTO_VIEW_OPTIONS);
        }, KEYBOARD_ANIMATION_DELAY_MS);
      });
    };

    node.addEventListener("focusin", handleFocusIn);
    return () => {
      node.removeEventListener("focusin", handleFocusIn);
    };
  }, []);

  return ref;
}
