/**
 * T020 (027-mobile-home-revamp US3) — 统计页月/年 toggle 标签切换。
 *
 * 测试 periodLabels(period) 纯函数:月/年周期对应的摘要标签。
 *   - 月:本月支出 / 日均支出 / 较上月
 *   - 年:全年支出 / 月均支出 / 较去年
 *
 * 宪章原则四:纯函数单测。
 */
import { describe, expect, it } from "vitest";
import { periodLabels } from "@/components/reports/stats-period-toggle";

describe("periodLabels (T020)", () => {
  it("月周期 → 本月支出 / 日均支出 / 较上月", () => {
    const labels = periodLabels("month");
    expect(labels.total).toBe("本月支出");
    expect(labels.average).toBe("日均支出");
    expect(labels.comparison).toBe("较上月");
  });

  it("年周期 → 全年支出 / 月均支出 / 较去年", () => {
    const labels = periodLabels("year");
    expect(labels.total).toBe("全年支出");
    expect(labels.average).toBe("月均支出");
    expect(labels.comparison).toBe("较去年");
  });

  it("月周期与年周期标签不混淆", () => {
    const m = periodLabels("month");
    const y = periodLabels("year");
    expect(m.total).not.toBe(y.total);
    expect(m.average).not.toBe(y.average);
    expect(m.comparison).not.toBe(y.comparison);
  });
});
