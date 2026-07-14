"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, Skeleton } from "@heroui/react";
import { MonthSelect } from "@/components/shared/month-select";
import { ExpenseTrendChart } from "@/components/dashboard/expense-trend-chart";
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
 * └ 最近流水:RecentTransactions (最新 4 条,不受月份影响)
 *
 * 026-dashboard-ui-refinement 调整:
 * - 移除 Top 2 分类卡(用户反馈:首页信息密度过高;Top 2 已在 reports 页详尽呈现)
 * - TrendSection title 改用 HeroUI Card.Title(语义化,字号字重由 HeroUI token 决定)
 * - 后端 dashboard.summary 仍返回 topExpenseCategories(契约不变),前端不消费
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

/**
 * 主卡:本月结余(FR-C005)。
 *
 * 026-dashboard-ui-refinement 改造:
 * - 大金额 .text-amount(24px)→ 36px(inline override;移动端 375px 友好,
 *   不超过 40px 避免挤压;tabular-nums 已由 .text-amount utility 提供)。
 * - 标签 "本月结余" → "本月结余 · 2026年7月"(更紧凑、带时间上下文)。
 * - 加趋势指示器(进阶方案,基于 expenseTrend):
 *     - daily(当前月):今日 vs 昨日 支出变化 %
 *     - weekly(历史月):最后一周 vs 倒数第二周 支出变化 %
 *   支出↓ = 好 = var(--success) 绿 / 支出↑ = 坏 = var(--danger) 红。
 */
function SummaryHeroCard({
  monthIncome,
  monthExpense,
  monthNet,
  trend,
  yearMonth,
}: {
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  trend: React.ComponentProps<typeof ExpenseTrendChart>["trend"];
  yearMonth: { year: number; month: number };
}) {
  const netColor = monthNet >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  const trendPct = computeExpenseTrendPercent(trend);
  return (
    <section aria-label="本月结余" className="pt-4">
      <Card>
        <Card.Content className="p-4">
          <p className="text-xs text-muted-foreground">
            本月结余 · {yearMonth.year}年{yearMonth.month}月
          </p>
          <p
            data-amount
            className={`mt-1 text-amount ${netColor}`}
            style={{ fontSize: "2.25rem", lineHeight: "2.75rem" }}
          >
            {formatCents(monthNet)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">收入</span>
              <span
                data-amount
                className="font-semibold tabular-nums text-[var(--success)]"
              >
                {formatCents(monthIncome)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">支出</span>
              <span
                data-amount
                className="font-semibold tabular-nums text-[var(--danger)]"
              >
                {formatCents(monthExpense)}
              </span>
            </div>
            {trendPct !== null && <TrendBadge percent={trendPct} />}
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}

/**
 * 从 expenseTrend 派生"支出变化百分比"。
 *
 * - daily(本周 7 桶,周一..周日):用"最后一个有数据的桶" vs "它前一个桶"。
 *   后端按周一..周日补零,所以末桶=今日所在周几;但若今日非周日,后续桶为 0,
 *   取"末位非零桶 vs 前一桶"更稳健。
 * - weekly(4-5 周桶):"最后一桶 vs 倒数第二桶"。
 *
 * 返回 signed 百分比(正=支出增加,负=支出减少)。无足够数据返回 null。
 */
function computeExpenseTrendPercent(
  trend: React.ComponentProps<typeof ExpenseTrendChart>["trend"],
): number | null {
  const amounts =
    trend.granularity === "daily"
      ? trend.buckets.map((b) => b.amount)
      : trend.buckets.map((b) => b.amount);
  if (amounts.length < 2) return null;
  const last = amounts[amounts.length - 1];
  const prev = amounts[amounts.length - 2];
  if (prev === 0) {
    // 前值 0:若 last 也是 0 → 无变化;若 last>0 → 视为 +100%(新增支出)
    if (last === 0) return null;
    return 100;
  }
  return ((last - prev) / prev) * 100;
}

/**
 * 趋势小徽章:`↑ 12.5%` 或 `↓ 8.3%`。
 *
 * 语义:这是**支出**趋势,所以支出减少(负%)→ 绿(好);支出增加(正%)
 * → 红(坏)。颜色编码与方向感刚好与"结余"相反,故不直接复用 netColor。
 */
function TrendBadge({ percent }: { percent: number }) {
  const isUp = percent > 0; // 支出增加
  const isFlat = Math.abs(percent) < 0.05;
  const color = isFlat
    ? "var(--muted)"
    : isUp
      ? "var(--danger)" // 支出↑ 坏
      : "var(--success)"; // 支出↓ 好
  const arrow = isFlat ? "→" : isUp ? "↑" : "↓";
  const label = isFlat ? "持平" : `${arrow} ${Math.abs(percent).toFixed(1)}%`;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
      style={{
        color,
        backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
      }}
      aria-label={`支出环比${isFlat ? "持平" : isUp ? `增加 ${Math.abs(percent).toFixed(1)}%` : `减少 ${Math.abs(percent).toFixed(1)}%`}`}
      data-trend={percent.toFixed(2)}
    >
      <span aria-hidden>{label}</span>
    </span>
  );
}

/** 支出趋势区块(FR-C003 + FR-C004)。
 *  026-dashboard-ui-refinement:title 用 HeroUI Card.Title(默认 h3 + token
 *  字号字重),不再自定义 h2 + text-sm font-medium。 */
function TrendSection({
  trend,
}: {
  trend: React.ComponentProps<typeof ExpenseTrendChart>["trend"];
}) {
  const isDaily = trend.granularity === "daily";
  return (
    <section aria-label="支出趋势" className="pt-4">
      <Card>
        <Card.Header>
          <Card.Title>
            {isDaily ? "本周支出趋势" : "本月支出趋势(按周)"}
          </Card.Title>
        </Card.Header>
        <Card.Content className="p-4 pt-0">
          <ExpenseTrendChart trend={trend} />
        </Card.Content>
      </Card>
    </section>
  );
}

/** 最近流水(FR-C007)。固定最新 4 条,不受月份影响。
 *
 *  本 section 不在 Card 内(RecentTransactions 是平铺列表,直接渲染),
 *  所以保留 h2 而非 Card.Title(Card.Title 必须在 Card 上下文里)。
 *  样式上与 Card.Title 视觉一致(text-sm font-medium text-foreground)。 */
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

/** 加载态:用 Skeleton 复刻各区块高度,避免数据到位后布局跳动。
 *  026-dashboard-ui-refinement:移除 Top 分类占位(Top 2 已下架)。 */
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
  recentTransactions,
  yearMonth,
}: {
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  expenseTrend: React.ComponentProps<typeof ExpenseTrendChart>["trend"];
  recentTransactions: React.ComponentProps<typeof RecentTransactions>["transactions"];
  yearMonth: { year: number; month: number };
}) {
  return (
    <>
      <SummaryHeroCard
        monthIncome={monthIncome}
        monthExpense={monthExpense}
        monthNet={monthNet}
        trend={expenseTrend}
        yearMonth={yearMonth}
      />
      <TrendSection trend={expenseTrend} />
      <RecentSection transactions={recentTransactions} />
    </>
  );
}
