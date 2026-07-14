/**
 * T008 (027-mobile-home-revamp US2) — 隐私模式遮蔽趋势图 Y 轴刻度。
 *
 * 测试 expense-trend-chart 导出的 tickFormatter(isPrivacy, cents):
 *   - isPrivacy=true → 返回 `••`(遮蔽金额,趋势图形状保留)
 *   - isPrivacy=false → 返回正常元单位 tick
 *
 * 设计文档 §4.2:"趋势图保留形状,但隐藏金额刻度"。
 * 026 已知缺口:recharts YAxis tick 未遮蔽;027 通过 tickFormatter 修复。
 *
 * 宪章原则四:纯函数单测(不渲染 recharts,jsdom 下 SVG 渲染不可靠,
 * 故直接测 formatter 谓词)。
 */
import { describe, expect, it } from "vitest";
import { tickFormatter } from "@/components/dashboard/expense-trend-chart";

describe("tickFormatter privacy masking (T008)", () => {
  it("隐私开 → 返回 •• 遮蔽金额", () => {
    expect(tickFormatter(true, 368050)).toBe("••");
    expect(tickFormatter(true, 0)).toBe("••");
    expect(tickFormatter(true, 10000000)).toBe("••");
  });

  it("隐私关 → 返回正常元单位 tick", () => {
    // 368000 分 = ¥3680.00 → Math.round(3680) = "3680"
    expect(tickFormatter(false, 368000)).toBe("3680");
    expect(tickFormatter(false, 0)).toBe("0");
  });

  it("隐私关 → 万元以上用'万'单位", () => {
    expect(tickFormatter(false, 1000000)).toBe("1万"); // ¥10000 → "1万"
    expect(tickFormatter(false, 58200000)).toBe("58万");
  });

  it("隐私态永不暴露真实金额(无论金额大小)", () => {
    // 关键安全断言:隐私开时,任何金额都返回占位符,不泄露量级。
    for (const cents of [1, 100, 368050, 100000000]) {
      expect(tickFormatter(true, cents)).toBe("••");
    }
  });
});
