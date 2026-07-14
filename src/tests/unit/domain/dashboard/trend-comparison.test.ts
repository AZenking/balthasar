/**
 * T007 (027-mobile-home-revamp US2) — 趋势对比百分比纯函数单测。
 *
 * 本月合计 vs 上月合计的 comparisonPercent 计算(设计 §3.2-6"较上月 ±X%")。
 *
 * 当前实现:对比逻辑未来由 dashboard.summary 后端返回 comparisonPercent
 * (research R6);此测试锁定其计算口径,确保:
 *   - 正常计算 round 到一位小数
 *   - 上月合计 = 0 → null(无基期)
 *   - 本月 = 上月 → 0
 *
 * 宪章原则四:纯函数单测,不依赖 DB。
 */
import { describe, expect, it } from "vitest";

/**
 * 计算本月 vs 上月的支出变化百分比(与 dashboard.summary 契约口径一致)。
 * 返回 signed 百分比(正=增加,负=减少),一位小数;上月=0 → null。
 *
 * 注:此函数是契约口径的可测试表达;实际实现将在后端 dashboard query 内
 * inline 同样逻辑(research R6)。本测试锁定语义。
 */
export function comparisonPercent(
  currentTotal: number,
  previousTotal: number,
): number | null {
  if (previousTotal === 0) return null;
  return Math.round(((currentTotal - previousTotal) / previousTotal) * 1000) / 10;
}

describe("comparisonPercent (T007)", () => {
  it("本月下降 8% → -8.0", () => {
    // 上月 4000,本月 3680 → (3680-4000)/4000 = -8%
    expect(comparisonPercent(3680, 4000)).toBe(-8);
  });

  it("本月上升 12.5% → 12.5", () => {
    expect(comparisonPercent(4500, 4000)).toBe(12.5);
  });

  it("本月 = 上月 → 0", () => {
    expect(comparisonPercent(4000, 4000)).toBe(0);
  });

  it("上月合计 = 0 → null(无基期)", () => {
    expect(comparisonPercent(3680, 0)).toBeNull();
  });

  it("本月也为 0、上月为 0 → null(避免 0/0)", () => {
    expect(comparisonPercent(0, 0)).toBeNull();
  });

  it("本月为 0、上月 > 0 → -100(完全下降)", () => {
    expect(comparisonPercent(0, 4000)).toBe(-100);
  });

  it("一位小数四舍五入", () => {
    // (3681-4000)/4000 = -7.975 → -8.0(round 到一位)
    expect(comparisonPercent(3681, 4000)).toBe(-8);
    // (4001-4000)/4000 = 0.025 → 0.0
    expect(comparisonPercent(4001, 4000)).toBe(0);
  });
});
