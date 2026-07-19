"use client";

/**
 * offline-signal — 033 US3 / FR-002:"离线模式" 判定逻辑。
 *
 * research R2:banner 信号判定抽成纯函数便于单测。
 *
 * 注意:本 feature 的"离线" UI 提示**复用既有 ConnectivityAlert**
 * (src/components/pwa/connectivity-alert.tsx,挂载于 app-shell.tsx),它读
 * PwaProvider 的 connectivity.stableOnline(navigator.onLine + 服务可达性)。
 * 因此本模块只提供纯函数 computeOfflineMode 作为判定逻辑的文档化来源,
 * 暂不重复造 hook/banner(YAGNI)。未来若需要更细粒度(如区分"完全离线"vs
 * "服务可达但 query 失败"),可在此扩展并接入 React Query。
 */

interface OfflineState {
  onLine: boolean;
  hasQueryError: boolean; // 服务器 query 失败
}

/**
 * 纯函数:从状态判定是否处于"离线模式"。
 *
 * 判定规则(research R2):
 * - onLine === false → 离线(无论 query error)
 * - onLine === true → 在线(即使 query 出错也不算离线;500 等 error 走正常 error UI)
 *
 * 即:只有 navigator.offline 才触发离线 banner。query error 在线时不触发,
 * 避免把"服务器 500"误显示为"离线"。
 */
export function computeOfflineMode(state: OfflineState): boolean {
  return !state.onLine;
}
