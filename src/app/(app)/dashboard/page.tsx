"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, Skeleton } from "@heroui/react";
import { MonthSelect } from "@/components/shared/month-select";
import { ExpenseTrendChart } from "@/components/dashboard/expense-trend-chart";
import { TopCategoryCard } from "@/components/dashboard/top-category-card";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { PageHeader } from "@/components/layout/page-header";

/**
 * DashboardPage (026-cream-amber-revamp + 026-switch 第一期 3:PageHeader)。
 *
 * 026-switch 调整:
 *   - 整页 padding 由 AppShell 注入(去掉 px-4 自包,直接用 PageHeader 标题行)
 *   - `<h1>轻记</h1>` 自定义实现替换为 PageHeader(title="首页" + 问候描述)
 *   - PrivacyToggle 进 PageHeader.actions
 *
 * 整合 Phase 4-9 落地的所有子组件到一个连续滚动的移动端首页:
 *
 * ┌ PageHeader:首页 / 问候+昵称 · PrivacyToggle
 * ├       MonthSelect (最近 24 个月,与报表页共用)
 * ├ 主卡:本月结余(monthNet 大字 + 收入/支出)
 * ├ 支出趋势:ExpenseTrendChart (daily 当前月 / weekly 历史月)
 * ├ Top 2 分类:TopCategoryCard (点击下钻 /transactions?month=…&type=expense&categoryId=…)
 * └ 最近流水:RecentTransactions (最新 4 条,不受月份影响)
 *
 * 数据契约:specs/026-cream-amber-revamp/contracts/dashboard-summary.md
 *
 * 关键约束:
 * - MonthSelect 必须显式传 {year, month}(FR-C002);缺省虽然后端也工作,
 *   但本页受 picker 控制,显式参数让缓存 key 稳定 + URL 可推断。
 * - 隐私模式:PrivacyToggle 在 PageHeader 右上,所有金额通过 `[data-amount]`
 *   被 globals.css 的 `.privacy-on [data-amount]` 规则统一遮蔽(FR-C008/C009)。
 * - 最近流水独立于月份(FR-C007):recentTransactions 来自 dashboard.summary,
 *   后端返回最新 4 条,与 yearMonth 无关。
 */

// ─── 工具 ──────────────────────────────────────────────────────────────

/** 把分(整数)转成"¥X.XX"展示串。 */
function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

/**
 * 按 UTC 小时切片返回中文问候(FR-C001):
 * - 6-12 "早上好"
 * - 12-18 "下午好"
 * - 18-6 "晚上好"
 */
function greetingByUtcHour(hour: number): string {
  if (hour >= 6 && hour < 12) return "早上好";
  if (hour >= 12 && hour < 18) return "下午好";
  return "晚上好";
}

/** 返回当前 UTC 年月(用于 MonthSelect 初始值)。 */
function currentUtcYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

// ─── 页面 ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [yearMonth, setYearMonth] = useState(currentUtcYearMonth);

  // auth.me 提供当前 member.displayName 用于问候(FR-C001)。
  // dashboard.summary 受 yearMonth 控制,显示对应月份汇总 + 4 条最新流水。
  const meQuery = trpc.auth.me.useQuery();
  const summaryQuery = trpc.dashboard.summary.useQuery({
    year: yearMonth.year,
    month: yearMonth.month,
  });

  // 问候切片用客户端 UTC 小时(SSR 与客户端 UTC 一致,无 hydration mismatch)。
  const displayName = meQuery.data?.member?.displayName ?? "";
  const isLoading = summaryQuery.isLoading || !summaryQuery.data;

  return (
    <div>
      <PageHeader
        title="首页"
        description={<Greeting displayName={displayName} />}
        actions={<PrivacyToggle />}
      />
      <MonthSelect
        value={yearMonth}
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
          yearMonth={yearMonth}
        />
      )}
    </div>
  );
}

// ─── 子组件 ────────────────────────────────────────────────────────────

