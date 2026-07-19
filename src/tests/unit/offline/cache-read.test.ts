import { describe, expect, it } from "vitest";

import { sinceDateForRetention } from "@/lib/offline/cache-read";

/**
 * T018 (033 US1): cache-read 纯函数测试。
 *
 * 033 契约 C2/C3:network-first 服务器失败时,从 IDB 读近期交易兜底。
 * 读 transactions 走 familyId + sinceDate 范围(保留期起点)。
 *
 * 本测试只测纯函数 sinceDateForRetention;IDB get 靠真机走查。
 */
describe("sinceDateForRetention (US1 读取范围起点)", () => {
  it("返回 now - retentionDays(保留期起点)", () => {
    const now = new Date("2026-07-18T12:00:00Z").getTime();
    const since = sinceDateForRetention(30, now);
    // 30 天前同一时刻
    expect(since).toBe(now - 30 * 24 * 60 * 60 * 1000);
  });

  it("retentionDays=90 → 90 天前", () => {
    const now = 1_700_000_000_000;
    expect(sinceDateForRetention(90, now)).toBe(now - 90 * 24 * 60 * 60 * 1000);
  });

  it("retentionDays=0 → now(理论边界,什么都不读)", () => {
    const now = 1_700_000_000_000;
    expect(sinceDateForRetention(0, now)).toBe(now);
  });
});
