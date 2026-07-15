"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PieChart, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@heroui/react";
import {
  StatsPeriodToggle,
  periodLabels,
  type StatsPeriod,
} from "@/components/reports/stats-period-toggle";
import {
  StatsInsightsGrid,
  computeInsights,
} from "@/components/reports/stats-insights-grid";
import { ExpenseTrendChart } from "@/components/dashboard/expense-trend-chart";
import { CategoryDonut } from "@/components/reports/category-donut";
import { CategoryBreakdownCard } from "@/components/reports/category-breakdown-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { isPrivacyOn } from "@/lib/privacy";
import { getUtcMonthRange } from "@/lib/date-ranges";
import { cn } from "@/lib/utils";

/**
 * 统计页 (027-mobile-home-revamp,线稿对齐)。
 *
 * 月模式:用 dashboard.summary(趋势/分类/摘要) + transaction.list(三宫格)
 * 年模式:全部从 transaction.list(全年范围)客户端聚合(趋势/分类/摘要/三宫格)
 *
 * 线稿顺序:摘要 → 当月每日趋势 → 分类占比 → 消费数据
 */
const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function prevMonth(y: number, m: number) {
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

/** 从交易列表客户端聚合分类 Top N(用于年模式)。 */
function computeCategoryBreakdown(
  txs: Array<{ type: string; amount: number; categoryName: string | null; categoryIcon: string | null; categoryId?: string }>,
): Array<{ categoryId: string; categoryName: string; categoryIcon: string | null; amount: number; percentage: number }> {
  const expenses = txs.filter((t) => t.type === "expense");
  const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const byCat = new Map<string, { name: string; icon: string | null; amount: number }>();
  for (const t of expenses) {
    const key = t.categoryName ?? "?";
    const existing = byCat.get(key);
    if (existing) existing.amount += Math.abs(t.amount);
    else byCat.set(key, { name: key, icon: t.categoryIcon, amount: Math.abs(t.amount) });
  }
  return [...byCat.entries()]
    .map(([name, v]) => ({
      categoryId: name,
      categoryName: v.name,
      categoryIcon: v.icon,
      amount: v.amount,
      percentage: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** 从交易列表客户端聚合每日趋势(用于年模式)。 */
function computeDailyTrend(
  txs: Array<{ type: string; amount: number; occurredAt: string | Date }>,
): Array<{ date: string; amount: number }> {
  const byDay = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const d = typeof t.occurredAt === "string" ? new Date(t.occurredAt) : t.occurredAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    byDay.set(key, (byDay.get(key) ?? 0) + Math.abs(t.amount));
  }
  return [...byDay.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export default function ReportsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [endYearMonth, setEndYearMonth] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  });

  const [isPrivacy, setIsPrivacy] = useState(false);
  useEffect(() => {
    setIsPrivacy(isPrivacyOn());
  }, []);

  // 月模式:summary(趋势/分类/摘要)
  const summaryQuery = trpc.dashboard.summary.useQuery({
    year: endYearMonth.year,
    month: endYearMonth.month,
  });

  // 日期范围(月 or 年)
  const yearStart = new Date(Date.UTC(endYearMonth.year, 0, 1));
  const yearEnd = new Date(Date.UTC(endYearMonth.year + 1, 0, 1));
  const { start: mStart, end: mEnd } = getUtcMonthRange(
    endYearMonth.year,
    endYearMonth.month,
  );
  const periodStart = period === "year" ? yearStart : mStart;
  const periodEnd = period === "year" ? yearEnd : mEnd;

  // periodTxs:用于三宫格(月模式) + 全部聚合(年模式)
  const { data: periodTxs } = trpc.transaction.list.useQuery({
    startDate: periodStart.toISOString(),
    endDate: periodEnd.toISOString(),
    limit: 500,
    includeSummary: false,
  });

  const summaryData = summaryQuery.data;
  const isLoading =
    period === "month"
      ? summaryQuery.isLoading || !summaryData
      : !periodTxs;

  const handleCategoryClick = (categoryId: string) => {
    const m = monthKey(endYearMonth.year, endYearMonth.month);
    router.push(`/transactions?month=${m}&type=expense&categoryId=${categoryId}`);
  };

  const labels = periodLabels(period);
  const now = new Date();
  const isCurrentMonth =
    endYearMonth.year === now.getUTCFullYear() &&
    endYearMonth.month === now.getUTCMonth() + 1;

  // ── 统一数据源:月模式用 summary;年模式从 periodTxs 聚合 ──
  const periodItems = periodTxs?.items ?? [];

  // 支出总额
  const targetExpense =
    period === "year"
      ? periodItems.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0)
      : summaryData?.monthExpense ?? 0;

  // 均值
  const avgValue =
    period === "year"
      ? Math.round(targetExpense / 12)
      : (() => {
          const days = isCurrentMonth
            ? now.getUTCDate()
            : new Date(endYearMonth.year, endYearMonth.month, 0).getUTCDate();
          return days > 0 ? Math.round(targetExpense / days) : 0;
        })();

  // 趋势
  const trendData =
    period === "year"
      ? { granularity: "daily" as const, buckets: computeDailyTrend(periodItems) }
      : summaryData?.expenseTrend ?? { granularity: "daily" as const, buckets: [] };

  // 分类
  const categoryData =
    period === "year"
      ? computeCategoryBreakdown(periodItems).slice(0, 5)
      : summaryData?.topExpenseCategories ?? [];

  // 三宫格(两种模式都用 periodTxs)
  const insights =
    periodItems.length > 0
      ? computeInsights(periodItems)
      : {
          maxExpenseDay: null,
          maxExpenseDayAmount: null,
          maxSingleExpense: null,
          maxSingleCategory: null,
          expenseCount: 0,
        };

  const goPrev = () => {
    const p = prevMonth(endYearMonth.year, endYearMonth.month);
    setEndYearMonth(p);
  };
  const goNext = () => {
    if (
      endYearMonth.year === now.getUTCFullYear() &&
      endYearMonth.month === now.getUTCMonth() + 1
    ) return;
    const n =
      endYearMonth.month === 12
        ? { year: endYearMonth.year + 1, month: 1 }
        : { year: endYearMonth.year, month: endYearMonth.month + 1 };
    setEndYearMonth(n);
  };
  const isAtCurrentMonth =
    endYearMonth.year === now.getUTCFullYear() &&
    endYearMonth.month === now.getUTCMonth() + 1;

  return (
    <div>
      {/* 顶部:标题 + 月/年 toggle + 隐私 */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-medium">统计</h1>
        <div className="flex items-center gap-2">
          <StatsPeriodToggle period={period} onChange={setPeriod} />
          <PrivacyToggle />
        </div>
      </div>

      {/* 第二行:‹ 周期 › */}
      <div className="flex items-center justify-center gap-2 py-3">
        <button
          type="button"
          onClick={goPrev}
          aria-label="上一周期"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="min-w-[6rem] text-center text-sm font-medium tabular-nums">
          {period === "year"
            ? `${endYearMonth.year} 年`
            : `${endYearMonth.year} 年 ${endYearMonth.month} 月`}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={isAtCurrentMonth}
          aria-label="下一周期"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md",
            isAtCurrentMonth
              ? "cursor-not-allowed text-muted-foreground/40"
              : "text-muted-foreground hover:bg-[var(--muted)]",
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4 pt-2">
          <div className="h-28 animate-pulse rounded-2xl bg-[var(--muted)]" />
          <div className="h-44 animate-pulse rounded-2xl bg-[var(--muted)]" />
        </div>
      ) : (
        <>
          {/* 1. 摘要 */}
          <section className="pt-2">
            <Card>
              <Card.Content className="p-4">
                <p className="text-xs text-muted-foreground">{labels.total}</p>
                <p
                  data-amount
                  className="mt-1 text-2xl font-medium tabular-nums text-[var(--danger)]"
                >
                  {formatCents(targetExpense)}
                </p>
                <div className="mt-3 flex gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{labels.average}</p>
                    <p data-amount className="font-medium tabular-nums">
                      {formatCents(avgValue)}
                    </p>
                  </div>
                </div>
              </Card.Content>
            </Card>
          </section>

          {/* 2. 趋势 */}
          <section className="pt-4">
            <Card>
              <Card.Header>
                <Card.Title>支出趋势</Card.Title>
              </Card.Header>
              <Card.Content className="p-4 pt-0">
                {trendData.buckets.length > 0 ? (
                  <ExpenseTrendChart trend={trendData} isPrivacy={isPrivacy} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    暂无支出数据
                  </p>
                )}
              </Card.Content>
            </Card>
          </section>

          {/* 3. 分类占比 */}
          <section className="pt-4">
            <h2 className="pb-2 text-sm font-semibold text-muted-foreground">
              {period === "year"
                ? `${endYearMonth.year}年 支出分类`
                : `${endYearMonth.year}年${endYearMonth.month}月 支出分类`}
            </h2>
            {categoryData.length === 0 ? (
              <EmptyState
                icon={PieChart}
                title="暂无报表数据"
                description="本周期还没有支出记录"
                className="min-h-[24vh]"
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-5">
                  <CategoryDonut items={categoryData} />
                </div>
                <div className="md:col-span-7">
                  <CategoryBreakdownCard
                    items={categoryData}
                    onCategoryClick={handleCategoryClick}
                  />
                </div>
              </div>
            )}
          </section>

          {/* 4. 消费数据 */}
          <StatsInsightsGrid insights={insights} />
        </>
      )}
    </div>
  );
}
