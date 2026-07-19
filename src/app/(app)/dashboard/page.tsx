"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc/client";
import { Card, Skeleton } from "@heroui/react";
import { DashboardTopNav } from "@/components/dashboard/dashboard-top-nav";
import { SummaryHeroCard } from "@/components/dashboard/summary-hero-card";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { AssetOverview } from "@/components/dashboard/asset-overview";
import { CategoryTopList } from "@/components/dashboard/category-top-list";
import type { ExpenseTrend } from "@/components/dashboard/expense-trend-chart";
import {
  useOfflineSummaryPlaceholder,
  useWriteBackSummary,
} from "@/lib/offline/use-offline-cache";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { isPrivacyOn } from "@/lib/privacy";

/**
 * 025 US2 T030:recharts 仅在 ExpenseTrendChart 内使用,且全站首屏热点是
 * Dashboard。把 ExpenseTrendChart 改为 `next/dynamic` 异步加载:
 *   - recharts 不进入 Dashboard first-load bundle(实测 chunk `1111-*.js`
 *     ≈ 108 KB gz)
 *   - 加载期用 Skeleton 占位(h-[200px] 与稳态图表高度一致 → CLS=0,
 *     符合 FR-013)
 *   - ssr:false —— recharts `ResponsiveContainer` 浏览器 ResizeObserver
 *     本就要求 client,SSR 无意义
 *
 * Reports 页(`/reports`)不在热路径,继续直接 import。
 */
const ExpenseTrendChart = dynamic(
  () =>
    import("@/components/dashboard/expense-trend-chart").then(
      (m) => m.ExpenseTrendChart,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] w-full rounded-lg" />,
  },
);

/**
 * DashboardPage (027-mobile-home-revamp US2)。
 *
 * 按《手机端首页设计》(2026-07-14) + 线稿"首页"屏重做。
 *
 * ┌ DashboardTopNav:账本名 + 年月箭头/滑动 + 消息占位 + 隐私开关
 * ├ SummaryHeroCard:本月支出(主数字) + 收入/结余(辅)   [FR-001]
 * ├ CategoryTopList:支出 Top4 横向进度条(点击下钻)    [FR-004]
 * ├ TrendSection:本月每日趋势 + 隐私遮蔽刻度          [FR-005/FR-008]
 * └ RecentSection:最近 5 条(左滑/点编辑/删除+撤销)    [FR-006]
 *
 * 026 → 027 关键变化:
 * - 主数字 结余 → 支出(FR-001)
 * - Top2 卡 → Top4 列表(FR-004)
 * - PageHeader+MonthSelect → DashboardTopNav(箭头+滑动,FR-002)
 * - 趋势隐私补强(YAxis tickFormatter,FR-008)
 * - recent 4 → 5 条(后端 limit)
 *
 * 数据契约:specs/027-mobile-home-revamp/contracts/dashboard-summary.md
 */

/** 返回当前 UTC 年月(初始值)。 */
function currentUtcYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export default function DashboardPage() {
  const [yearMonth, setYearMonth] = useState(currentUtcYearMonth);

  const summaryPlaceholder = useOfflineSummaryPlaceholder(
    yearMonth.year,
    yearMonth.month,
  );
  const summaryQuery = trpc.dashboard.summary.useQuery(
    {
      year: yearMonth.year,
      month: yearMonth.month,
    },
    {
      // 033 US1/US3 network-first 兜底:服务器失败时用 IDB 缓存作 placeholder。
      // 运行时 shape 与 writeCachedSummary 写入一致;cast 安抚 tRPC 泛型。
      placeholderData: summaryPlaceholder as never,
    },
  );
  // 033 US1:服务器成功后异步写回 IDB(下次离线时可兜底)
  useWriteBackSummary(yearMonth.year, yearMonth.month, summaryQuery.data);

  // 030 US2:移除上月 summary 查询与环比徽标(本周窗口下"较上月"语义不成立,
  // FR-009 / Clarification Q4)。原 prevSummaryQuery / comparisonPercent 已删除
  // —— 顺带消除每次首页加载的第二次完整 summary tRPC 查询(p95 净收益),
  // 及 page.tsx:86 的 operator-precedence bug(`?? 0 - prev` 应为 `(?? 0) - prev`)。

  // 隐私态:读 localStorage(客户端)。SSR 默认 false,hydration 后真实。
  // 趋势图 isPrivacy prop 控制刻度遮蔽;文本金额由全局 .privacy-on CSS 遮蔽。
  // 全局 <html>.classList('privacy-on') 由 PrivacyToggle 维护;此处只在
  // mount 时同步一次初始值(切换时 CSS 已即时遮蔽文本,刻度由本 state 驱动
  // 重渲染——为捕捉切换,监听 storage 事件)。
  const [isPrivacy, setIsPrivacy] = useState(false);
  useEffect(() => {
    setIsPrivacy(isPrivacyOn());
    const onStorage = () => setIsPrivacy(isPrivacyOn());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isLoading = summaryQuery.isLoading || !summaryQuery.data;

  return (
    <div>
      <DashboardTopNav
        yearMonth={yearMonth}
        onChange={(year, month) => setYearMonth({ year, month })}
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <DashboardBody
          monthIncome={summaryQuery.data.monthIncome}
          monthExpense={summaryQuery.data.monthExpense}
          monthNet={summaryQuery.data.monthNet}
          dayExpense={summaryQuery.data.dayExpense}
          expenseTrend={summaryQuery.data.expenseTrend}
          topExpenseCategories={summaryQuery.data.topExpenseCategories}
          recentTransactions={summaryQuery.data.recentTransactions}
          budget={summaryQuery.data.budget}
          assets={summaryQuery.data.assets}
          yearMonth={yearMonth}
          isPrivacy={isPrivacy}
        />
      )}
    </div>
  );
}

