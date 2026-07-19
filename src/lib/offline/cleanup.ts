"use client";

/**
 * cleanup — 033 US4 / FR-010:缓存空间管理。
 *
 * 033 契约 C3:保留期内(默认 30 天)交易 + 当前月摘要保留;过旧的清理。
 * 缓存大小长期 < 10MB(SC-006)。pending_queue 不受保留期影响(必须同步
 * 成功才出队,见 queue-state.ts)。
 *
 * 触发时机(cleanupCache):
 *   - 每次 app 启动(app-shell mount)
 *   - 每次成功同步后(轻量)
 *
 * 纯函数(selectStaleTransactionIds / selectStaleSummaryKeys)便于 node 单测;
 * IDB delete 走 ensureDB()。
 */
import { ensureDB, writeMeta, type CachedTransactionRow, type CachedSummaryRow } from "./db";

type TransactionWithDate = { id: string; occurredAt?: string | number | Date };

/**
 * 纯函数:从全量缓存交易选出 stale(occurredAt < now - retentionDays)的 id 列表。
 * 未来日期保留;无 occurredAt 的异常行视为 stale(清理)。
 */
export function selectStaleTransactionIds(
  txs: TransactionWithDate[],
  retentionDays: number,
  now: number,
): string[] {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  const stale: string[] = [];
  for (const t of txs) {
    const occ = toMs(t.occurredAt);
    if (occ == null) {
      stale.push(t.id); // 异常行 → 清理
      continue;
    }
    if (occ < cutoff) stale.push(t.id); // 过旧
    // 未来日期(occ >= cutoff 且 occ > now)保留
  }
  return stale;
}

/** 纯函数:从全量 summaries 选出 stale(非当前月 + 非上月)的 key 列表。 */
export function selectStaleSummaryKeys(
  summaries: Array<{ key: string; year: number; month: number }>,
  currentYear: number,
  currentMonth: number,
): string[] {
  // 计算当前月 + 上月的 (year, month)
  const keep = new Set<string>([
    `${currentYear}|${currentMonth}`,
    prevMonthKey(currentYear, currentMonth),
  ]);
  return summaries
    .filter((s) => !keep.has(`${s.year}|${s.month}`))
    .map((s) => s.key);
}

function prevMonthKey(year: number, month: number): string {
  if (month === 1) return `${year - 1}|12`;
  return `${year}|${month - 1}`;
}

function toMs(v: string | number | Date | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const d = typeof v === "string" ? new Date(v) : v;
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * 执行一次缓存清理:删除 stale 交易 + stale 月摘要;更新 meta.lastSyncedAt。
 * 安全:no-op 在非浏览器/无 IDB 环境。失败不抛(清理是非关键路径)。
 *
 * @returns 清理掉的条目数(供日志/调试)
 */
export async function cleanupCache(retentionDays = 30): Promise<{
  transactions: number;
  summaries: number;
}> {
  if (typeof indexedDB === "undefined") {
    return { transactions: 0, summaries: 0 };
  }
  try {
    const db = await ensureDB();
    const now = Date.now();

    // ── 交易清理 ──
    const allTx = (await db.getAll("transactions")) as CachedTransactionRow[];
    const staleTxIds = selectStaleTransactionIds(
      allTx.map((t) => ({ id: t.id, occurredAt: t.occurredAt as never })),
      retentionDays,
      now,
    );
    const txStore = db.transaction("transactions", "readwrite");
    await Promise.all(staleTxIds.map((id) => txStore.store.delete(id)));
    await txStore.done;

    // ── 月摘要清理 ──
    const allSummaries = (await db.getAll(
      "dashboard_summaries",
    )) as CachedSummaryRow[];
    const nowDate = new Date(now);
    const staleSummaryKeys = selectStaleSummaryKeys(
      allSummaries.map((s) => ({
        key: s.key,
        year: s.year,
        month: s.month,
      })),
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth() + 1,
    );
    const sumStore = db.transaction("dashboard_summaries", "readwrite");
    await Promise.all(staleSummaryKeys.map((k) => sumStore.store.delete(k)));
    await sumStore.done;

    // 更新 meta.lastSyncedAt(顺便刷新)
    await writeMeta({ lastSyncedAt: now });

    return { transactions: staleTxIds.length, summaries: staleSummaryKeys.length };
  } catch {
    // 清理失败不影响主功能(缓存兜底是 best-effort)
    return { transactions: 0, summaries: 0 };
  }
}
