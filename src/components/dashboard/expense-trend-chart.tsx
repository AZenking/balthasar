"use client";

/**
 * ExpenseTrendChart (026-cream-amber-revamp, spec US4 / FR-C003 / FR-C004).
 *
 * 首页"按周维度的支出趋势图"。粒度由 dashboard.summary 决定:
 * - 当前月 → daily:本周一至周日,7 桶,每日缺失补零(FR-C003)。
 * - 历史月 → weekly:按该月自然周切分,首尾不完整周仍计入(FR-C004)。
 *
 * 数据契约:specs/026-cream-amber-revamp/contracts/dashboard-summary.md §expenseTrend
 *
 * 实现要点:
 * - recharts BarChart 单系列(支出),颜色映射 HeroUI `--danger` token(支出语义红)。
 * - 可访问性:容器 `role="img"` + `aria-label`(总览)。
 * - 隐私模式:Tooltip 的金额节点挂 `data-amount`,globals.css 的
 *   `.privacy-on [data-amount]` 规则自动隐藏并显示 `***`(research.md R5)。
 * - 空数据(全 0):依然渲染柱条(高度 0),只显示标签;不破坏图表结构。
 *
 * amount 单位:**分**(契约口径),展示层除以 100。
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

// ─── 数据契约(从 dashboard-summary.md §Output Schema 派生) ────────────

type DailyBucket = { date: string; amount: number };
type WeeklyBucket = {
  startDate: string;
  endDate: string;
  label: string;
  amount: number;
};

export type ExpenseTrend =
  | { granularity: "daily"; buckets: DailyBucket[] }
  | { granularity: "weekly"; buckets: WeeklyBucket[] };

interface Props {
  trend: ExpenseTrend;
  /** 卡片标题;不传则不渲染标题行。 */
  title?: string;
  /**
   * 隐私模式(027 FR-008):true 时 YAxis tickFormatter 返回 `••`,
   * 遮蔽金额刻度。Tooltip 金额已挂 data-amount,全局 CSS 自动遮蔽。
   * 趋势图形状保留(符合设计 §4.2"保留形状但隐藏金额刻度")。
   */
  isPrivacy?: boolean;
}

// ─── 共用工具 ──────────────────────────────────────────────────────────

/** 把分转成展示字符串;> 100 元(= 10000 分)用"万"单位保持简洁。 */
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

/**
 * YAxis tickFormatter(027 FR-008 隐私遮蔽)。
 *
 * isPrivacy=true 时返回 `••`(遮蔽金额刻度,趋势图形状保留);
 * 否则返回正常元单位 tick。导出供组件测试锁定行为(T008)。
 */
export function tickFormatter(isPrivacy: boolean, cents: number): string {
  return isPrivacy ? "••" : formatYuanTick(cents);
}

/** 把 'YYYY-MM-DD' 转成短日期(月/日),用于 daily 桶的轴标签。 */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** 把 'YYYY-MM-DD' 转成中文周几缩写(周一..周日),用于 daily 视图 X 轴标签。 */
const CN_WEEKDAY = ["一", "二", "三", "四", "五", "六", "日"];
function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0=Sun..6=Sat
  const isoIdx = dow === 0 ? 6 : dow - 1; // 0=Mon..6=Sun
  return CN_WEEKDAY[isoIdx] ?? "";
}

interface DailyRow {
  label: string; // M/D 短日期(用于 X 轴)
  date: string;
  subLabel: string; // 短日期(用于 Tooltip)
  amount: number;
}

interface WeeklyRow {
  label: string;
  amount: number;
}

/** 自定义 Tooltip:挂 data-amount 走隐私模式 CSS。 */
function DailyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload?: DailyRow }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const row = item.payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">
        {row ? `${row.label} ${row.subLabel}` : ""}
      </div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-muted-foreground">支出</span>
        <span
          data-amount
          className="ml-auto font-medium text-foreground"
        >
          {formatAmount(item.value)}
        </span>
      </div>
    </div>
  );
}

function WeeklyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload?: WeeklyRow }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const row = item.payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{row?.label ?? ""}</div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-muted-foreground">支出</span>
        <span
          data-amount
          className="ml-auto font-medium text-foreground"
        >
          {formatAmount(item.value)}
        </span>
      </div>
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────────

export function ExpenseTrendChart({ trend, title, isPrivacy }: Props) {
  return (
    <section className="w-full" aria-label="本月支出趋势">
      {title ? (
        <h3 className="mb-3 text-sm font-medium text-foreground">{title}</h3>
      ) : null}

      {trend.granularity === "daily" ? (
        <DailyView buckets={trend.buckets} isPrivacy={isPrivacy} />
      ) : (
        <WeeklyView buckets={trend.buckets} isPrivacy={isPrivacy} />
      )}
    </section>
  );
}

// ─── daily 视图:7 桶(周一..周日) ───────────────────────────────────────

function DailyView({
  buckets,
  isPrivacy,
}: {
  buckets: DailyBucket[];
  isPrivacy?: boolean;
}) {
  const rows: DailyRow[] = buckets.map((b) => ({
    label: shortDate(b.date), // 027:改用 M/D 日期刻度(非星期)
    date: b.date,
    subLabel: shortDate(b.date),
    amount: b.amount,
  }));
  const total = buckets.reduce((acc, b) => acc + b.amount, 0);
  const overallAria = `本月每日支出趋势,合计 ${formatAmount(total)}`;

  return (
    <div role="img" aria-label={overallAria}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            interval={Math.max(0, Math.floor(rows.length / 5) - 1)}
          />
          <YAxis
            tickFormatter={(v: number) => tickFormatter(!!isPrivacy, v)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            width={40}
            allowDecimals={false}
          />
          <Tooltip content={<DailyTooltip />} />
          <Line
            type="monotone"
            dataKey="amount"
            name="支出"
            stroke="var(--danger)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--danger)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── weekly 视图:N 桶(4-5 周,首尾不完整) ──────────────────────────────

function WeeklyView({
  buckets,
  isPrivacy,
}: {
  buckets: WeeklyBucket[];
  isPrivacy?: boolean;
}) {
  const rows: WeeklyRow[] = buckets.map((b) => ({
    label: b.label,
    amount: b.amount,
  }));
  const total = buckets.reduce((acc, b) => acc + b.amount, 0);
  const overallAria = `本月按周支出趋势,共 ${buckets.length} 周,合计 ${formatAmount(
    total,
  )}`;

  return (
    <div role="img" aria-label={overallAria}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fontSize: 9, fill: "var(--muted)" }}
            interval={0}
          />
          <YAxis
            tickFormatter={(v: number) => tickFormatter(!!isPrivacy, v)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            width={40}
            allowDecimals={false}
          />
          <Tooltip content={<WeeklyTooltip />} />
          <Line
            type="monotone"
            dataKey="amount"
            name="支出"
            stroke="var(--danger)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--danger)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// 注:daily/weekly 当前均不可点击,Bar 不挂 onClick。如后续需要点击下钻,
// 可参考 reports/monthly-trend-chart.tsx 中 handleBarClick 的实现。