/**
 * 问候切片:用当前 UTC 小时动态决定。
 *
 * SSR 与客户端的 UTC 小时相同(UTC 是绝对时间,不随时区变),所以
 * 服务端与客户端渲染结果一致,无 hydration mismatch。直接读
 * `new Date().getUTCHours()` 即可。
 */
function Greeting({ displayName }: { displayName: string }) {
  const hour = new Date().getUTCHours();
  const text = displayName ? `${greetingByUtcHour(hour)} ${displayName}` : greetingByUtcHour(hour);
  return <>{text}</>;
}

/** 主卡:本月结余(FR-C005)。monthNet 大字号,收入/支出作为辅信息。 */
function SummaryHeroCard({
  monthIncome,
  monthExpense,
  monthNet,
}: {
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
}) {
  const netColor = monthNet >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  return (
    <section aria-label="本月结余" className="pt-4">
      <Card>
        <Card.Content className="p-4">
          <p className="text-xs text-muted-foreground">本月结余</p>
          <p
            data-amount
            className={`mt-1 text-3xl font-bold ${netColor}`}
          >
            {formatCents(monthNet)}
          </p>
          <div className="mt-3 flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">收入</span>
              <span data-amount className="font-semibold text-[var(--success)]">
                {formatCents(monthIncome)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">支出</span>
              <span data-amount className="font-semibold text-[var(--danger)]">
                {formatCents(monthExpense)}
              </span>
            </div>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}

/** 支出趋势区块(FR-C003 + FR-C004)。 */
function TrendSection({
  trend,
}: {
  trend: React.ComponentProps<typeof ExpenseTrendChart>["trend"];
}) {
  const isDaily = trend.granularity === "daily";
  return (
    <section aria-label="支出趋势" className="pt-4">
      <Card>
        <Card.Content className="p-4">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            {isDaily ? "本周支出趋势" : "本月支出趋势(按周)"}
          </h2>
          <ExpenseTrendChart trend={trend} />
        </Card.Content>
      </Card>
    </section>
  );
}

/** Top 2 分类卡(FR-C006)。下钻由 TopCategoryCard 内部 router.push 处理。 */
function TopCategoriesSection({
  items,
  yearMonth,
}: {
  items: React.ComponentProps<typeof TopCategoryCard>["items"];
  yearMonth: { year: number; month: number };
}) {
  return (
    <section aria-label="支出 Top 2 分类">
      <h2 className="pt-4 pb-1 text-sm font-medium text-foreground">
        支出 Top 2 分类
      </h2>
      <TopCategoryCard items={items} yearMonth={yearMonth} />
    </section>
  );
}

/** 最近流水(FR-C007)。固定最新 4 条,不受月份影响。 */
function RecentSection({
  transactions,
}: {
  transactions: React.ComponentProps<typeof RecentTransactions>["transactions"];
}) {
  return (
    <section aria-label="最近流水" className="pt-2">
      <h2 className="pt-2 pb-1 text-sm font-medium text-foreground">
        最近流水
      </h2>
      <RecentTransactions transactions={transactions} isLoading={false} />
    </section>
  );
}

/** 加载态:用 Skeleton 复刻各区块高度,避免数据到位后布局跳动。 */
function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      {/* 主卡 */}
      <div className="pt-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
      {/* 趋势 */}
      <div>
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
      {/* Top 分类 */}
      <div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
      {/* 最近流水 */}
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
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
  yearMonth,
}: {
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  expenseTrend: React.ComponentProps<typeof ExpenseTrendChart>["trend"];
  topExpenseCategories: React.ComponentProps<typeof TopCategoryCard>["items"];
  recentTransactions: React.ComponentProps<typeof RecentTransactions>["transactions"];
  yearMonth: { year: number; month: number };
}) {
  return (
    <>
      <SummaryHeroCard
        monthIncome={monthIncome}
        monthExpense={monthExpense}
        monthNet={monthNet}
      />
      <TrendSection trend={expenseTrend} />
      <TopCategoriesSection items={topExpenseCategories} yearMonth={yearMonth} />
      <RecentSection transactions={recentTransactions} />
    </>
  );
}
