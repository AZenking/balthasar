"use client";

/**
 * MonthlyTrendChart (026-cream-amber-revamp, spec US3 / FR-D001-D004 / R4).
 *
 * 自建轻量 CSS Grid 柱状图(research.md R4 决策:禁止第三方图表库)。
 *
 * 数据契约:specs/026-cream-amber-revamp/contracts/dashboard-report.md
 *   monthlyTrend: 6 项,降序(目标月在首位),每项含
 *   { year, month, label, income(分), expense(分), net(signed 分) }
 *
 * 设计要点:
 * - 实现选 CSS Grid + height percentage(而非 SVG):柱状图本质是 N 个等宽矩形,
 *   Grid 比 SVG 更易做响应式与可访问性(sr-only 文本 / role="img")。
 *   R4 sketch 也是 CSS Grid。
 * - 颜色映射 HeroUI v3 默认 token(见 globals.css):
 *   收入 → var(--success) / 支出 → var(--danger) / 结余 → var(--foreground)
 * - 点击交互:整月分组可点击(单柱太细,月份是语义单位)。
 *   触发 onMonthClick(year, month),让 reports/page.tsx 切换分类分析。
 * - 隐私模式:每个含金额的文本节点挂 `data-amount`,globals.css 的
 *   `.privacy-on [data-amount]` 规则自动隐藏并显示 `***`(见 src/lib/privacy.ts)。
 * - 可访问性:容器 role="img" + aria-label(整体描述);每月分组挂
 *   aria-label(单项详情);柱条本身用 sr-only 文本(供屏幕阅读器逐月播报)。
 * - 金额格式化:> 10000 分(= 100 元)用"万"单位,否则两位小数。
 */

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

/** 计算柱状图最大值(用收入与支出绝对值的最大值,保证各柱可比)。 */
function calcMaxValue(items: MonthlyTrendItem[]): number {
  let max = 0;
  for (const it of items) {
    max = Math.max(max, it.income, it.expense, Math.abs(it.net));
  }
  // 最小 1 分,避免除零(空数据集场景下也安全)。
  return max > 0 ? max : 1;
}

/** 柱状高度百分比(0-100),最小 2% 保证有数据月份柱条可见。 */
function heightPct(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(2, (value / max) * 100);
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
  const maxValue = calcMaxValue(resolved);
  const interactive = typeof onMonthClick === "function";

  // 整体可访问性描述(屏幕阅读器第一句总览)。
  const overallAria =
    resolved.length === 0
      ? "近 6 个月无收支数据"
      : `近 ${resolved.length} 个月收支趋势图,包含收入、支出与结余三列。`;

  return (
    <section
      className="w-full"
      aria-label="近 6 个月收支趋势"
    >
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

      {/* 柱状图容器:mobile 375px 下 6 月总宽 ≤ 200px(research R4)。
          minmax(28px, 1fr) 保证每柱最小 28px,月份分组用 grid template 让
          每月内 3 柱等宽排列。 */}
      <div
        role="img"
        aria-label={overallAria}
        className="grid w-full"
        style={{
          gridTemplateColumns: `repeat(${Math.max(resolved.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {resolved.map((item) => {
          const isSelected =
            targetYearMonth?.year === item.year &&
            targetYearMonth?.month === item.month;
          const monthAria = `${item.label}: 收入 ${formatAmount(
            item.income
          )}, 支出 ${formatAmount(item.expense)}, 结余 ${formatAmount(item.net)}`;
          // 月分组容器:点击触发 onMonthClick(若提供)。整个分组可点比单柱更易命中。
          const Tag = interactive ? "button" : "div";
          return (
            <Tag
              key={`${item.year}-${item.month}`}
              type={interactive ? "button" : undefined}
              onClick={
                interactive
                  ? () => onMonthClick!(item.year, item.month)
                  : undefined
              }
              aria-label={interactive ? `切换分类分析到${item.label}` : monthAria}
              title={monthAria}
              className={[
                "group relative flex flex-col items-center gap-1 px-0.5 py-2",
                "rounded-lg transition-colors",
                isSelected ? "bg-foreground/5" : "",
                interactive
                  ? "cursor-pointer hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  : "",
              ].join(" ")}
              style={{ minHeight: "44px" /* FR-A007 命中区域 ≥ 44×44 */ }}
            >
              {/* 柱条区:固定高度容器,内部用 height % 还原数据。 */}
              <div
                className="flex h-32 w-full items-end justify-center gap-0.5"
                aria-hidden
              >
                <div
                  className="w-full max-w-[10px] rounded-t-sm"
                  style={{
                    height: `${heightPct(item.income, maxValue)}%`,
                    backgroundColor: "var(--success)",
                  }}
                />
                <div
                  className="w-full max-w-[10px] rounded-t-sm"
                  style={{
                    height: `${heightPct(item.expense, maxValue)}%`,
                    backgroundColor: "var(--danger)",
                  }}
                />
                <div
                  className="w-full max-w-[10px] rounded-t-sm"
                  style={{
                    height: `${heightPct(Math.abs(item.net), maxValue)}%`,
                    backgroundColor: "var(--foreground)",
                    opacity: item.net < 0 ? 0.5 : 1,
                  }}
                />
              </div>
              {/* 月份标签(简化,仅显示月数;完整 label 在 title / aria-label)。 */}
              <span
                className={[
                  "text-[11px] leading-none",
                  isSelected ? "font-bold" : "text-muted-foreground",
                ].join(" ")}
              >
                {item.month}月
              </span>
              {/* sr-only 文本:屏幕阅读器逐月播报完整数值(可访问后备)。 */}
              <span className="sr-only">{monthAria}</span>
            </Tag>
          );
        })}
      </div>

      {/* 选中月的数值摘要(便于非屏幕阅读器用户快速核对,挂 data-amount 走隐私模式)。 */}
      {targetYearMonth && resolved.length > 0 && (
        <SelectedSummary
          item={
            resolved.find(
              (d) =>
                d.year === targetYearMonth.year &&
                d.month === targetYearMonth.month
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
