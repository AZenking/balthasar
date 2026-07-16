"use client";

import { TransactionListItem } from "@/components/transactions/transaction-list-item";

/**
 * TransactionDayGroup (027-mobile-home-revamp US3 FR-010).
 *
 * 明细页按日分组展示账单,组头显示当日支出/收入/(转账)小计。
 *
 * 设计文档 §3.2(明细页线稿):按日分组,组头 `今天 · 7 月 14 日` +
 * `支出 ¥66 · 转账 ¥500` 小计。
 *
 * 与 026 transactions/page.tsx 内的 groupByDate(相对桶:今日/昨日/本周)
 * 不同:本组件按 **UTC 日历日** 严格分组,组头含绝对日期 + 当日收支小计。
 *
 * 转账不计入收支小计(US4 后;FR-013)。groupLabel 把"今天/昨天"做相对
 * 友好化,其余用绝对日期。
 */

export interface DayGroupTx {
  id: string;
  type: string; // "income" | "expense" | "transfer"(US4 后)
  amount: number; // signed: income +, expense -, transfer +(US4)
  remark: string;
  occurredAt: string | Date;
  accountName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
}

export interface DayGroup {
  key: string; // "YYYY-MM-DD" (UTC)
  label: string; // 友好标签(今天/昨天/绝对日期)
  items: DayGroupTx[];
  subtotal: { income: number; expense: number };
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 当日收支小计(转账不计入)。导出供 T019 单测。 */
export function daySubtotal(items: DayGroupTx[]): {
  income: number;
  expense: number;
} {
  let income = 0;
  let expense = 0;
  for (const t of items) {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += Math.abs(t.amount);
    // transfer 不计入收支小计(FR-013)
  }
  return { income, expense };
}

function friendlyLabel(key: string): string {
  const today = startOfUtcDay(new Date());
  const todayKey = utcDayKey(today);
  const yesterdayKey = utcDayKey(new Date(today.getTime() - 86400000));
  if (key === todayKey) {
    return `今天 · ${formatAbsDate(key)}`;
  }
  if (key === yesterdayKey) {
    return `昨天 · ${formatAbsDate(key)}`;
  }
  return formatAbsDate(key);
}

function formatAbsDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
    date.getUTCDay()
  ];
  return `${m} 月 ${d} 日 · ${weekday}`;
}

/** 按 UTC 日历日分组(降序,最新在前)。导出供 T019 单测。 */
export function groupByUtcDay(items: DayGroupTx[]): DayGroup[] {
  if (items.length === 0) return [];
  const buckets = new Map<string, DayGroupTx[]>();
  for (const t of items) {
    const d = typeof t.occurredAt === "string" ? new Date(t.occurredAt) : t.occurredAt;
    const key = utcDayKey(d);
    const arr = buckets.get(key);
    if (arr) arr.push(t);
    else buckets.set(key, [t]);
  }
  // 降序:最新日在前
  const keys = [...buckets.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return keys.map((key) => {
    const groupItems = buckets.get(key)!;
    return {
      key,
      label: friendlyLabel(key),
      items: groupItems,
      subtotal: daySubtotal(groupItems),
    };
  });
}

function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export function TransactionDayGroup({
  items,
  buildEditHref,
}: {
  items: DayGroupTx[];
  // 由 id 构造编辑链接(含筛选 qs),传给 ListItem 用 <Link> 渲染。
  buildEditHref: (id: string) => string;
}) {
  const groups = groupByUtcDay(items);
  return (
    <>
      {groups.map((group) => (
        <div key={group.key} className="mt-4">
          {/* 组头:日期 + 当日收支小计 */}
          <div className="sticky top-0 z-10 flex items-center justify-between bg-[var(--background)]/80 py-2 text-xs font-medium text-[var(--muted)] backdrop-blur">
            <span>{group.label}</span>
            <span data-amount className="tabular-nums">
              {group.subtotal.expense > 0 && <>支出 {formatCents(group.subtotal.expense)}</>}
              {group.subtotal.expense > 0 && group.subtotal.income > 0 && " · "}
              {group.subtotal.income > 0 && <>收入 {formatCents(group.subtotal.income)}</>}
              {group.subtotal.expense === 0 && group.subtotal.income === 0 && (
                <span className="text-[var(--muted)]">—</span>
              )}
            </span>
          </div>
          <div className="space-y-0">
            {group.items.map((t) => (
              <TransactionListItem
                key={t.id}
                transaction={t}
                editHref={buildEditHref(t.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
