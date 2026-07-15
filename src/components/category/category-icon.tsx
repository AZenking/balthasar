"use client";

import { CircleHelp, type LucideIcon } from "lucide-react";
import { CATEGORY_ICON_MAP, EMOJI_TO_ICON } from "@/lib/constants/category-icons";

/**
 * CategoryIcon (028-category-lucide-icons, T002).
 *
 * 图标名 → lucide 矢量 SVG 组件渲染。所有渲染分类图标的位置统一使用此组件。
 *
 * 兼容策略:
 * 1. 传入合法图标名(如 "utensils") → 渲染对应 lucide 组件
 * 2. 传入旧 emoji 值(过渡期) → 查 EMOJI_TO_ICON 映射 → 渲染对应 lucide 组件
 * 3. 未知名/非白名单脏数据 → 渲染兜底图标 CircleHelp(不抛错、不空白)
 *
 * 无障碍:
 * - 装饰性图标(默认): aria-hidden="true",屏幕阅读器忽略
 * - 语义性图标: 传 aria-label prop,屏幕阅读器读出标签
 */
export function CategoryIcon({
  name,
  size = 20,
  className,
  "aria-label": ariaLabel,
}: {
  name: string;
  size?: number;
  className?: string;
  "aria-label"?: string;
}) {
  // 1. 直接查图标名映射
  let IconComponent: LucideIcon | undefined = CATEGORY_ICON_MAP[name];

  // 2. 旧 emoji 值 → 查 emoji→图标名映射
  if (!IconComponent && EMOJI_TO_ICON[name]) {
    IconComponent = CATEGORY_ICON_MAP[EMOJI_TO_ICON[name]];
  }

  // 3. 兜底:未知名 → CircleHelp(不抛错、不空白)
  const Icon = IconComponent ?? CircleHelp;

  return (
    <Icon
      size={size}
      className={className}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      focusable={false}
    />
  );
}
