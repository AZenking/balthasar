/**
 * T007 (030-home-trend-area-today US1) — SummaryHeroCard 本日支出格式化。
 *
 * 测试 summary-hero-card 导出的 formatDayExpense(dayExpense) 纯函数:
 *   - number → formatCents(cents)(如 5000 → "¥50.00")
 *   - 0 → "¥0.00"(今日无交易的合法值,非降级)
 *   - null → "¥--.--"(查询失败降级占位,FR-003)
 *
 * 宪章原则四:纯函数单测(与本仓库其它 component 测试约定一致:
 * 不渲染 React,jsdom 下 SVG/className 断言不可靠,故提取纯逻辑测试)。
 * data-amount 属性挂载由代码审查保证(静态 JSX 属性)。
 *
 * 主从层级(monthExpense 主大数字、dayExpense 右侧次级)与移动端不溢出
 * 属布局断言,由手动 quickstart 场景 1 验证。
 */
import { describe, expect, it } from "vitest";
import { formatDayExpense } from "@/components/dashboard/summary-hero-card";

describe("formatDayExpense (T007)", () => {
  it("number → formatCents(分转元,两位小数)", () => {
    expect(formatDayExpense(5000)).toBe("¥50.00");
    expect(formatDayExpense(12345)).toBe("¥123.45");
  });

  it("0 → ¥0.00(今日无交易,合法值,非降级)", () => {
    expect(formatDayExpense(0)).toBe("¥0.00");
  });

  it("null → ¥--.--(查询失败降级占位,FR-003)", () => {
    expect(formatDayExpense(null)).toBe("¥--.--");
  });

  it("退款冲减后的净额(如 7000 分 = ¥70.00)正确格式化", () => {
    // -¥100 expense + ¥30 退款 → 净 ¥70(已由 getDailyTrend 聚合,展示层只格式化)
    expect(formatDayExpense(7000)).toBe("¥70.00");
  });
});
