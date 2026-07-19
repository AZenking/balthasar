"use client";

/**
 * cache-write — 033 US1 / FR-001:把 tRPC 服务器响应抽取并写入 IDB 缓存。
 *
 * 契约 C2:network-first —— 服务器请求成功后,异步刷新 IDB(useEffect on q.data)。
 * 契约 C3:缓存范围 = 保留期内(默认 30 天)的交易 + 当前月摘要。
 *
 * 纯函数(extract/filter/summaryKey)抽出来便于 node 单测;
 * IDB put 走 ensureDB()(SSR 安全)。
 */
import { ensureDB, writeMeta, type CachedTransactionRow, type CachedSummaryRow } from "./db";

type TransactionLike = {
  id: string;
  occurredAt?: string | number | Date;
  [key: string]: unknown;
};

/**
 * 从 tRPC transaction.list 响应抽取交易数组,标 familyId + cachedAt。
 * 不修改原数组(返回新对象)。
 */
export function extractTransactionsForCache<T extends TransactionLike>(
  familyId: string,
  list: T[],
  cachedAt: number,
): (T & { familyId: string; cachedAt: number })[] {
  return list.map((t) => ({ ...t, familyId, cachedAt }));
}

/**
 * 保留期过滤:保留 occurredAt >= now - retentionDays 的交易。
 * 未来日期也保留(不算过期)。
 */
export function filterByRetention<
  T extends { occurredAt?: string | number | Date; id: string },
>(txs: T[], retentionDays: number, now: number): T[] {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  return txs.filter((t) => {
    const occ = toMillis(t.occurredAt);
    if (occ == null) return false; // 无 occurredAt 的不缓存(异常防御)
    return occ >= cutoff;
  });
}

function toMillis(v: string | number | Date | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const d = typeof v === "string" ? new Date(v) : v;
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * dashboard_summaries 复合 key:"familyId|year|month"。
 */
export function summaryKey(familyId: string, year: number, month: number): string {
  return `${familyId}|${year}|${month}`;
}

/**
 * 写入近期交易到 IDB(覆盖式 put,按 id 去重)。
 * 调用方应先 filterByRetention。
 */
export async function writeCachedTransactions(
  familyId: string,
  txs: TransactionLike[],
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const cachedAt = Date.now();
  const rows: CachedTransactionRow[] = extractTransactionsForCache(
    familyId,
    txs,
    cachedAt,
  );
  const db = await ensureDB();
  const tx = db.transaction("transactions", "readwrite");
  await Promise.all(rows.map((r) => tx.store.put(r)));
  await tx.done;
  await writeMeta({ lastSyncedAt: cachedAt });
}

/**
 * 写入当前月 Dashboard 摘要到 IDB(覆盖式 put)。
 */
export async function writeCachedSummary(
  familyId: string,
  year: number,
  month: number,
  summary: Record<string, unknown>,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const cachedAt = Date.now();
  const row: CachedSummaryRow = {
    key: summaryKey(familyId, year, month),
    familyId,
    year,
    month,
    cachedAt,
    ...summary,
  };
  const db = await ensureDB();
  await db.put("dashboard_summaries", row);
}
