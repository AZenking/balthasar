"use client";

import * as React from "react";

/**
 * CategoryDonut — 自建 SVG 环形图(spec US3 / FR-D002 / FR-D003 / FR-D004)。
 *
 * 实现要点(research.md R4):
 * - SVG `<circle>` + `stroke-dasharray` + `stroke-dashoffset` 计算每段弧长;
 *   每段是一个独立的 `<circle>`,叠加在同一个 `<svg>` 内,通过 dasharray
 *   截取该段弧长 + dashoffset 旋转到正确起点。
 * - 每段挂 `onClick` 触发 `onCategoryClick(categoryId)` 完成下钻。
 * - 每段内嵌 `<title>` 作为可访问文本后备(spec FR-D004 / SC-004)。
 * - 中央总额挂 `data-attribute`(隐私模式 CSS 隐藏;research.md R5)。
 *
 * 颜色策略:用 8 色固定调色板循环(避免随机,保证稳定),与 HeroUI
 * 主题无强耦合,后续若改主题只需替换数组。
 */

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

// 环形图几何参数
const SIZE = 200; // SVG viewBox 边长
const STROKE_WIDTH = 28; // 圆环宽度
const RADIUS = (SIZE - STROKE_WIDTH) / 2; // 半径 = 86
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // 周长,用于 dasharray 计算
const CENTER = SIZE / 2; // 圆心 = 100

function formatAmount(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
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

  // 累积偏移量:每段从上一段终点开始绘制
  let cumulativePercentage = 0;

  return (
    <div
      className="relative mx-auto"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={`分类支出环形图,共 ${items.length} 个分类,合计 ${formatAmount(totalAmount)}`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        // 旋转 -90deg 让第一段从顶部 12 点钟方向开始
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* 底环:无点击、浅灰,提供视觉容器 */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="oklch(0.97 0 0)"
          strokeWidth={STROKE_WIDTH}
        />

        {items.map((item, index) => {
          // dasharray = [本段弧长, 剩余周长]
          const segmentLength = (item.percentage / 100) * CIRCUMFERENCE;
          const dashArray = `${segmentLength} ${CIRCUMFERENCE - segmentLength}`;
          // dashoffset = 周长 - 已累积弧长(让段起点对齐)
          const dashOffset = CIRCUMFERENCE
            - (cumulativePercentage / 100) * CIRCUMFERENCE;
          const color = PALETTE[index % PALETTE.length];
          const clickable = Boolean(onCategoryClick);

          const segment = (
            <circle
              key={item.categoryId}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              // hover 高亮:仅可点击时启用,避免空回调误以为可点
              style={{
                cursor: clickable ? "pointer" : "default",
                transition: "stroke-width 150ms ease",
              }}
              onClick={
                clickable
                  ? () => onCategoryClick?.(item.categoryId)
                  : undefined
              }
              onMouseEnter={(e) => {
                if (clickable) {
                  e.currentTarget.style.strokeWidth = `${STROKE_WIDTH + 4}`;
                }
              }}
              onMouseLeave={(e) => {
                if (clickable) {
                  e.currentTarget.style.strokeWidth = `${STROKE_WIDTH}`;
                }
              }}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={`${item.categoryName} ${formatAmount(item.amount)} 占比 ${item.percentage}%`}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onCategoryClick?.(item.categoryId);
                      }
                    }
                  : undefined
              }
            >
              <title>
                {`${item.categoryName}: ${formatAmount(item.amount)} (${item.percentage}%)`}
              </title>
            </circle>
          );

          cumulativePercentage += item.percentage;
          return segment;
        })}
      </svg>

      {/* 中央总额(覆盖在 svg 之上,需反向旋转抵消 svg 的 -90deg 不必要 — 此处用绝对定位独立层,不受 svg transform 影响) */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        // 整个 donut 中心区域可点击下钻(任选一类的下钻不太合理,故中心不挂 onClick;
        // 此处仅展示总额,下钻交互在单段和外层 Card 列表完成)
      >
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
