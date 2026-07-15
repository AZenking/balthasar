"use client";

import { useRouter } from "next/navigation";
import { Card } from "@heroui/react";

/**
 * CategoryTopList (027-mobile-home-revamp FR-004).
 *
 * 支出 Top 4 分类横向进度条(替代 026 下架的 Top2 双卡)。点击分类
 * 下钻 /transactions?month=&type=expense&categoryId=。
 *
 * 设计文档 §3.2-5:"默认展示支出最高的四个分类;使用横向进度条表达
 * 分类占比;展示分类名称和金额;点击分类进入带有月份与分类筛选条件
 * 的账单列表"。
 *
 * HeroUI v3:Card 组合式。进度条用纯 div(tailwind rounded-full bg),
 * 不引入额外图表库(YAGNI)。金额挂 data-amount 走隐私遮蔽。
 */
function formatCents(cents: number): string {
  const yuan = cents / 100;
  return `¥${yuan.toFixed(2)}`;
}

export interface CategoryTopItem {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  amount: number;
  percentage: number;
}

export function CategoryTopList({
  items,
  yearMonth,
}: {
  items: CategoryTopItem[];
  yearMonth: { year: number; month: number };
}) {
  const router = useRouter();
  const monthKey = `${yearMonth.year}-${String(yearMonth.month).padStart(2, "0")}`;

  const handleCategoryClick = (categoryId: string) => {
    router.push(`/transactions?month=${monthKey}&type=expense&categoryId=${categoryId}`);
  };

  // 进度条宽度相对最大分类(非 monthExpense),让 Top4 视觉差异更明显。
  const maxAmount = items.length > 0 ? Math.max(...items.map((i) => i.amount)) : 0;

  return (
    <section aria-label="支出分类" className="pt-4">
      <Card>
        <Card.Content className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">支出分类</h2>
            {items.length > 0 && (
              <a
                href="/transactions?type=expense"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                全部
              </a>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">本月暂无支出</p>
          ) : (
            <ul className="space-y-3">
              {items.slice(0, 3).map((item) => {
                const widthPct = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                return (
                  <li key={item.categoryId}>
                    <button
                      type="button"
                      onClick={() => handleCategoryClick(item.categoryId)}
                      className="flex w-full items-center gap-3 text-left"
                      aria-label={`查看 ${item.categoryName} 分类明细`}
                    >
                      <span className="w-12 shrink-0 truncate text-sm text-foreground">
                        {item.categoryIcon ?? ""} {item.categoryName}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                        <span
                          className="block h-full rounded-full bg-[var(--danger)]"
                          style={{ width: `${widthPct}%` }}
                        />
                      </span>
                      <span
                        data-amount
                        className="w-16 shrink-0 text-right text-sm font-medium tabular-nums text-foreground"
                      >
                        {formatCents(item.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
