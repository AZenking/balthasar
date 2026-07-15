/**
 * T038 (027-mobile-home-revamp US5) — computeBudgetStatus 四态边界单测。
 *
 * 对应 research R4 + contracts/dashboard-budget.md:
 *   - unset(null/≤0 预算)
 *   - normal(< 80%)
 *   - warning(≥ 80% 且 < 100%)
 *   - overspent(≥ 100%)
 *
 * 宪章原则四:纯函数单测。
 */
import { describe, expect, it } from "vitest";
import { computeBudgetStatus } from "@/server/domain/dashboard/budget-status";

describe("computeBudgetStatus (T038)", () => {
  it("未设置预算(null)→ unset", () => {
    expect(computeBudgetStatus(368000, null).status).toBe("unset");
  });

  it("预算 ≤ 0 → unset(防御,避免 0 元预算显示荒谬态)", () => {
    expect(computeBudgetStatus(0, 0).status).toBe("unset");
    expect(computeBudgetStatus(100, -500).status).toBe("unset");
  });

  it("50% → normal", () => {
    const r = computeBudgetStatus(290000, 580000); // 50%
    expect(r.status).toBe("normal");
    if (r.status === "normal") {
      expect(r.usagePercent).toBe(50);
      expect(r.remaining).toBe(290000);
    }
  });

  it("79.9% → normal(未达 80% 阈值)", () => {
    expect(computeBudgetStatus(463420, 580000).status).toBe("normal"); // 79.9
  });

  it("80% → warning(达到预警阈值)", () => {
    const r = computeBudgetStatus(464000, 580000); // 80
    expect(r.status).toBe("warning");
    if (r.status === "warning") {
      expect(r.usagePercent).toBe(80);
      expect(r.remaining).toBe(116000);
    }
  });

  it("99.9% → warning(未超 100%)", () => {
    expect(computeBudgetStatus(579420, 580000).status).toBe("warning"); // 99.9
  });

  it("100% → overspent", () => {
    const r = computeBudgetStatus(580000, 580000); // 100
    expect(r.status).toBe("overspent");
    if (r.status === "overspent") {
      expect(r.usagePercent).toBe(100);
      expect(r.overspendAmount).toBe(0);
    }
  });

  it("120% → overspent,超支金额正确", () => {
    const r = computeBudgetStatus(696000, 580000); // 120
    expect(r.status).toBe("overspent");
    if (r.status === "overspent") {
      expect(r.usagePercent).toBe(120);
      expect(r.overspendAmount).toBe(116000);
    }
  });

  it("usagePercent 一位小数四舍五入", () => {
    // 368050/580000 = 63.456... → 63.5
    const r = computeBudgetStatus(368050, 580000);
    if (r.status !== "unset") {
      expect(r.usagePercent).toBe(63.5);
    }
  });

  it("无支出 + 有预算 → normal(0%)", () => {
    const r = computeBudgetStatus(0, 580000);
    expect(r.status).toBe("normal");
    if (r.status === "normal") {
      expect(r.usagePercent).toBe(0);
      expect(r.remaining).toBe(580000);
    }
  });
});
