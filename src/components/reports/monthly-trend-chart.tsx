"use client";

/**
 * MonthlyTrendChart (026-cream-amber-revamp, spec US3 / FR-D001-D004).
 *
 * recharts 实现:6 月分组柱状图,收入/支出/结余 3 系列。
 *
 * 数据契约:specs/026-cream-amber-revamp/contracts/dashboard-report.md
 *   monthlyTrend: 6 项,降序(目标月在首位),每项含
 *   { year, month, label, income(分), expense(分), net(signed 分) }
 *
 * 设计要点:
 * - 数据单位为分;recharts 接受任意 number,直接用分绘图,Tooltip/aria 时除以 100。
 * - 颜色映射 HeroUI v3 默认 token(见 globals.css / heroui.min.css):
 *   收入 → var(--success) 绿 / 支出 → var(--danger) 红 / 结余 → var(--foreground) 灰。
 * - 点击交互:Bar onClick 触发 onMonthClick(year, month)。
 * - 隐私模式:Tooltip 与 SelectedSummary 的金额节点挂 `data-amount`,
 *   globals.css 的 `.privacy-on [data-amount]` 规则自动隐藏并显示 `***`。
 * - 可访问性:ResponsiveContainer 容器 role="img" + aria-label(总览);
 *   Bar 自带 `<title>`(recharts 默认)提供单柱 hover 描述。
 * - 金额格式化:> 10000 分(= 100 元)用"万"单位,否则两位小数。
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarRectangleItem,
} from "recharts";

export type MonthlyTrendItem = {
  year: number;
  month: number; // 1-12
  label: string; // '2026年7月'
  income: number; // 分(正)
  expense: number; // 分(正)
  net: number; // signed 分
};

interface MonthlyTrendChartProps {
  /** 6 项,降序(目标月在首位)。 */
  data?: MonthlyTrendItem[];
  /** 别名:与 reports/page.tsx 整合方契约对齐(research R4 sketch 用 data)。 */
  months?: MonthlyTrendItem[];
  /** 高亮当前选中月(目标月) */
  targetYearMonth?: { year: number; month: number };
  /** 点击月份分组触发;不传则不可点 */
  onMonthClick?: (year: number, month: number) => void;
}

/** 把分转换为展示字符串;> 10000 分(= 100 元)用万单位(research R4)。 */
function formatAmount(cents: number): string {
  const yuan = cents / 100;
  if (Math.abs(yuan) >= 10000) {
    return `¥${(yuan / 10000).toFixed(1)}万`;
  }
  return `¥${yuan.toFixed(2)}`;
}

/** 把分转成以"元"为单位的可读 tick(用于 Y 轴)。 */
function formatYuanTick(cents: number): string {
  const yuan = cents / 100;
  if (Math.abs(yuan) >= 10000) {
    return `${(yuan / 10000).toFixed(0)}万`;
  }
  return `${Math.round(yuan)}`;
}

interface ChartRow {
  year: number;
  month: number;
  label: string;
  shortLabel: string; // '7月'
  income: number;
  expense: number;
  net: number;
  absNet: number; // 结余取绝对值绘柱
}

