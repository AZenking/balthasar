"use client";

/**
 * MonthlyTrendChart (026-cream-amber-revamp, spec US3 / FR-D001-D004).
 *
 * recharts 实现:6 月**折线图**,收入/支出/结余 3 系列(2026-07-13 修订:
 * 趋势语义用折线比柱状更直观)。
 *
 * 数据契约:specs/026-cream-amber-revamp/contracts/dashboard-report.md
 *   monthlyTrend: 6 项,降序(目标月在首位),每项含
 *   { year, month, label, income(分), expense(分), net(signed 分) }
 *
 * 设计要点:
 * - 数据单位为分;recharts 接受任意 number,直接用分绘图,Tooltip/aria 时除以 100。
 * - 颜色映射 HeroUI v3 默认 token:
 *   收入 → var(--success) 绿 / 支出 → var(--danger) 红 / 结余 → var(--foreground) 灰。
 * - 点击交互:Line onClick / XAxis tick onClick 触发 onMonthClick(year, month)。
 * - 隐私模式:Tooltip 与 SelectedSummary 的金额节点挂 `data-amount`。
 * - 可访问性:ResponsiveContainer 容器 role="img" + aria-label。
 * - 金额格式化:> 10000 分(= 100 元)用"万"单位,否则两位小数。
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
  /** 点击月份触发;不传则不可点 */
  onMonthClick?: (year: number, month: number) => void;
}

/** 把分转换为展示字符串;> 10000 分(= 100 元)用万单位。 */
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
        <div key={p.name} className="flex items-center gap-2" data-amount>
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
  const resolved = data ?? months ?? [];
  const interactive = typeof onMonthClick === "function";

  // recharts 折线图数据需按时间**升序**(从远到近),让线从左到右展开。
  const rows: ChartRow[] = [...resolved]
    .map((it) => ({
      year: it.year,
      month: it.month,
      label: it.label,
      shortLabel: `${it.month}月`,
      income: it.income,
      expense: it.expense,
      net: it.net,
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month);

  const overallAria =
    resolved.length === 0
      ? "近 6 个月无收支数据"
      : `近 ${resolved.length} 个月收支趋势图,包含收入、支出与结余三条折线。`;

  // Line dot onClick:点击月份的数据点触发 onMonthClick。
  // recharts Line 整体 onClick 不传单点 payload;改用 dot onClick 拿单点 row。
  const handleDotClick = interactive
    ? (row: ChartRow) => {
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
            className="inline-block h-0.5 w-4 rounded-sm"
            style={{ backgroundColor: "var(--success)" }}
            aria-hidden
          />
          收入
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4 rounded-sm"
            style={{ backgroundColor: "var(--danger)" }}
            aria-hidden
          />
          支出
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4 rounded-sm"
            style={{ backgroundColor: "var(--foreground)" }}
            aria-hidden
          />
          结余
        </span>
      </div>

      <div role="img" aria-label={overallAria}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="income"
              name="收入"
              stroke="var(--success)"
              strokeWidth={2}
              dot={
                interactive
                  ? { r: 3, fill: "var(--success)", cursor: "pointer", onClick: (data: unknown) => handleDotClick?.((data as { payload?: ChartRow }).payload as ChartRow) }
                  : { r: 3, fill: "var(--success)" }
              }
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="expense"
              name="支出"
              stroke="var(--danger)"
              strokeWidth={2}
              dot={
                interactive
                  ? { r: 3, fill: "var(--danger)", cursor: "pointer", onClick: (data: unknown) => handleDotClick?.((data as { payload?: ChartRow }).payload as ChartRow) }
                  : { r: 3, fill: "var(--danger)" }
              }
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="结余"
              stroke="var(--foreground)"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={
                interactive
                  ? { r: 3, fill: "var(--foreground)", cursor: "pointer", onClick: (data: unknown) => handleDotClick?.((data as { payload?: ChartRow }).payload as ChartRow) }
                  : { r: 3, fill: "var(--foreground)" }
              }
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
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
 * 选中月的数值摘要(可访问文本版数据,补充折线图的视觉表达)。
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
