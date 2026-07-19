import { describe, expect, it } from "vitest";

import {
  selectStaleTransactionIds,
  selectStaleSummaryKeys,
} from "@/lib/offline/cleanup";

/**
 * T045 (033 US4 / FR-010):缓存空间管理纯函数测试。
 *
 * 033 契约 C3:保留期内(默认 30 天)的交易 + 当前月摘要保留;过旧的清理,
 * 缓存大小长期 < 10MB。pending_queue 不受保留期影响(必须同步成功才出队)。
 *
 * 纯函数:selectStaleTransactionIds(给定 IDB 全量交易 + 保留期)→ 待删 id 列表;
 * selectStaleSummaryKeys(全量 summaries + 保留月份数)→ 待删 key 列表。
 * IDB 实际 delete 靠 cleanupCache()(真机/jsdom 走查)。
 */
const now = new Date("2026-07-18T12:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

describe("selectStaleTransactionIds (US4 / FR-010 保留期)", () => {
  it("返回 occurredAt < now - retentionDays 的 id 列表", () => {
    const txs = [
      { id: "t1", occurredAt: now }, // 今天 → 保留
      { id: "t2", occurredAt: now - 10 * DAY }, // 10 天前 → 保留
      { id: "t3", occurredAt: now - 45 * DAY }, // 45 天前 → stale
      { id: "t4", occurredAt: now - 31 * DAY }, // 31 天前 → stale
    ] as const;

    const stale = selectStaleTransactionIds([...txs], 30, now);
    expect(stale.sort()).toEqual(["t3", "t4"]);
  });

  it("保留期边界:恰好 30 天前 → 保留(>=,不算 stale)", () => {
    const txs = [{ id: "edge", occurredAt: now - 30 * DAY }];
    expect(selectStaleTransactionIds(txs, 30, now)).toEqual([]);
  });

  it("未来日期 → 保留(不算 stale)", () => {
    const txs = [{ id: "future", occurredAt: now + 7 * DAY }];
    expect(selectStaleTransactionIds(txs, 30, now)).toEqual([]);
  });

  it("无 occurredAt 的行 → 视为 stale(异常数据清理)", () => {
    const txs = [{ id: "broken" }, { id: "ok", occurredAt: now }];
    expect(selectStaleTransactionIds(txs as never, 30, now)).toEqual(["broken"]);
  });

  it("空数组 → 空", () => {
    expect(selectStaleTransactionIds([], 30, now)).toEqual([]);
  });
});

describe("selectStaleSummaryKeys (US4 月摘要清理)", () => {
  // key 格式 "familyId|year|month"(见 cache-write.ts summaryKey)
  it("保留当前月 + 上月,更早的标 stale", () => {
    const summaries = [
      { key: "fam|2026|7", year: 2026, month: 7 }, // 当前月 → 保留
      { key: "fam|2026|6", year: 2026, month: 6 }, // 上月 → 保留
      { key: "fam|2026|5", year: 2026, month: 5 }, // 2 月前 → stale
      { key: "fam|2025|12", year: 2025, month: 12 }, // 很早 → stale
    ] as const;

    const stale = selectStaleSummaryKeys([...summaries], 2026, 7);
    expect(stale.sort()).toEqual(["fam|2025|12", "fam|2026|5"]);
  });

  it("跨年:2026 年 1 月,当前月=2026|1,上月=2025|12 保留,2025|11 stale", () => {
    const summaries = [
      { key: "fam|2026|1", year: 2026, month: 1 },
      { key: "fam|2025|12", year: 2025, month: 12 },
      { key: "fam|2025|11", year: 2025, month: 11 },
    ] as const;
    const stale = selectStaleSummaryKeys([...summaries], 2026, 1);
    expect(stale).toEqual(["fam|2025|11"]);
  });

  it("只有当前月 → 无 stale", () => {
    const summaries = [{ key: "fam|2026|7", year: 2026, month: 7 }] as const;
    expect(selectStaleSummaryKeys([...summaries], 2026, 7)).toEqual([]);
  });
});
