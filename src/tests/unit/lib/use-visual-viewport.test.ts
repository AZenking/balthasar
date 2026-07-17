/**
 * T003 (029-mobile-keyboard-layout Foundational) — useVisualViewport hook 单元测试。
 *
 * 项目既定模式:unit project environment 是 node(无 jsdom),不测 React 集成,
 * 只测 hook 抽出的纯函数 `computeKeyboardState`。
 *
 * 宪章原则四:测试优先 — 本文件先写并失败,再实现 hook 转绿。
 */
import { describe, expect, it } from "vitest";
import { computeKeyboardState, KEYBOARD_DETECTION_THRESHOLD } from "@/lib/hooks/use-visual-viewport";

describe("computeKeyboardState", () => {
  it("returns identity when visualViewport is null (desktop fallback)", () => {
    const state = computeKeyboardState(800, null);
    expect(state).toEqual({
      height: 800,
      offsetTop: 0,
      scale: 1,
      keyboardHeight: 0,
      isKeyboardOpen: false,
    });
  });

  it("reports no keyboard when visualViewport.height equals innerHeight", () => {
    const state = computeKeyboardState(800, {
      height: 800,
      offsetTop: 0,
      scale: 1,
    });
    expect(state.keyboardHeight).toBe(0);
    expect(state.isKeyboardOpen).toBe(false);
  });

  it("treats URL-bar noise (delta <= threshold) as not-keyboard", () => {
    // Typical mobile URL bar ≈ 50–80px. Delta 100 < threshold (150) → not keyboard.
    const state = computeKeyboardState(800, {
      height: 700,
      offsetTop: 0,
      scale: 1,
    });
    expect(state.keyboardHeight).toBe(100);
    expect(state.isKeyboardOpen).toBe(false);
  });

  it("detects keyboard when delta > threshold", () => {
    // Typical mobile virtual keyboard ≈ 250–350px.
    const state = computeKeyboardState(800, {
      height: 450,
      offsetTop: 0,
      scale: 1,
    });
    expect(state.keyboardHeight).toBe(350);
    expect(state.isKeyboardOpen).toBe(true);
  });

  it("respects exact threshold boundary (> threshold, not >=)", () => {
    const exactly = computeKeyboardState(800, {
      height: 800 - KEYBOARD_DETECTION_THRESHOLD,
      offsetTop: 0,
      scale: 1,
    });
    expect(exactly.isKeyboardOpen).toBe(false);

    const justOver = computeKeyboardState(800, {
      height: 800 - KEYBOARD_DETECTION_THRESHOLD - 1,
      offsetTop: 0,
      scale: 1,
    });
    expect(justOver.isKeyboardOpen).toBe(true);
  });

  it("clamps keyboardHeight to 0 if visualViewport is taller than window (rotation edge case)", () => {
    const state = computeKeyboardState(800, {
      height: 1000,
      offsetTop: 0,
      scale: 1,
    });
    expect(state.keyboardHeight).toBe(0);
    expect(state.isKeyboardOpen).toBe(false);
  });

  it("passes through offsetTop and scale", () => {
    const state = computeKeyboardState(800, {
      height: 500,
      offsetTop: 42,
      scale: 1.5,
    });
    expect(state.offsetTop).toBe(42);
    expect(state.scale).toBe(1.5);
    expect(state.height).toBe(500);
  });
});
