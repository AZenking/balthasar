/**
 * queue-state — 033 US2 / 契约 sync-queue C2:待同步队列状态机(纯函数)。
 *
 * pending → syncing → (2xx|409: delete | 4xx 永久: delete | 401: failed 立即 |
 *                       5xx/network: retry++ pending,达上限 failed)
 */
import type { PendingQueueRow } from "./db";

export type PendingItem = PendingQueueRow;

export const MAX_RETRY = 5;

/** fetch 结果分类(由 flush 实际响应推导)。 */
export type FetchResult =
  | { kind: "ok"; status: number }
  | { kind: "dedup"; status: 409 }
  | { kind: "client-error"; status: number; message?: string }
  | { kind: "server-error"; status: number; message?: string }
  | { kind: "network-error" };

export type NextAction =
  | { kind: "delete" }
  | { kind: "update"; item: PendingItem };

/**
 * 纯函数:给定当前 item(应处于 syncing)与 fetch 结果,返回下一步动作。
 */
export function nextState(item: PendingItem, result: FetchResult): NextAction {
  if (result.kind === "ok" || result.kind === "dedup") {
    return { kind: "delete" };
  }

  // 401:认证失效,立即 failed(不重试)
  if (result.kind === "client-error" && result.status === 401) {
    return {
      kind: "update",
      item: { ...item, status: "failed", lastError: "auth" },
    };
  }

  // 4xx 永久(非 401):drop(坏数据,不重试)
  if (result.kind === "client-error") {
    return { kind: "delete" };
  }

  // 5xx / network:retry++,未达上限 → pending;已达上限 → failed(不再增)
  // retryCount = 已重试次数。retryCount >= MAX_RETRY 表示已重试 MAX_RETRY 次 → failed。
  if (item.retryCount >= MAX_RETRY) {
    return {
      kind: "update",
      item: {
        ...item,
        status: "failed",
        retryCount: item.retryCount,
        lastError: result.kind === "network-error" ? "network" : String(result.status),
      },
    };
  }
  const nextRetry = item.retryCount + 1;
  // 增后达上限 → failed;否则 pending 继续
  if (nextRetry >= MAX_RETRY) {
    return {
      kind: "update",
      item: {
        ...item,
        status: "failed",
        retryCount: nextRetry,
        lastError: result.kind === "network-error" ? "network" : String(result.status),
      },
    };
  }
  return {
    kind: "update",
    item: {
      ...item,
      status: "pending",
      retryCount: nextRetry,
      lastError: result.kind === "network-error" ? "network" : String(result.status),
    },
  };
}
