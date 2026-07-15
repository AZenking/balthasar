"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, Skeleton } from "@heroui/react";
import { DashboardTopNav } from "@/components/dashboard/dashboard-top-nav";
import { SummaryHeroCard } from "@/components/dashboard/summary-hero-card";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { AssetOverview } from "@/components/dashboard/asset-overview";
import { CategoryTopList } from "@/components/dashboard/category-top-list";
import { ExpenseTrendChart } from "@/components/dashboard/expense-trend-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { isPrivacyOn } from "@/lib/privacy";

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

  const summaryQuery = trpc.dashboard.summary.useQuery({
    year: yearMonth.year,
    month: yearMonth.month,
  });

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

/** 支出趋势区块(FR-005 + FR-008 隐私遮蔽)。 */
function TrendSection({
  trend,
  isPrivacy,
}: {
  trend: React.ComponentProps<typeof ExpenseTrendChart>["trend"];
  isPrivacy: boolean;
}) {
  const isDaily = trend.granularity === "daily";
  return (
    <section aria-label="支出趋势" className="pt-4">
      <Card>
        <Card.Header>
          <Card.Title>
            {isDaily ? "本月支出趋势" : "本月支出趋势(按周)"}
          </Card.Title>
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
    <section aria-label="最近账单" className="pt-2">
      <div className="flex items-center justify-between pb-1 pt-2">
        <h2 className="text-sm font-medium text-foreground">最近账单</h2>
        <a
          href="/transactions"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          查看明细
        </a>
      </div>
      <RecentTransactions transactions={transactions} isLoading={false} />
    </section>
  );
}

/** 加载态:用 Skeleton 复刻各区块高度,避免数据到位后布局跳动。 */
function DashboardSkeleton() {
  return (
    <div className="space-y-3">
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
  expenseTrend: React.ComponentProps<typeof ExpenseTrendChart>["trend"];
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
