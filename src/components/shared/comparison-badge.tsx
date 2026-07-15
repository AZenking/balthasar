"use client";

import { cn } from "@/lib/utils";

/**
 * ComparisonBadge — 环比/同比对比徽标(共享组件)。
 *
 * 输入当前值与上一周期值,计算百分比变化并显示带方向箭头的彩色徽标。
 * 支出语义:上升=红(增加,坏),下降=绿(减少,好)。
 *
 * previous=0 → "暂无对比"(避免无穷大)。
 * previous=null → "暂无对比"。
 */
export function ComparisonBadge({
  current,
  previous,
  label = "较上月",
}: {
  current: number;
  previous: number | null;
  label?: string;
}) {
  if (previous == null || previous === 0) {
    return (
      <span className="text-xs text-muted-foreground">暂无对比</span>
    );
  }

  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  const isUp = pct > 0;
  const isFlat = Math.abs(pct) < 0.05;
  const color = isFlat
    ? "text-muted-foreground"
    : isUp
      ? "text-[var(--danger)]"
      : "text-[var(--success)]";
  const arrow = isFlat ? "→" : isUp ? "↑" : "↓";

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", color)}
    >
      {label} {arrow} {isFlat ? "持平" : `${Math.abs(pct)}%`}
    </span>
  );
}