// ─── 子组件 ────────────────────────────────────────────────────────────

/** 支出趋势区块(FR-005 + FR-008 隐私遮蔽)。030:窗口=本周,无环比徽标。 */
function TrendSection({
  trend,
  isPrivacy,
}: {
  trend: ExpenseTrend;
  isPrivacy: boolean;
}) {
  return (
    <section aria-label="本周支出趋势" className="pt-4">
      <Card>
        <Card.Header>
          {/* 030 US2:标题改"本周支出趋势",明确窗口语义(窗口固定,不随月份)。 */}
          <Card.Title>本周支出趋势</Card.Title>
        </Card.Header>
        <Card.Content className="p-4 pt-0">
          <ExpenseTrendChart trend={trend} isPrivacy={isPrivacy} />
        </Card.Content>
      </Card>
    </section>
  );
}

/** 最近账单(FR-006)。固定最新 5 条,不受月份影响(FR-003)。 */
function RecentSection({
  transactions,
}: {
  transactions: React.ComponentProps<typeof RecentTransactions>["transactions"];
}) {
  return (
    <section aria-label="最近账单" className="pt-4">
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-sm font-medium text-foreground">最近账单</h2>
        <a
          href="/transactions"
          className="text-xs text-muted hover:text-foreground"
        >
          查看明细
        </a>
      </div>
      <RecentTransactions transactions={transactions} isLoading={false} maxItems={3} />
    </section>
  );
}

/** 加载态:用 Skeleton 复刻各区块高度,避免数据到位后布局跳动。 */
function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="pt-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}

// ─── Body 装配 ─────────────────────────────────────────────────────────

function DashboardBody({
  monthIncome,
  monthExpense,
  monthNet,
  dayExpense,
  expenseTrend,
  topExpenseCategories,
  recentTransactions,
  budget,
  assets,
  yearMonth,
  isPrivacy,
}: {
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  dayExpense: number | null;
  expenseTrend: ExpenseTrend;
  topExpenseCategories: React.ComponentProps<typeof CategoryTopList>["items"];
  recentTransactions: React.ComponentProps<typeof RecentTransactions>["transactions"];
  budget: React.ComponentProps<typeof BudgetProgress>["budget"];
  assets: React.ComponentProps<typeof AssetOverview>["assets"];
  yearMonth: { year: number; month: number };
  isPrivacy: boolean;
}) {
  return (
    <>
      <SummaryHeroCard
        monthIncome={monthIncome}
        monthExpense={monthExpense}
        monthNet={monthNet}
        dayExpense={dayExpense}
      />
      <BudgetProgress
        budget={budget}
        monthExpense={monthExpense}
        yearMonth={yearMonth}
      />
      <CategoryTopList items={topExpenseCategories} yearMonth={yearMonth} />
      <TrendSection trend={expenseTrend} isPrivacy={isPrivacy} />
      <RecentSection transactions={recentTransactions} />
      <AssetOverview assets={assets} />
    </>
  );
}
