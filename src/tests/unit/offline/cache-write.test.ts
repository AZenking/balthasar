import { describe, expect, it } from "vitest";

import {
  extractTransactionsForCache,
  filterByRetention,
  summaryKey,
} from "@/lib/offline/cache-write";

/**
 * T017 (033 US1): cache-write 纯函数测试。
 *
 * 033 R1 + 契约 C3:从 tRPC transaction.list 响应抽取交易标 cachedAt 写入;
 * 保留期过滤(默认 30 天)。dashboard_summaries 复合 key。
 *
 * 只测纯函数;IDB put 靠真机走查。
 */
describe("extractTransactionsForCache (US1)", () => {
  it("抽取交易数组并标 cachedAt(不修改原数组)", () => {
    const now = 1_700_000_000_000;
    const list = [
      { id: "t1", type: "expense", amount: -5000, occurredAt: "2026-07-01T00:00:00Z" },
      { id: "t2", type: "income", amount: 80000, occurredAt: "2026-07-02T00:00:00Z" },
    ] as const;

    const result = extractTransactionsForCache("fam-1", [...list], now);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "t1",
      familyId: "fam-1",
      cachedAt: now,
    });
    expect(result[1]!.cachedAt).toBe(now);
    // 原始字段保留
    expect(result[0]!.amount).toBe(-5000);
  });

  it("空数组 → 空数组", () => {
    expect(extractTransactionsForCache("fam-1", [], 123)).toEqual([]);
  });
});

describe("filterByRetention (US1 / FR-010 保留期)", () => {
  const now = new Date("2026-07-18T12:00:00Z").getTime();

  it("保留 occurredAt 在保留期内的交易(默认 30 天)", () => {
    const txs = [
      { id: "today", occurredAt: new Date("2026-07-18T00:00:00Z").getTime() },
      { id: "recent", occurredAt: new Date("2026-06-25T00:00:00Z").getTime() }, // 23 天前
      { id: "old", occurredAt: new Date("2026-06-10T00:00:00Z").getTime() }, // 38 天前 → 滤除
    ] as const;

    const kept = filterByRetention([...txs], 30, now);
    expect(kept.map((t) => t.id)).toEqual(["today", "recent"]);
  });

  it("保留期边界:恰好 30 天前 → 保留(>=)", () => {
    const exactly30 = now - 30 * 24 * 60 * 60 * 1000;
    const txs = [{ id: "edge", occurredAt: exactly30 }];
    expect(filterByRetention(txs, 30, now)).toHaveLength(1);
  });

  it("未来日期的交易 → 保留(不算过期)", () => {
    const future = now + 7 * 24 * 60 * 60 * 1000;
    const txs = [{ id: "future", occurredAt: future }];
    expect(filterByRetention(txs, 30, now)).toHaveLength(1);
  });

  it("空数组 → 空数组", () => {
    expect(filterByRetention([], 30, now)).toEqual([]);
  });
});

describe("summaryKey (US1 dashboard_summaries 复合 key)", () => {
  it("familyId|year|month 格式", () => {
    expect(summaryKey("fam-1", 2026, 7)).toBe("fam-1|2026|7");
  });

  it("不同 family 不串(隔离)", () => {
    expect(summaryKey("fam-1", 2026, 7)).not.toBe(summaryKey("fam-2", 2026, 7));
  });

  it("不同 year/month 不串", () => {
    expect(summaryKey("fam-1", 2026, 7)).not.toBe(summaryKey("fam-1", 2026, 8));
    expect(summaryKey("fam-1", 2026, 7)).not.toBe(summaryKey("fam-1", 2025, 7));
  });
});
