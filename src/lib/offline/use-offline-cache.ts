"use client";

/**
 * use-offline-cache — 033 US1:React Query 与 IDB 缓存的桥接 hook。
 *
 * research R2:用 React Query placeholderData 读 IDB 兜底,服务器成功后
 * useEffect 写回 IDB。不写 custom tRPC link(与 React Query 打架)。
 *
 * 把读/写逻辑封装在这两个 hook 里,page 改动最小化(只加 placeholderData +
 * 一个 write-back effect)。
 */
import { useEffect } from "react";

import { useAccountScope } from "@/components/pwa/account-scope-sync";
import {
  readCachedSummary,
  readCachedTransactions,
} from "@/lib/offline/cache-read";
import { writeCachedSummary, writeCachedTransactions } from "@/lib/offline/cache-write";

/**
 * Dashboard summary 的 IDB placeholder + 写回。
 *
 * 用法(dashboard/page.tsx):
 *   const summaryQuery = trpc.dashboard.summary.useQuery(
 *     { year, month },
 *     { placeholderData: useOfflineSummaryPlaceholder(year, month) }
 *   );
 *   useWriteBackSummary(year, month, summaryQuery.data);
 *
 * @returns placeholderData 函数(传给 useQuery options)
 */
export function useOfflineSummaryPlaceholder(year: number, month: number) {
  const scope = useAccountScope();
  // React Query placeholderData 签名:(previousData) => TData | undefined。
  // 我们忽略 previousData(切换年月时让 IDB 重读)。返回值 cast 为 TData
  // 形(运行时 shape 与写入时的 summary 一致,见 writeCachedSummary)。
  return async (): Promise<unknown> => {
    if (typeof indexedDB === "undefined" || !scope) return undefined;
    try {
      return (await readCachedSummary(scope, year, month)) ?? undefined;
    } catch {
      return undefined; // IDB 读失败 → 不挡 React Query 正常流
    }
  };
}

/** 服务器成功返回后,异步写回 IDB。data 变化时触发。 */
export function useWriteBackSummary(
  year: number,
  month: number,
  data: unknown,
): void {
  const scope = useAccountScope();
  useEffect(() => {
    if (!scope || !data || typeof data !== "object") return;
    writeCachedSummary(scope, year, month, data as Record<string, unknown>).catch(
      () => undefined, // 写缓存失败不阻塞 UI
    );
  }, [scope, year, month, data]);
}

/**
 * transaction.list 的 IDB placeholder + 写回。
 *
 * 注:list 是分页/cursor 结构;placeholder 返回缓存的整体结构,
 * 供 React Query 在 fetch 失败时渲染兜底。具体 shape 由调用方对齐。
 */
export function useOfflineTransactionsPlaceholder() {
  const scope = useAccountScope();
  return async () => {
    if (typeof indexedDB === "undefined" || !scope) return undefined;
    try {
      // 读近期 30 天(默认保留期)
      const cached = await readCachedTransactions(scope, 30);
      if (!cached || cached.length === 0) return undefined;
      // 返回一个最小可渲染的 list 结构(items + 无 nextCursor)。
      // page 组件按既有 shape 取用;若 shape 不完全匹配,渲染层应容忍。
      return { items: cached, nextCursor: null };
    } catch {
      return undefined;
    }
  };
}

export function useWriteBackTransactions(data: unknown): void {
  const scope = useAccountScope();
  useEffect(() => {
    if (!scope || !data || typeof data !== "object") return;
    const items = (data as { items?: unknown[] }).items;
    if (!Array.isArray(items)) return;
    writeCachedTransactions(scope, items as { id: string }[]).catch(
      () => undefined,
    );
  }, [scope, data]);
}
