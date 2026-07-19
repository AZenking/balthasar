/**
 * T019 (033 US3): offline-signal 纯函数测试。
 *
 * 033 R2 gotcha / 契约 C4:"离线模式" banner 信号由三源喂入:
 *   - navigator.onLine
 *   - online/offline 事件
 *   - q.error instanceof TRPCClientError && navigator.onLine === false
 * useSyncExternalStore 读它,避免 React Query state 直接驱动 banner 的 re-render 风暴。
 *
 * 把信号判定抽成纯函数 computeOfflineMode,便于 node 单测(无需 jsdom 事件)。
 */
import { describe, expect, it } from "vitest";

import { computeOfflineMode } from "@/lib/offline/offline-signal";

describe("computeOfflineMode (US3 / FR-002 banner 信号)", () => {
  it("navigator.onLine === false → 离线(无论 queryError)", () => {
    expect(computeOfflineMode({ onLine: false, hasQueryError: false })).toBe(true);
    expect(computeOfflineMode({ onLine: false, hasQueryError: true })).toBe(true);
  });

  it("navigator.onLine === true + 无 query error → 在线", () => {
    expect(computeOfflineMode({ onLine: true, hasQueryError: false })).toBe(false);
  });

  it("navigator.onLine === true + 有 query error → 仍在线(query 错误未必是离线)", () => {
    // 注:research R2 的判定是 error && onLine===false 才算离线兜底;
    // 在线时 query 出错(如 500)不算离线模式 —— 让正常 error UI 处理。
    expect(computeOfflineMode({ onLine: true, hasQueryError: true })).toBe(false);
  });
});
