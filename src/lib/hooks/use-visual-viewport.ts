"use client";

import { useEffect, useState } from "react";

/**
 * useVisualViewport — 029-mobile-keyboard-layout Foundational hook.
 *
 * 跨浏览器键盘检测的唯一可靠信号(iOS Safari 把键盘当 overlay,Android 会缩小
 * layout viewport —— 见 research.md R1)。订阅 window.visualViewport 的 resize +
 * scroll 双事件,派生 keyboardHeight 与 isKeyboardOpen。
 *
 * 桌面端优雅降级(R5):window.visualViewport 存在但 innerHeight === visualViewport.height,
 * 永远不会误判 keyboard;SSR 环境(next.js server)返回 identity。
 *
 * 宪章原则六 YAGNI:不引入 polyfill 库;30 行 hook 足够。
 */

/** URL bar 显示/隐藏产生的 viewport 高度变化 ≈ 50–80px;键盘 > 150px 才视为键盘弹起。 */
export const KEYBOARD_DETECTION_THRESHOLD = 150;

export type VisualViewportState = {
  /** visualViewport.height(键盘弹起后缩小的可见高度) */
  height: number;
  /** visualViewport.offsetTop(iOS Safari toolbar 滚动偏移补偿) */
  offsetTop: number;
  /** visualViewport.scale(pinch-zoom 比例,本项目 maximumScale=1 故恒为 1) */
  scale: number;
  /** innerHeight - visualViewport.height,clamp ≥ 0(防旋转边界) */
  keyboardHeight: number;
  /** keyboardHeight > KEYBOARD_DETECTION_THRESHOLD */
  isKeyboardOpen: boolean;
};

/**
 * 纯函数:从 innerHeight + visualViewport 快照计算键盘状态。
 *
 * 抽出来便于单元测试(项目 unit 环境 = node,无 jsdom;宪章原则四只测纯函数)。
 */
export function computeKeyboardState(
  innerHeight: number,
  vv: { height: number; offsetTop: number; scale: number } | null,
): VisualViewportState {
  if (!vv) {
    return {
      height: innerHeight,
      offsetTop: 0,
      scale: 1,
      keyboardHeight: 0,
      isKeyboardOpen: false,
    };
  }
  const rawDelta = innerHeight - vv.height;
  const keyboardHeight = Math.max(0, rawDelta);
  return {
    height: vv.height,
    offsetTop: vv.offsetTop,
    scale: vv.scale,
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > KEYBOARD_DETECTION_THRESHOLD,
  };
}

const DESKTOP_IDENTITY: VisualViewportState = {
  height: 0,
  offsetTop: 0,
  scale: 1,
  keyboardHeight: 0,
  isKeyboardOpen: false,
};

/**
 * React hook:订阅 visualViewport,返回当前键盘状态。
 *
 * SSR 安全:`typeof window === "undefined"` 时返回 identity(避免 next.js server 报错)。
 * 桌面端:visualViewport 存在但 innerHeight === height,keyboardHeight 恒为 0。
 */
export function useVisualViewport(): VisualViewportState {
  // useState lazy init —— SSR 时直接返回 identity,避免 hydration mismatch。
  const [state, setState] = useState<VisualViewportState>(() => {
    if (typeof window === "undefined") return DESKTOP_IDENTITY;
    return computeKeyboardState(
      window.innerHeight,
      window.visualViewport
        ? {
            height: window.visualViewport.height,
            offsetTop: window.visualViewport.offsetTop,
            scale: window.visualViewport.scale,
          }
        : null,
    );
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const handler = () => {
      setState(
        computeKeyboardState(window.innerHeight, {
          height: vv.height,
          offsetTop: vv.offsetTop,
          scale: vv.scale,
        }),
      );
    };

    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    };
  }, []);

  return state;
}
