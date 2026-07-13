"use client";

/**
 * CategoryDonut — recharts 实现的环形图(spec US3 / FR-D002 / FR-D003 / FR-D004)。
 *
 * 实现要点:
 * - recharts PieChart + Pie(innerRadius=60 outerRadius=80)做出 donut 形态;
 *   每段渲染为一个 `<Cell>`,颜色取自 8 色调色板循环。
 * - 每段挂 `onClick` 触发 `onCategoryClick(categoryId)`(payload 反查)。
 * - Tooltip 自定义渲染,挂 `data-amount` 走隐私模式 CSS。
 * - 中央总额用绝对定位 div 叠加,同样挂 `data-attribute`。
 *
 * 颜色策略:用 8 色固定调色板循环(避免随机,保证稳定),与 HeroUI
 * 主题无强耦合,后续若改主题只需替换数组。
 */

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PieSectorDataItem } from "recharts";

export type CategoryItem = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  amount: number; // 分
  percentage: number; // 0-100,一位小数
};

interface Props {
  items: CategoryItem[];
  onCategoryClick?: (categoryId: string) => void;
}

// 固定调色板(8 色),分类多时循环。色相分布均匀,色盲友好度尚可。
const PALETTE = [
  "#C79032", // 琥珀(主色)
  "#3B9B74", // 绿(收入色,此处作次色)
  "#D76555", // 红(支出色)
  "#5B8DEF", // 蓝
  "#9B6BBF", // 紫
  "#E0A458", // 浅琥珀
  "#4AA8A8", // 青
  "#B07B5E", // 棕
];

const INNER_RADIUS = 60;
const OUTER_RADIUS = 80;

function formatAmount(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

interface ChartSlice {
  name: string;
  value: number; // 分
  percentage: number;
  categoryId: string;
}

/** 自定义 Tooltip:挂 data-amount 走隐私模式 CSS。 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload?: ChartSlice;
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const slice = item.payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{item.name}</div>
      <div className="mt-1 flex items-center gap-3" data-amount>
        <span className="text-muted-foreground">金额</span>
        <span className="ml-auto font-medium text-foreground">
          {formatAmount(item.value)}
        </span>
      </div>
      {slice && (
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">占比</span>
          <span className="ml-auto font-medium text-foreground">
            {slice.percentage}%
          </span>
        </div>
      )}
    </div>
  );
}

export function CategoryDonut({ items, onCategoryClick }: Props) {
  // 空数据:不渲染图形,仅显示占位文案
  if (items.length === 0) {
    return (
      <div
        className="flex h-[200px] w-full items-center justify-center text-sm text-muted-foreground"
        data-empty="true"
      >
        本月无支出
      </div>
    );
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const slices: ChartSlice[] = items.map((it) => ({
    name: it.categoryName,
    value: it.amount,
    percentage: it.percentage,
    categoryId: it.categoryId,
  }));

  const clickable = Boolean(onCategoryClick);

  // Pie onClick 第 1 参 PieSectorDataItem.payload 含原始 slice 数据。
  const handlePieClick = clickable
    ? (data: PieSectorDataItem) => {
        const slice = data?.payload as ChartSlice | undefined;
        if (slice?.categoryId) {
          onCategoryClick?.(slice.categoryId);
        }
      }
    : undefined;

  return (
    <div
      className="relative mx-auto w-full"
      style={{ maxWidth: 200, height: 200 }}
      role="img"
      aria-label={`分类支出环形图,共 ${items.length} 个分类,合计 ${formatAmount(
        totalAmount,
      )}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={INNER_RADIUS}
            outerRadius={OUTER_RADIUS}
            startAngle={90}
            endAngle={-270}
            paddingAngle={items.length > 1 ? 1 : 0}
            stroke="none"
            isAnimationActive={false}
            onClick={handlePieClick}
            cursor={clickable ? "pointer" : "default"}
          >
            {slices.map((slice, index) => (
              <Cell key={slice.categoryId} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* 中央总额(覆盖在 svg 之上,绝对定位独立层,不受 svg transform 影响)。 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground">本月支出</span>
        <span
          className="text-lg font-semibold"
          data-amount
          data-amount-cents={totalAmount}
        >
          {formatAmount(totalAmount)}
        </span>
      </div>
    </div>
  );
}
