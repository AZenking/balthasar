"use client";

import * as React from "react";
import { Card, ListBox, Meter } from "@heroui/react";
import type { CategoryItem } from "./category-donut";
import { categoryColor } from "./palette";
import { CategoryIcon } from "@/components/category/category-icon";

/**
 * CategoryBreakdownCard — 分类分析列表卡(spec US3 / FR-D002 / FR-D003)。
 *
 * 用 HeroUI 原生 `<Card>` 组合式 API(`<Card.Header>` / `<Card.Content>`)。
 * 列表每项显示 {icon} {name} {amount} ({percentage}%),点击触发
 * `onCategoryClick(categoryId)` 下钻到账单页(由父组件实现路由)。
 *
 * 金额元素挂 `data-attribute`(隐私模式 CSS 隐藏;research.md R5)。
 * 空数据(目标月无支出)显示"本月无支出"占位文案。
 */

interface Props {
  items: CategoryItem[];
  onCategoryClick?: (categoryId: string) => void;
}

function formatAmount(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

/** 单行分类内容:色点 + 图标 + 名称 + 金额 + 占比 + 视觉条(从原 button 内容抽出)。 */
function CategoryRowContent({ item, index }: { item: CategoryItem; index: number }) {
  return (
    <div className="flex w-full flex-col gap-2 py-3" aria-label={`${item.categoryName} 支出 ${formatAmount(item.amount)} 占比百分之 ${item.percentage}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          {/* 同色 dot:与环形图段一一对应(共享 ./palette)。 */}
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-sm"
            style={{ backgroundColor: categoryColor(index) }}
            aria-hidden="true"
          />
          {item.categoryIcon ? (
            <CategoryIcon name={item.categoryIcon} size={20} />
          ) : null}
          <span className="truncate text-foreground">
            {item.categoryName}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-1 text-sm tabular-nums">
          <span
            className="font-medium text-foreground"
            data-amount
            data-amount-cents={item.amount}
          >
            {formatAmount(item.amount)}
          </span>
          <span className="text-muted-foreground">
            ({item.percentage}%)
          </span>
        </span>
      </span>
      {/* 占比视觉条:HeroUI Meter,fill 用 categoryColor 与 dot/
          环形图同色(共享 ./palette),由 Fill inline style 覆盖默认色。
          列表项内装饰条,数据已由 aria-label/文字表达,故 aria-hidden。 */}
      <Meter
        value={item.percentage}
        minValue={0}
        maxValue={100}
        size="sm"
        aria-hidden="true"
      >
        <Meter.Track>
          <Meter.Fill style={{ backgroundColor: categoryColor(index) }} />
        </Meter.Track>
      </Meter>
    </div>
  );
}

export function CategoryBreakdownCard({ items, onCategoryClick }: Props) {
  const clickable = Boolean(onCategoryClick);

  return (
    <Card>
      <Card.Header className="px-4 pt-4 pb-2">
        <Card.Title className="text-base font-semibold">分类分析</Card.Title>
      </Card.Header>
      <Card.Content className="px-4 pb-4">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            本月无支出
          </p>
        ) : (
          <ListBox
            aria-label="分类分析列表"
            selectionMode="none"
            items={items}
            onAction={(key) => {
              if (clickable) onCategoryClick?.(String(key));
            }}
            className="-mx-1 divide-y divide-border"
          >
            {(item) => (
              <ListBox.Item
                key={item.categoryId}
                id={item.categoryId}
                textValue={item.categoryName}
                className="cursor-pointer outline-none data-[focus-visible]:bg-muted/50"
              >
                <CategoryRowContent
                  item={item}
                  index={items.findIndex((i) => i.categoryId === item.categoryId)}
                />
              </ListBox.Item>
            )}
          </ListBox>
        )}
      </Card.Content>
    </Card>
  );
}
