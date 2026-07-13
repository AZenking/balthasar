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
 * 实现要点(research.md R4 决策:禁第三方图表库):
 * - CSS Grid + height percentage,与 reports/monthly-trend-chart.tsx 同风格。
 * - 颜色:支出语义 → HeroUI 默认 `--danger` token(见 globals.css 业务映射)。
 * - 可访问性:容器 `role="img"` + `aria-label`(总览),每桶 `sr-only` 文本(细节)。
 * - 隐私模式:金额文本节点挂 `data-amount`,globals.css 的
 *   `.privacy-on [data-amount]` 规则自动隐藏并显示 `***`(research.md R5)。
 * - 空数据(全 0):依然渲染柱条(高度 0),只显示标签;不破坏图表结构,
 *   dashboard.summary 测试场景"空数据月 buckets 全 0"在此正确显示。
 *
 * amount 单位:**分**(契约口径),展示层除以 100。
 */

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

/** 计算柱状图最大值,最小 1 分避免除零。 */
function calcMaxValue(values: number[]): number {
  let max = 0;
  for (const v of values) max = Math.max(max, v);
  return max > 0 ? max : 1;
}

/** 柱条高度百分比;最小 0(无数据时不显示);最大 100。 */
function heightPct(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return (value / max) * 100;
}

/** 把 'YYYY-MM-DD' 转成短日期(月/日),用于 daily 桶的轴标签。 */
function shortDate(iso: string): string {
  // 'YYYY-MM-DD' → 'M/D'(不带前导零,与 getUtcWeeksInMonth label 风格一致)
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** 把 'YYYY-MM-DD' 转成中文周几缩写(周一..周日),用于 daily 视图 X 轴标签。 */
const CN_WEEKDAY = ["一", "二", "三", "四", "五", "六", "日"];
function weekdayLabel(iso: string): string {
  // JS Date.UTC 月是 0-indexed;ISO YYYY-MM-DD 在 UTC 下 getUTCDay() 返回 0=Sun..6=Sat
  // 我们要 ISO 周一..周日 = 下标 0..6。
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0=Sun..6=Sat
  const isoIdx = dow === 0 ? 6 : dow - 1; // 0=Mon..6=Sun
  return CN_WEEKDAY[isoIdx] ?? "";
}

// ─── 主组件 ────────────────────────────────────────────────────────────

export function ExpenseTrendChart({ trend, title }: Props) {
  return (
    <section className="w-full" aria-label="本月支出趋势">
      {title ? (
        <h3 className="mb-3 text-sm font-medium text-foreground">{title}</h3>
      ) : null}

      {trend.granularity === "daily" ? (
        <DailyView buckets={trend.buckets} />
      ) : (
        <WeeklyView buckets={trend.buckets} />
      )}
    </section>
  );
}

// ─── daily 视图:7 桶(周一..周日),每桶标注 周几 + 金额 ────────────────

function DailyView({ buckets }: { buckets: DailyBucket[] }) {
  const maxValue = calcMaxValue(buckets.map((b) => b.amount));
  const total = buckets.reduce((acc, b) => acc + b.amount, 0);
  const overallAria = `本周支出趋势,周一至周日每日金额,合计 ${formatAmount(
    total,
  )}`;

  return (
    <div role="img" aria-label={overallAria}>
      <div
        className="grid w-full items-end gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${Math.max(buckets.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {buckets.map((b) => {
          const hp = heightPct(b.amount, maxValue);
          const aria = `${weekdayLabel(b.date)}(${shortDate(
            b.date,
          )}) 支出 ${formatAmount(b.amount)}`;
          return (
            <div
              key={b.date}
              className="flex h-32 flex-col items-center justify-end gap-1"
            >
              <span
                data-amount
                className="text-[10px] leading-none text-muted-foreground"
              >
                {formatAmount(b.amount)}
              </span>
              {/* 柱条:height % 还原数据。min-h-[2px] 保证有数据的桶至少可见。 */}
              <div className="flex h-full w-full max-w-[28px] items-end">
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${hp}%`,
                    minHeight: hp > 0 ? "2px" : 0,
                    backgroundColor: "var(--danger)",
                  }}
                  aria-hidden
                />
              </div>
              <span className="text-[11px] leading-none text-muted-foreground">
                {weekdayLabel(b.date)}
              </span>
              <span className="sr-only">{aria}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── weekly 视图:N 桶(4-5 周,首尾不完整),每桶标注 label + 金额 ──────

function WeeklyView({ buckets }: { buckets: WeeklyBucket[] }) {
  const maxValue = calcMaxValue(buckets.map((b) => b.amount));
  const total = buckets.reduce((acc, b) => acc + b.amount, 0);
  const overallAria = `本月按周支出趋势,共 ${buckets.length} 周,合计 ${formatAmount(
    total,
  )}`;

  return (
    <div role="img" aria-label={overallAria}>
      <div
        className="grid w-full items-end gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${Math.max(buckets.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {buckets.map((b) => {
          const hp = heightPct(b.amount, maxValue);
          const aria = `${b.label} 支出 ${formatAmount(b.amount)}`;
          return (
            <div
              key={`${b.startDate}-${b.endDate}`}
              className="flex h-32 flex-col items-center justify-end gap-1"
            >
              <span
                data-amount
                className="text-[10px] leading-none text-muted-foreground"
              >
                {formatAmount(b.amount)}
              </span>
              <div className="flex h-full w-full max-w-[40px] items-end">
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${hp}%`,
                    minHeight: hp > 0 ? "2px" : 0,
                    backgroundColor: "var(--danger)",
                  }}
                  aria-hidden
                />
              </div>
              {/* 周标签:可能横跨月份(e.g. '6/29-7/5');字号 9px 保证不换行。 */}
              <span className="text-[9px] leading-tight text-muted-foreground text-center">
                {b.label}
              </span>
              <span className="sr-only">{aria}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
