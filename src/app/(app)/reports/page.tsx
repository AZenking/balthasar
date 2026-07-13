"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { getLast24Months } from "@/lib/date-ranges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthlyTrendChart } from "@/components/reports/monthly-trend-chart";
import { CategoryDonut } from "@/components/reports/category-donut";
import { CategoryBreakdownCard } from "@/components/reports/category-breakdown-card";

/**
 * Reports page (026-cream-amber-revamp, US3 / FR-D001-D005).
 *
 * Layout:
 *   - 顶部:页面标题 + 目标月 Select(HeroUI,枚举最近 24 个月)
 *   - 主卡:近 6 个月收支趋势(MonthlyTrendChart),点击月份切换目标月
 *   - 分类分析区:目标月分类占比 Donut + 分类明细 Card(桌面并排,移动端 375px 上下堆叠)
 *
 * Privacy mode: 金额节点挂 `data-amount`(由子组件负责),全局
 * `.privacy-on [data-amount]` CSS 自动遮蔽,本页无需额外处理。
 */
const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

const parseMonthKey = (key: string): { year: number; month: number } => {
  const [y, m] = key.split("-");
  return { year: Number(y), month: Number(m) };
};

export default function ReportsPage() {
  const router = useRouter();

  // Default target month = current UTC month. Independent of server clock:
  // `dashboard.report` resolves missing input server-side, but we keep the
  // local state so the Select can render a controlled value before the query
  // resolves and so onMonthClick can mutate it without waiting for a refetch.
  const [endYearMonth, setEndYearMonth] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  });

  const months = useMemo(() => getLast24Months(), []);

  const { data, isLoading } = trpc.dashboard.report.useQuery({
    endYear: endYearMonth.year,
    endMonth: endYearMonth.month,
  });

  // Click trend month → switch target month. The same query re-fires, both
  // the trend window and the target-month breakdown update.
  const handleMonthClick = (year: number, month: number) => {
    setEndYearMonth({ year, month });
  };

  // Click category block → drill down to /transactions with month + type +
  // categoryId filters (same shape as dashboard FR-C006).
  const handleCategoryClick = (categoryId: string) => {
    const m = monthKey(endYearMonth.year, endYearMonth.month);
    router.push(`/transactions?month=${m}&type=expense&categoryId=${categoryId}`);
  };

  return (
    <div className="pb-4">
      <h1 className="px-4 pb-2 pt-6 text-xl font-bold">报表</h1>

      {/* Target-month picker — HeroUI Select enumerating the last 24 months. */}
      <div className="px-4 pb-2">
        <Select
          aria-label="选择目标月份"
          value={monthKey(endYearMonth.year, endYearMonth.month)}
          onValueChange={(v) => {
            if (v) setEndYearMonth(parseMonthKey(v));
          }}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="选择月份" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={monthKey(m.year, m.month)} value={monthKey(m.year, m.month)}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading || !data ? (
        <ReportsSkeleton />
      ) : (
        <>
          {/* Trend — full-width main card. Always 6 items (server pads). */}
          <section className="px-4 pt-2">
            <MonthlyTrendChart
              months={data.monthlyTrend}
              targetYearMonth={data.endYearMonth}
              onMonthClick={handleMonthClick}
            />
          </section>

          {/* Category analysis — donut + breakdown card.
              Desktop: side-by-side grid (donut 5/12, breakdown 7/12).
              Mobile (default): stacked single column. */}
          <section className="px-4 pt-4">
            <h2 className="pb-2 text-sm font-semibold text-muted-foreground">
              {data.endYearMonth.year}年{data.endYearMonth.month}月 支出分类
            </h2>
            {data.targetMonthCategoryBreakdown.length === 0 ? (
              <div className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground">
                暂无报表数据
              </div>
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
    <div className="space-y-4 px-4 pt-2">
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <Skeleton className="h-40 w-full rounded-xl md:col-span-5" />
        <Skeleton className="h-40 w-full rounded-xl md:col-span-7" />
      </div>
    </div>
  );
}
