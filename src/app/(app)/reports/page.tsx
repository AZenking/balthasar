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
 * 线稿顺序:摘要 → 当月每日趋势 → 分类占比 → 消费数据
 * - 趋势改为"当月每日支出"(原 6 月趋势移除;与首页口径统一)
 * - 月/年 toggle + ‹ › 周期切换 + 隐私入口
 * - 修"最高支出日 ¥0"BUG(computeInsights 返回 maxExpenseDayAmount)
 */
const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function prevMonth(y: number, m: number) {
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
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

  // 用 dashboard.summary 获取当月每日趋势 + 分类 + 预算
  const summaryQuery = trpc.dashboard.summary.useQuery({
    year: endYearMonth.year,
    month: endYearMonth.month,
  });

  // 年模式:全年日期范围;月模式:当月范围
  const yearStart = new Date(Date.UTC(endYearMonth.year, 0, 1));
  const yearEnd = new Date(Date.UTC(endYearMonth.year + 1, 0, 1));
  const { start: mStart, end: mEnd } = getUtcMonthRange(
    endYearMonth.year,
    endYearMonth.month,
  );
  const periodStart = period === "year" ? yearStart : mStart;
  const periodEnd = period === "year" ? yearEnd : mEnd;

  const { data: periodTxs } = trpc.transaction.list.useQuery({
    startDate: periodStart.toISOString(),
    endDate: periodEnd.toISOString(),
    limit: 200,
    includeSummary: false,
  });

  const data = summaryQuery.data;
  const isLoading = summaryQuery.isLoading || !data;

  const handleCategoryClick = (categoryId: string) => {
    const m = monthKey(endYearMonth.year, endYearMonth.month);
    router.push(`/transactions?month=${m}&type=expense&categoryId=${categoryId}`);
  };

  const labels = periodLabels(period);
  const now = new Date();
  const isCurrentMonth =
    endYearMonth.year === now.getUTCFullYear() &&
    endYearMonth.month === now.getUTCMonth() + 1;

  // 年模式:从 periodTxs 客户端聚合全年支出;月模式:用 summary
  const yearExpenses = (periodTxs?.items ?? []).filter((t) => t.type === "expense");
  const targetExpense =
    period === "year"
      ? yearExpenses.reduce((s, t) => s + Math.abs(t.amount), 0)
      : data?.monthExpense ?? 0;
  const dailyAvg =
    period === "year"
      ? Math.round(targetExpense / 12) // 月均
      : (isCurrentMonth
          ? now.getUTCDate()
          : new Date(endYearMonth.year, endYearMonth.month, 0).getUTCDate()) > 0
        ? Math.round(
            targetExpense /
              (isCurrentMonth
                ? now.getUTCDate()
                : new Date(endYearMonth.year, endYearMonth.month, 0).getUTCDate()),
          )
        : 0;

  const insights =
    periodTxs && periodTxs.items.length > 0
      ? computeInsights(periodTxs.items)
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

  return (
    <div>
      {/* 顶部:标题 + 月/年 toggle */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-medium">统计</h1>
        <div className="flex items-center gap-2">
          <StatsPeriodToggle period={period} onChange={setPeriod} />
          <PrivacyToggle />
        </div>
      </div>

      {/* 第二行:‹ 2026 年 7 月 › 周期切换 */}
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
          onClick={() => {
            /* 未来月份不可选(当前月为边界) */
          }}
          disabled={isCurrentMonth}
          aria-label="下一周期"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md",
            isCurrentMonth
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
          {/* 1. 摘要卡 */}
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
                      {formatCents(period === "month" ? dailyAvg : targetExpense)}
                    </p>
                  </div>
                </div>
              </Card.Content>
            </Card>
          </section>

          {/* 2. 当月每日趋势(线稿口径,非 6 月趋势) */}
          <section className="pt-4">
            <Card>
              <Card.Header>
                <Card.Title>支出趋势</Card.Title>
              </Card.Header>
              <Card.Content className="p-4 pt-0">
                <ExpenseTrendChart
                  trend={data.expenseTrend}
                  isPrivacy={isPrivacy}
                />
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
            {data.topExpenseCategories.length === 0 ? (
              <EmptyState
                icon={PieChart}
                title="暂无报表数据"
                description="本月还没有支出记录,记一笔后报表会自动汇总"
                className="min-h-[24vh]"
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-5">
                  <CategoryDonut items={data.topExpenseCategories} />
                </div>
                <div className="md:col-span-7">
                  <CategoryBreakdownCard
                    items={data.topExpenseCategories}
                    onCategoryClick={handleCategoryClick}
                  />
                </div>
              </div>
            )}
          </section>

          {/* 4. 消费数据三宫格 */}
          <StatsInsightsGrid insights={insights} />
        </>
      )}
    </div>
  );
}
