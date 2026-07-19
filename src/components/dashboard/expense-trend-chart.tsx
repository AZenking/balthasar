"use client";

/**
 * ExpenseTrendChart (026-cream-amber-revamp → 030-home-trend-area-today)。
 *
 * 首页"本周每日支出趋势图"。030 US3:从 LineChart+Line 改为
 * AreaChart+Area + 垂直渐变面积(平滑曲线 + 渐变填充)。粒度由
 * dashboard.summary 决定(030 起恒为 daily 本周 7 桶,与 month 解耦)。
 *
 * 数据契约:specs/030-home-trend-area-today/contracts/dashboard-summary.md §expenseTrend
 *
 * 实现要点(030):
 * - recharts AreaChart 单 Area:顶部描边=平滑折线(monotone),下方=渐变面积。
 *   单元素同时画线 + 填充(research R1),渐变顶 `--danger` 0.4 → 底透明(R2/R7)。
 * - 动画关闭(isAnimationActive=false),保 CLS=0(research R3 / FR-013)。
 * - 可访问性:容器 `role="img"` + `aria-label`(总览)。
 * - 隐私模式:Tooltip 金额 + Y 轴刻度遮蔽;**形状(线 + 面积)保留**(FR-008)。
 *   data-amount 节点由 globals.css `.privacy-on [data-amount]` 自动隐藏。
 * - 空数据(全 0):折线贴 X 轴、面积退化,图表骨架不破坏。
 *
 * amount 单位:**分**(契约口径),展示层除以 100。
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
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
  // undefined 防御:033 离线缓存的旧版 summary 可能缺此字段。
  trend?: ExpenseTrend;
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

/**
 * chartConfig (030-home-trend-area-today US3)——趋势图结构常量。
 *
 * 集中曲线/渐变/动画的视觉决策,供:
 *   - 渲染层(DailyView/WeeklyView)引用,避免重复字面量
 *   - 组件测试(T016)断言结构,无需在 jsdom 渲染 recharts SVG
 *
 * 决策依据见 research.md:
 *   - R1:用 AreaChart+Area(单元素同时画线 + 渐变面积)
 *   - R2:curveType 'monotone'(平滑且不跌破 0,非负数据不 overshoot)
 *   - R3:animationDisabled(关动画,CLS=0,FR-013)
 *   - R7(隐私):形状保留,只遮蔽金额;故 strokeColor / 渐变不参与隐私遮蔽
 */
export const chartConfig = {
  chartType: "area" as const,
  curveType: "monotone" as const,
  strokeColor: "var(--danger)",
  strokeWidth: 2,
  animationDisabled: true,
  gradientIdDaily: "expenseTrendAreaDaily",
  gradientIdWeekly: "expenseTrendAreaWeekly",
  /** 垂直渐变 stops:顶部支出红 0.4 不透明 → 底部全透明(贴 X 轴,FR-007)。 */
  gradientStops: [
    { offset: 0, color: "var(--danger)", opacity: 0.4 },
    { offset: 100, color: "var(--danger)", opacity: 0 },
  ],
  // 兼容字段:旧测试/外部引用统一别名(指向 daily 的默认 id)。
  get gradientId(): string {
    return this.gradientIdDaily;
  },
} as const;

/** 把 'YYYY-MM-DD' 转成短日期(月/日),用于 daily 桶的轴标签。 */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
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
    <div className="rounded-md border border-border bg-overlay px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">
        {row ? `${row.label} ${row.subLabel}` : ""}
      </div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-muted">支出</span>
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
    <div className="rounded-md border border-border bg-overlay px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{row?.label ?? ""}</div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-muted">支出</span>
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
  // nullish 防御:033 IDB placeholder 可能不带 trend 字段(pre-027 旧缓存)。
  // 缺失时静默不渲染(section 不出现),服务器新鲜响应到达后自动补齐。
  if (!trend) {
    return null;
  }
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
  const overallAria = `本周每日支出趋势,合计 ${formatAmount(total)}`;

  return (
    <div role="img" aria-label={overallAria}>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id={chartConfig.gradientIdDaily}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              {chartConfig.gradientStops.map((s) => (
                <stop
                  key={s.offset}
                  offset={`${s.offset}%`}
                  stopColor={s.color}
                  stopOpacity={s.opacity}
                />
              ))}
            </linearGradient>
          </defs>
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
          <Area
            type={chartConfig.curveType}
            dataKey="amount"
            name="支出"
            stroke={chartConfig.strokeColor}
            strokeWidth={chartConfig.strokeWidth}
            fill={`url(#${chartConfig.gradientIdDaily})`}
            dot={{ r: 3, fill: "var(--danger)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={!chartConfig.animationDisabled}
          />
        </AreaChart>
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
        <AreaChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id={chartConfig.gradientIdWeekly}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              {chartConfig.gradientStops.map((s) => (
                <stop
                  key={s.offset}
                  offset={`${s.offset}%`}
                  stopColor={s.color}
                  stopOpacity={s.opacity}
                />
              ))}
            </linearGradient>
          </defs>
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
          <Area
            type={chartConfig.curveType}
            dataKey="amount"
            name="支出"
            stroke={chartConfig.strokeColor}
            strokeWidth={chartConfig.strokeWidth}
            fill={`url(#${chartConfig.gradientIdWeekly})`}
            dot={{ r: 3, fill: "var(--danger)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={!chartConfig.animationDisabled}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// 注:daily/weekly 当前均不可点击,Bar 不挂 onClick。如后续需要点击下钻,
// 可参考 reports/monthly-trend-chart.tsx 中 handleBarClick 的实现。
