/**
 * T016 (030-home-trend-area-today US3) — 趋势图平滑曲线 + 渐变面积结构。
 *
 * 测试 expense-trend-chart 导出的 chartConfig 结构常量:
 *   - curveType === "monotone"(平滑且不跌破 0,research R2)
 *   - gradient.id 唯一存在;stops 顶部不透明、底部透明(垂直渐变,FR-007)
 *   - chartType === "area"(用 AreaChart+Area,而非 LineChart+Line,research R1)
 *   - animationDisabled === true(CLS=0,FR-013 / research R3)
 *
 * 宪章原则四:纯值断言(不渲染 recharts,jsdom 下 SVG 渲染不可靠,
 * 与既有 expense-trend-chart-privacy.test.ts 同策略——导出可测常量/函数)。
 * 渲染层 JSX 由代码审查 + 手动 quickstart 场景 3 验证。
 */
import { describe, expect, it } from "vitest";
import { chartConfig } from "@/components/dashboard/expense-trend-chart";

describe("chartConfig 平滑曲线 + 渐变面积结构 (T016)", () => {
  it("chartType === 'area'(用 AreaChart+Area,而非 LineChart+Line)", () => {
    expect(chartConfig.chartType).toBe("area");
  });

  it("curveType === 'monotone'(平滑且不跌破 0,research R2)", () => {
    // monotone = 单调性保持插值,保证非负数据点之间不下穿 0。
    expect(chartConfig.curveType).toBe("monotone");
  });

  it("gradientId 存在且非空(供 <defs><linearGradient id=…> 引用)", () => {
    expect(typeof chartConfig.gradientId).toBe("string");
    expect(chartConfig.gradientId.length).toBeGreaterThan(0);
  });

  it("gradient stops:顶部不透明、底部透明(垂直渐变,FR-007)", () => {
    const stops = chartConfig.gradientStops;
    expect(stops.length).toBeGreaterThanOrEqual(2);
    // 按 offset 升序校验:offset=0% 不透明度 > offset=100% 不透明度
    const sorted = [...stops].sort((a, b) => a.offset - b.offset);
    const top = sorted[0]!;
    const bottom = sorted[sorted.length - 1]!;
    expect(top.offset).toBe(0);
    expect(bottom.offset).toBe(100);
    // 顶部不透明度 > 底部(渐变:顶实底透)
    expect(top.opacity).toBeGreaterThan(bottom.opacity);
    expect(bottom.opacity).toBe(0); // 底部贴 X 轴处全透明
  });

  it("strokeColor === '--danger' token(支出语义红,research R1)", () => {
    expect(chartConfig.strokeColor).toBe("var(--danger)");
  });

  it("animationDisabled === true(CLS=0,FR-013 / research R3)", () => {
    expect(chartConfig.animationDisabled).toBe(true);
  });
});
