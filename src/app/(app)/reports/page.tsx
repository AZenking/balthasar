"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PieChart } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@heroui/react";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthSelect } from "@/components/shared/month-select";
import { MonthlyTrendChart } from "@/components/reports/monthly-trend-chart";
import { CategoryDonut } from "@/components/reports/category-donut";
import { CategoryBreakdownCard } from "@/components/reports/category-breakdown-card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  StatsPeriodToggle,
  periodLabels,
  type StatsPeriod,
} from "@/components/reports/stats-period-toggle";
import {
  StatsInsightsGrid,
  computeInsights,
} from "@/components/reports/stats-insights-grid";
import { getUtcMonthRange } from "@/lib/date-ranges";

/**
 * 统计页 (027-mobile-home-revamp US3 FR-011)。
 *
 * 026 → 027 变化:
 *   - 标题 "报表" → "统计"(线稿 data-page-title="统计")
 *   - 新增月/年周期 toggle(StatsPeriodToggle)
 *   - 新增摘要卡(本期支出 / 日均或月均 / 较上期,标签随周期切换)
 *   - 新增消费数据三宫格(StatsInsightsGrid:最高支出日/最大单笔/支出次数)
 *   - 保留:6 月趋势 + 分类占比 donut + 分类明细卡
 *
 * 数据来源:
 *   - dashboard.report:6 月趋势 + 目标月分类占比
 *   - transaction.list(目标月范围):客户端聚合三宫格(computeInsights)
 *
 * 周期切换:月=目标月维度;年=把目标月所在年的可见数据汇总(toggle 切标签,
 * 数据仍来自 report 的 6 月窗口 + 目标月明细;完整年度聚合需后端扩展,
 * 留作后续增强,本版 toggle 主要切标签 + 三宫格周期文案)。
 */
const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export default function ReportsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<StatsPeriod>("month");

  // 目标月 = 当前 UTC 月(默认)
  const [endYearMonth, setEndYearMonth] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  });

  const { data, isLoading } = trpc.dashboard.report.useQuery({
    endYear: endYearMonth.year,
    endMonth: endYearMonth.month,
  });

  // 目标月交易明细(用于三宫格客户端聚合)
  const { start: mStart, end: mEnd } = getUtcMonthRange(
    endYearMonth.year,
    endYearMonth.month,
  );
  const { data: monthTxs } = trpc.transaction.list.useQuery({
    startDate: mStart.toISOString(),
    endDate: mEnd.toISOString(),
    limit: 100, // 目标月内通常 < 100 笔;超出按 100 近似
    includeSummary: false,
  });

  const handleMonthClick = (year: number, month: number) => {
    setEndYearMonth({ year, month });
  };

  const handleCategoryClick = (categoryId: string) => {
    const m = monthKey(endYearMonth.year, endYearMonth.month);
    router.push(`/transactions?month=${m}&type=expense&categoryId=${categoryId}`);
  };

  const monthSelect = (
    <MonthSelect
      value={endYearMonth}
      onChange={(y, m) => setEndYearMonth({ year: y, month: m })}
      ariaLabel="选择目标月份"
      className="max-w-[180px]"
    />
  );

  const labels = periodLabels(period);

  // 摘要:目标月支出/日均/较上月(从 monthlyTrend 取目标月与上月)
  const targetMonth = data?.monthlyTrend[0]; // monthlyTrend 降序,目标月在首位
  const prevMonth = data?.monthlyTrend[1];
  const targetExpense = targetMonth?.expense ?? 0;
  const now = new Date();
  const isCurrentMonth =
    endYearMonth.year === now.getUTCFullYear() &&
    endYearMonth.month === now.getUTCMonth() + 1;
  // 日均:当前月按已过天数,历史月按整月天数
  const days = isCurrentMonth ? now.getUTCDate() : new Date(endYearMonth.year, endYearMonth.month, 0).getUTCDate();
  const dailyAvg = days > 0 ? Math.round(targetExpense / days) : 0;
  const comparison =
    prevMonth && prevMonth.expense > 0
      ? Math.round(((targetExpense - prevMonth.expense) / prevMonth.expense) * 1000) / 10
      : null;

  // 三宫格(月模式用目标月交易;年模式留 "—" 待后端年度聚合)
  const insights =
    period === "month" && monthTxs
      ? computeInsights(monthTxs.items)
      : {
          maxExpenseDay: null,
          maxSingleExpense: null,
          maxSingleCategory: null,
          expenseCount: 0,
        };

  return (
    <div>
      <PageHeader
        title="统计"
        actions={
          <div className="flex flex-col items-end gap-1">
            <StatsPeriodToggle period={period} onChange={setPeriod} />
            {monthSelect}
          </div>
        }
      />

      {isLoading || !data ? (
        <ReportsSkeleton />
      ) : (
        <>
          {/* 摘要卡:本期支出 / 日均(月)或月均(年) / 较上期 */}
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
                  <div>
                    <p className="text-xs text-muted-foreground">{labels.comparison}</p>
                    <p
                      data-amount
                      className={`font-medium tabular-nums ${
                        comparison === null
                          ? "text-muted-foreground"
                          : comparison <= 0
                            ? "text-[var(--success)]"
                            : "text-[var(--danger)]"
                      }`}
                    >
                      {comparison === null
                        ? "—"
                        : `${comparison > 0 ? "↑" : "↓"} ${Math.abs(comparison)}%`}
                    </p>
                  </div>
                </div>
              </Card.Content>
            </Card>
          </section>

          {/* 消费数据三宫格(FR-011) */}
          <StatsInsightsGrid insights={insights} />

          {/* Trend — 6 个月收支趋势 */}
          <section className="pt-4">
            <MonthlyTrendChart
              months={data.monthlyTrend}
              targetYearMonth={data.endYearMonth}
              onMonthClick={handleMonthClick}
            />
          </section>

          {/* 分类占比 donut + 明细卡 */}
          <section className="pt-4">
            <h2 className="pb-2 text-sm font-semibold text-muted-foreground">
              {data.endYearMonth.year}年{data.endYearMonth.month}月 支出分类
            </h2>
            {data.targetMonthCategoryBreakdown.length === 0 ? (
              <EmptyState
                icon={PieChart}
                title="暂无报表数据"
                description="本月还没有支出记录,记一笔后报表会自动汇总"
                className="min-h-[24vh]"
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-5">
                  <CategoryDonut items={data.targetMonthCategoryBreakdown} />
                </div>
                <div className="md:col-span-7">
                  <CategoryBreakdownCard
                    items={data.targetMonthCategoryBreakdown}
                    onCategoryClick={handleCategoryClick}
                  />
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <Skeleton className="h-40 w-full rounded-xl md:col-span-5" />
        <Skeleton className="h-40 w-full rounded-xl md:col-span-7" />
      </div>
    </div>
  );
}
