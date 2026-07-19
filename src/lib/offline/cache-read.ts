"use client";

/**
 * cache-read — 033 US1 / FR-002 / FR-003:network-first 服务器失败时,从 IDB 兜底。
 *
 * 契约 C2:服务器请求失败 → 回退缓存;正常/弱网 → 服务器优先。
 * 调用方(React Query placeholderData)在 fetch 失败时拿到缓存的 placeholder。
 *
 * 返回值与 tRPC 响应 shape 对齐(调用方用 placeholderData 注入,不重新包装)。
 * 读取按 familyId scope 隔离(契约 C3)。
 */
import { ensureDB, type CachedTransactionRow, type CachedSummaryRow } from "./db";
import { summaryKey } from "./cache-write";

/** 返回保留期起点 ms(now - retentionDays)。供范围查询用。 */
export function sinceDateForRetention(retentionDays: number, now: number): number {
  return now - retentionDays * 24 * 60 * 60 * 1000;
}

/**
 * 读近期缓存的交易(occurredAt >= since),按 occurredAt DESC。
 * 用于 transaction.list 的 placeholderData。返回原始 shape(去 cachedAt/familyId)。
 *
 * @returns 缓存行数组(去掉 familyId/cachedAt);无缓存 → null
 */
export async function readCachedTransactions(
  familyId: string,
  retentionDays: number,
): Promise<Omit<CachedTransactionRow, "familyId" | "cachedAt">[] | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await ensureDB();
  const since = sinceDateForRetention(retentionDays, Date.now());
  const all = (await db.getAllFromIndex(
    "transactions",
    "familyId_occurredAt",
  )) as CachedTransactionRow[];
  // familyId scope 隔离 + 保留期过滤 + 去掉内部字段
  const kept = all
    .filter((r) => r.familyId === familyId)
    .filter((r) => {
      const occ = r.occurredAt;
      if (occ == null) return false;
      const ms =
        typeof occ === "number" ? occ : new Date(occ as string).getTime();
      return ms >= since;
    })
    .sort((a, b) => {
      // occurredAt DESC
      const am = toMs(a.occurredAt);
      const bm = toMs(b.occurredAt);
      return (bm ?? 0) - (am ?? 0);
    });
  if (kept.length === 0) return null;
  return kept.map(({ familyId: _f, cachedAt: _c, ...rest }) => rest);
}

function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const ms = new Date(v).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/**
 * 读缓存的 Dashboard 月摘要。
 * @returns 缓存内容(去掉内部字段);无缓存 → null
 */
export async function readCachedSummary(
  familyId: string,
  year: number,
  month: number,
): Promise<Omit<CachedSummaryRow, "key" | "familyId" | "year" | "month" | "cachedAt"> | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await ensureDB();
  const row = (await db.get(
    "dashboard_summaries",
    summaryKey(familyId, year, month),
  )) as CachedSummaryRow | undefined;
  if (!row) return null;
  const { key: _k, familyId: _f, year: _y, month: _m, cachedAt: _c, ...rest } = row;
  return rest;
}
