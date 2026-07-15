/**
 * T019 (027-mobile-home-revamp US3) — 明细页按日分组 + 组头小计。
 *
 * 测试 TransactionDayGroup 的纯分组/小计逻辑(groupByUtcDay + daySubtotal):
 *   - 按 UTC 日历日分组(非相对桶)
 *   - 组头小计:支出 = SUM(ABS(expense amount))、收入 = SUM(income amount)
 *   - 转账不计入收支小计(US4 后;US3 前无转账数据,分支自然不触发)
 *
 * 宪章原则四:纯函数单测。
 * 注:tasks.md 标注"集成测试",但分组是纯前端逻辑,单测更精准;
 * transaction.list 的分页/筛选已有 005 集成测覆盖。
 */
import { describe, expect, it } from "vitest";
import {
  groupByUtcDay,
  daySubtotal,
  type DayGroupTx,
} from "@/components/transactions/transaction-day-group";

function tx(partial: Partial<DayGroupTx>): DayGroupTx {
  return {
    id: partial.id ?? "t1",
    type: partial.type ?? "expense",
    amount: partial.amount ?? -1000,
    occurredAt: partial.occurredAt ?? "2026-07-14T12:00:00.000Z",
  } as DayGroupTx;
}

describe("groupByUtcDay (T019)", () => {
  it("同一 UTC 日的交易归一组", () => {
    const groups = groupByUtcDay([
      tx({ id: "a", occurredAt: "2026-07-14T01:00:00.000Z" }),
      tx({ id: "b", occurredAt: "2026-07-14T23:00:00.000Z" }),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0]!.items.length).toBe(2);
  });

  it("不同 UTC 日分多组,降序(最新在前)", () => {
    const groups = groupByUtcDay([
      tx({ id: "old", occurredAt: "2026-07-10T12:00:00.000Z" }),
      tx({ id: "new", occurredAt: "2026-07-14T12:00:00.000Z" }),
    ]);
    expect(groups.length).toBe(2);
    expect(groups[0]!.key).toBe("2026-07-14");
    expect(groups[1]!.key).toBe("2026-07-10");
  });

  it("空数组 → 空分组", () => {
    expect(groupByUtcDay([])).toEqual([]);
  });

  it("跨月/跨年正确分桶", () => {
    const groups = groupByUtcDay([
      tx({ id: "dec", occurredAt: "2025-12-31T23:59:00.000Z" }),
      tx({ id: "jan", occurredAt: "2026-01-01T00:01:00.000Z" }),
    ]);
    expect(groups.length).toBe(2);
  });
});

describe("daySubtotal (T019)", () => {
  it("支出小计 = SUM(ABS(expense amount))", () => {
    const sub = daySubtotal([
      tx({ type: "expense", amount: -3200 }),
      tx({ type: "expense", amount: -5800 }),
    ]);
    expect(sub.expense).toBe(9000);
    expect(sub.income).toBe(0);
  });

  it("收入小计 = SUM(income amount)", () => {
    const sub = daySubtotal([
      tx({ type: "income", amount: 850000 }),
    ]);
    expect(sub.income).toBe(850000);
    expect(sub.expense).toBe(0);
  });

  it("混合:支出与收入分别小计,互不混入", () => {
    const sub = daySubtotal([
      tx({ type: "expense", amount: -3200 }),
      tx({ type: "income", amount: 50000 }),
      tx({ type: "expense", amount: -1000 }),
    ]);
    expect(sub.expense).toBe(4200);
    expect(sub.income).toBe(50000);
  });

  it("转账不计入收支小计(US4 类型,US3 前无数据)", () => {
    const sub = daySubtotal([
      tx({ type: "expense", amount: -3200 }),
      tx({ type: "transfer", amount: 50000 } as DayGroupTx),
    ]);
    expect(sub.expense).toBe(3200);
    expect(sub.income).toBe(0); // transfer 不计入
  });
});