/** 自定义 Tooltip:挂 data-amount 走隐私模式 CSS。 */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {payload.map((p) => (
        <div
          key={p.name}
          className="flex items-center gap-2"
          data-amount
        >
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: p.color }}
            aria-hidden
          />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium text-foreground">
            {formatAmount(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MonthlyTrendChart({
  data,
  months,
  targetYearMonth,
  onMonthClick,
}: MonthlyTrendChartProps) {
  // 兼容 `data` 与 `months` 两种 prop 名(整合 agent 与 spec 样板字段名不同);
  // 任一存在即取用,以 data 为优先。
  const resolved = data ?? months ?? [];
  const interactive = typeof onMonthClick === "function";

  const rows: ChartRow[] = resolved.map((it) => ({
    year: it.year,
    month: it.month,
    label: it.label,
    shortLabel: `${it.month}月`,
    income: it.income,
    expense: it.expense,
    net: it.net,
    absNet: Math.abs(it.net),
  }));

  const overallAria =
    resolved.length === 0
      ? "近 6 个月无收支数据"
      : `近 ${resolved.length} 个月收支趋势图,包含收入、支出与结余三列。`;

  // Bar onClick 回调:recharts 第 1 参 BarRectangleItem.payload 含原始 row 数据。
  const handleBarClick = interactive
    ? (data: BarRectangleItem) => {
        const row = data?.payload as ChartRow | undefined;
        if (row && typeof row.year === "number" && typeof row.month === "number") {
          onMonthClick?.(row.year, row.month);
        }
      }
    : undefined;

  return (
    <section className="w-full" aria-label="近 6 个月收支趋势">
      {/* 图例 */}
      <div className="mb-3 flex items-center justify-end gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: "var(--success)" }}
            aria-hidden
          />
          收入
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: "var(--danger)" }}
            aria-hidden
          />
          支出
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: "var(--foreground)" }}
            aria-hidden
          />
          结余
        </span>
      </div>

      <div role="img" aria-label={overallAria}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={rows}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="20%"
            barGap={2}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="oklch(0.9 0.004 286.32)"
            />
            <XAxis
              dataKey="shortLabel"
              tickLine={false}
              axisLine={{ stroke: "oklch(0.9 0.004 286.32)" }}
              tick={{ fontSize: 11, fill: "oklch(0.5517 0.0138 285.94)" }}
            />
            <YAxis
              tickFormatter={formatYuanTick}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "oklch(0.5517 0.0138 285.94)" }}
              width={48}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "oklch(0.2103 0.0059 285.89 / 0.05)" }}
            />
            <Bar
              dataKey="income"
              name="收入"
              fill="var(--success)"
              radius={[3, 3, 0, 0]}
              onClick={handleBarClick}
              cursor={interactive ? "pointer" : "default"}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expense"
              name="支出"
              fill="var(--danger)"
              radius={[3, 3, 0, 0]}
              onClick={handleBarClick}
              cursor={interactive ? "pointer" : "default"}
              isAnimationActive={false}
            />
            <Bar
              dataKey="absNet"
              name="结余"
              fill="var(--foreground)"
              fillOpacity={0.7}
              radius={[3, 3, 0, 0]}
              onClick={handleBarClick}
              cursor={interactive ? "pointer" : "default"}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 选中月的数值摘要(便于非屏幕阅读器用户快速核对,挂 data-amount 走隐私模式)。 */}
      {targetYearMonth && resolved.length > 0 && (
        <SelectedSummary
          item={
            resolved.find(
              (d) =>
                d.year === targetYearMonth.year &&
                d.month === targetYearMonth.month,
            ) ?? resolved[0]
          }
        />
      )}
    </section>
  );
}

/**
 * 选中月的数值摘要(可访问文本版数据,补充柱状图的视觉表达)。
 * 每个金额节点挂 `data-amount` → 全局 CSS `.privacy-on [data-amount]` 自动隐藏。
 */
function SelectedSummary({ item }: { item: MonthlyTrendItem }) {
  return (
    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
      <div>
        <dt className="text-[11px] text-muted-foreground">收入</dt>
        <dd
          data-amount
          className="text-sm font-bold"
          style={{ color: "var(--success)" }}
        >
          {formatAmount(item.income)}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] text-muted-foreground">支出</dt>
        <dd
          data-amount
          className="text-sm font-bold"
          style={{ color: "var(--danger)" }}
        >
          {formatAmount(item.expense)}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] text-muted-foreground">结余</dt>
        <dd
          data-amount
          className="text-sm font-bold"
          style={{ color: "var(--foreground)" }}
        >
          {formatAmount(item.net)}
        </dd>
      </div>
    </dl>
  );
}
