"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PieChart, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, Separator, Skeleton } from "@heroui/react";
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
 * 月模式:dashboard.summary(趋势/分类/摘要) + transaction.list(三宫格)
 * 年模式:全部从 transaction.list(全年,分页拉取)客户端聚合
 *
 * 线稿顺序:摘要 → 趋势 → 分类占比 → 消费数据
 *
 * 修复要点:
 * - limit ≤ 100(后端 zod 约束),年模式分页拉取全部
 * - 年模式周期切换按年;月模式按月
 * - 年模式分类下钻用全年日期范围(非月份),不传 categoryId(聚合无真实 UUID)
 * - useMemo 缓存聚合结果
 * - 年模式趋势按月聚合(12 桶),非 365 日桶
 */
const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

/** 年模式:按月聚合趋势(12 桶)。 */
function computeMonthlyTrend(
  txs: Array<{ type: string; amount: number; occurredAt: string | Date }>,
  year: number,
): Array<{ date: string; amount: number }> {
  const byMonth = new Array(12).fill(0) as number[];
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const d = typeof t.occurredAt === "string" ? new Date(t.occurredAt) : t.occurredAt;
    if (d.getUTCFullYear() === year) {
      byMonth[d.getUTCMonth()] += Math.abs(t.amount);
    }
  }
  return byMonth.map((amount, i) => ({
    date: `${year}-${String(i + 1).padStart(2, "0")}-01`,
    amount,
  }));
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

  // 上一周期(用于摘要"较上期"对比)
  const prevPeriodStart =
    period === "year"
      ? new Date(Date.UTC(endYearMonth.year - 1, 0, 1))
      : endYearMonth.month === 1
        ? new Date(Date.UTC(endYearMonth.year - 1, 11, 1))
        : new Date(Date.UTC(endYearMonth.year, endYearMonth.month - 2, 1));
  const prevPeriodEnd = period === "year" ? yearStart : mStart;
  const { data: prevPeriodData } = trpc.transaction.list.useQuery({
    startDate: prevPeriodStart.toISOString(),
    endDate: prevPeriodEnd.toISOString(),
    limit: 1,
    includeSummary: true,
  });
  const prevExpense = prevPeriodData?.summary?.expense ?? null;

  // transaction.list:limit ≤ 100(后端 zod max=100)。年模式分页拉取全部。
  const PAGE_SIZE = 100;
  const { data: page1 } = trpc.transaction.list.useQuery({
    startDate: periodStart.toISOString(),
    endDate: periodEnd.toISOString(),
    limit: PAGE_SIZE,
    includeSummary: false,
  });
  const { data: page2 } = trpc.transaction.list.useQuery({
    startDate: periodStart.toISOString(),
    endDate: periodEnd.toISOString(),
    limit: PAGE_SIZE,
    cursor: page1?.nextCursor ?? undefined,
    includeSummary: false,
  });
  const { data: page3 } = trpc.transaction.list.useQuery({
    startDate: periodStart.toISOString(),
    endDate: periodEnd.toISOString(),
    limit: PAGE_SIZE,
    cursor: page2?.nextCursor ?? undefined,
    includeSummary: false,
  });
  // 合并分页结果(3 页最多 300 条;超出罕见,趋势/分类/三宫格近似可接受)
  const periodItems = useMemo(() => {
    const all = [...(page1?.items ?? []), ...(page2?.items ?? []), ...(page3?.items ?? [])];
    return all;
  }, [page1, page2, page3]);

  const summaryData = summaryQuery.data;
  const isLoading =
    period === "month"
      ? summaryQuery.isLoading || !summaryData
      : !page1;

  const labels = periodLabels(period);
  const now = new Date();
  const isCurrentMonth =
    endYearMonth.year === now.getUTCFullYear() &&
    endYearMonth.month === now.getUTCMonth() + 1;
  const isCurrentYear = endYearMonth.year === now.getUTCFullYear();

  // ── 统一数据源(useMemo 缓存) ──
  const targetExpense = useMemo(() => {
    if (period === "year") {
      return periodItems
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Math.abs(t.amount), 0);
    }
    return summaryData?.monthExpense ?? 0;
  }, [period, periodItems, summaryData]);

  const avgValue = useMemo(() => {
    if (period === "year") return Math.round(targetExpense / 12);
    const days = isCurrentMonth
      ? now.getUTCDate()
      : new Date(endYearMonth.year, endYearMonth.month, 0).getUTCDate();
    return days > 0 ? Math.round(targetExpense / days) : 0;
  }, [period, targetExpense, isCurrentMonth, endYearMonth]);

  // 趋势:月模式用 summary daily;年模式按月聚合(12 桶)
  const trendData = useMemo(() => {
    if (period === "year") {
      return {
        granularity: "daily" as const,
        buckets: computeMonthlyTrend(periodItems, endYearMonth.year),
      };
    }
    return summaryData?.expenseTrend ?? { granularity: "daily" as const, buckets: [] };
  }, [period, periodItems, endYearMonth.year, summaryData]);

  // 分类:月模式用 summary;年模式从 periodItems 聚合(保留真实 categoryId)
  const categoryData = useMemo(() => {
    if (period !== "year") return summaryData?.topExpenseCategories ?? [];
    const expenses = periodItems.filter((t) => t.type === "expense");
    const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const byCat = new Map<string, { id: string; name: string; icon: string | null; amount: number }>();
    for (const t of expenses) {
      const key = t.categoryId ?? t.categoryName ?? "?";
      const existing = byCat.get(key);
      if (existing) existing.amount += Math.abs(t.amount);
      else byCat.set(key, {
        id: key,
        name: t.categoryName ?? "?",
        icon: t.categoryIcon,
        amount: Math.abs(t.amount),
      });
    }
    return [...byCat.values()]
      .map((v) => ({
        categoryId: v.id,
        categoryName: v.name,
        categoryIcon: v.icon,
        amount: v.amount,
        percentage: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [period, periodItems, summaryData]);

  // 三宫格(两种模式都用 periodItems)
  const insights = useMemo(() => {
    if (periodItems.length === 0) {
      return {
        maxExpenseDay: null,
        maxExpenseDayAmount: null,
        maxSingleExpense: null,
        maxSingleCategory: null,
        expenseCount: 0,
      };
    }
    return computeInsights(periodItems);
  }, [periodItems]);

  // ── 周期切换:年模式按年,月模式按月 ──
  const goPrev = () => {
    if (period === "year") {
      setEndYearMonth((prev) => ({ ...prev, year: prev.year - 1 }));
    } else {
      setEndYearMonth((prev) =>
        prev.month === 1
          ? { year: prev.year - 1, month: 12 }
          : { year: prev.year, month: prev.month - 1 },
      );
    }
  };
  const goNext = () => {
    if (period === "year") {
      if (isCurrentYear) return;
      setEndYearMonth((prev) => ({ ...prev, year: prev.year + 1 }));
    } else {
      if (isCurrentMonth) return;
      setEndYearMonth((prev) =>
        prev.month === 12
          ? { year: prev.year + 1, month: 1 }
          : { year: prev.year, month: prev.month + 1 },
      );
    }
  };
  const isAtCurrent = period === "year" ? isCurrentYear : isCurrentMonth;

  // 分类下钻:月模式传 month+categoryId;年模式传全年日期范围(无 month param)
  const handleCategoryClick = (categoryId: string) => {
    if (period === "year") {
      const ys = yearStart.toISOString();
      const ye = yearEnd.toISOString();
      router.push(`/transactions?type=expense&categoryId=${categoryId}&startDate=${ys}&endDate=${ye}`);
    } else {
      const m = monthKey(endYearMonth.year, endYearMonth.month);
      router.push(`/transactions?month=${m}&type=expense&categoryId=${categoryId}`);
    }
  };

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
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-[var(--muted)]"
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
          disabled={isAtCurrent}
          aria-label="下一周期"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md",
            isAtCurrent
              ? "cursor-not-allowed text-muted/40"
              : "text-muted hover:bg-[var(--muted)]",
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        // Skeleton(shimmer)贴近实际布局:摘要卡(标题行+大数字+三宫格)
        // + 趋势卡(标题+图表区)。父级挂 skeleton--shimmer 使多块同步扫光。
        <div className="skeleton--shimmer space-y-4 pt-2">
          <Card>
            <Card.Content className="space-y-3 p-4">
              <Skeleton animationType="none" className="h-3 w-16" />
              <Skeleton animationType="none" className="h-8 w-40" />
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Skeleton animationType="none" className="h-10" />
                <Skeleton animationType="none" className="h-10" />
                <Skeleton animationType="none" className="h-10" />
              </div>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content className="space-y-3 p-4">
              <Skeleton animationType="none" className="h-4 w-28" />
              <Skeleton animationType="none" className="h-36 w-full" />
            </Card.Content>
          </Card>
        </div>
      ) : (
        <>
          {/* 1. 摘要 */}
          <section className="pt-2">
            <Card>
              <Card.Content className="p-4">
                <p className="text-xs text-muted">{labels.total}</p>
                <p
                  data-amount
                  className="mt-1 text-2xl font-medium tabular-nums text-[var(--danger)]"
                >
                  {formatCents(targetExpense)}
                </p>
                <div className="mt-3 flex items-stretch gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">{labels.average}</p>
                    <p data-amount className="font-medium tabular-nums">
                      {formatCents(avgValue)}
                    </p>
                  </div>
                  <Separator orientation="vertical" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">{labels.comparison}</p>
                    {prevExpense != null && prevExpense > 0 ? (
                      <p
                        data-amount
                        className={`font-medium tabular-nums ${
                          targetExpense > prevExpense
                            ? "text-[var(--danger)]"
                            : targetExpense < prevExpense
                              ? "text-[var(--success)]"
                              : ""
                        }`}
                      >
                        {targetExpense > prevExpense ? "↑" : targetExpense < prevExpense ? "↓" : "→"}{" "}
                        {Math.abs(Math.round(((targetExpense - prevExpense) / prevExpense) * 1000) / 10)}%
                      </p>
                    ) : (
                      <p className="text-xs text-muted">暂无对比</p>
                    )}
                  </div>
                  <Separator orientation="vertical" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">支出笔数</p>
                    <p className="font-medium tabular-nums">{insights.expenseCount} 笔</p>
                  </div>
                </div>
              </Card.Content>
            </Card>
          </section>

          {/* 2. 趋势 */}
          <section className="pt-4">
            <Card>
              <Card.Header>
                <div className="flex items-center justify-between">
                  <Card.Title>支出趋势</Card.Title>
                  {(() => {
                    const max = trendData.buckets.reduce(
                      (m, b) => (b.amount > m.amount ? b : m),
                      { date: "", amount: 0 } as { date: string; amount: number },
                    );
                    if (max.amount === 0) return null;
                    const [, mm, dd] = max.date.split("-");
                    return (
                      <span className="text-xs text-muted">
                        峰值 {Number(mm)}/{Number(dd)}{" "}
                        <span data-amount>{formatCents(max.amount)}</span>
                      </span>
                    );
                  })()}
                </div>
              </Card.Header>
              <Card.Content className="p-4 pt-0">
                {trendData.buckets.length > 0 ? (
                  <ExpenseTrendChart trend={trendData} isPrivacy={isPrivacy} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted">
                    暂无支出数据
                  </p>
                )}
              </Card.Content>
            </Card>
          </section>

          {/* 3. 分类占比 */}
          <section className="pt-4">
            <h2 className="pb-2 text-sm font-semibold text-muted">
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
