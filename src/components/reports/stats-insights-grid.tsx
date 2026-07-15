"use client";

import { Card } from "@heroui/react";

/**
 * StatsInsightsGrid (027-mobile-home-revamp US3 FR-011).
 *
 * 消费数据三宫格:最高支出日 / 最大单笔 / 支出次数。
 *
 * 设计文档(线稿"统计"屏 §消费数据):三个 viz-stat 卡。
 *
 * 数据来源:由父组件(reports/page.tsx)从 transaction.list(目标周期内)
 * 客户端聚合后传入。本组件纯展示,不持查询逻辑(便于测试 + 复用)。
 *
 * HeroUI v3:Card 组合式;三宫格用 grid-cols-3。
 */

export interface StatsInsights {
  /** 最高支出日(UTC),格式 "M/D";无数据 → null。 */
  maxExpenseDay: string | null;
  /** 最高支出日金额(分);无数据 → null。 */
  maxExpenseDayAmount: number | null;
  /** 最大单笔支出(分);无数据 → null。 */
  maxSingleExpense: number | null;
  /** 最大单笔的分类名;无数据 → null。 */
  maxSingleCategory: string | null;
  /** 支出次数(笔)。 */
  expenseCount: number;
}

function formatCents(cents: number): string {
  const yuan = cents / 100;
  return `¥${yuan.toFixed(2)}`;
}

function StatCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <Card.Content className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p data-amount className="mt-1 text-base font-medium tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </Card.Content>
    </Card>
  );
}

export function StatsInsightsGrid({ insights }: { insights: StatsInsights }) {
  const hasData = insights.expenseCount > 0;
  return (
    <section aria-label="消费数据" className="pt-4">
      <h2 className="mb-2 text-sm font-medium text-foreground">消费数据</h2>
      <div className="grid grid-cols-3 gap-2">
        <StatCell
          label="最高支出日"
          value={hasData && insights.maxExpenseDay ? insights.maxExpenseDay : "—"}
          sub={
            hasData && insights.maxExpenseDayAmount != null
              ? formatCents(insights.maxExpenseDayAmount)
              : ""
          }
        />
        <StatCell
          label="最大单笔"
          value={
            hasData && insights.maxSingleExpense != null
              ? formatCents(insights.maxSingleExpense)
              : "—"
          }
          sub={hasData ? insights.maxSingleCategory ?? "" : ""}
        />
        <StatCell
          label="支出次数"
          value={hasData ? `${insights.expenseCount} 笔` : "—"}
          sub="本周期"
        />
      </div>
    </section>
  );
}

/**
 * 从交易列表(目标周期内)客户端聚合三宫格数据。
 * 父组件调用,结果传给 StatsInsightsGrid。
 */
export function computeInsights(
  txs: Array<{
    type: string;
    amount: number; // signed
    occurredAt: string | Date;
    categoryName: string | null;
  }>,
): StatsInsights {
  const expenses = txs.filter((t) => t.type === "expense");
  if (expenses.length === 0) {
    return {
      maxExpenseDay: null,
      maxExpenseDayAmount: null,
      maxSingleExpense: null,
      maxSingleCategory: null,
      expenseCount: 0,
    };
  }

  // 按日聚合找最高支出日
  const byDay = new Map<string, number>();
  for (const t of expenses) {
    const d = typeof t.occurredAt === "string" ? new Date(t.occurredAt) : t.occurredAt;
    const key = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    byDay.set(key, (byDay.get(key) ?? 0) + Math.abs(t.amount));
  }
  let maxDay: string | null = null;
  let maxDayAmount = -1;
  for (const [day, amt] of byDay) {
    if (amt > maxDayAmount) {
      maxDayAmount = amt;
      maxDay = day;
    }
  }

  // 最大单笔
  let maxSingle = expenses[0]!;
  for (const t of expenses) {
    if (Math.abs(t.amount) > Math.abs(maxSingle.amount)) maxSingle = t;
  }

  return {
    maxExpenseDay: maxDay ? `${maxDay}` : null,
    maxExpenseDayAmount: maxDayAmount > 0 ? maxDayAmount : null,
    maxSingleExpense: Math.abs(maxSingle.amount),
    maxSingleCategory: maxSingle.categoryName,
    expenseCount: expenses.length,
  };
}
