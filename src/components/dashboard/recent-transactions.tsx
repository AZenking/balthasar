import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { ListBox, Skeleton } from "@heroui/react";
import { EmptyState } from "@/components/feedback/empty-state";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/category/category-icon";

/**
 * RecentTransactions (027-mobile-home-revamp FR-006,线稿对齐)。
 *
 * 最近 5 条(后端 limit 5,不受月份影响 —— FR-003)。每条含分类/备注/
 * 账户/金额/时间。整行用 `<Link>` 跳编辑页(`/transactions?edit=id`),
 * 中键/⌘点击可新标签打开,右键可复制链接 —— 比 025 前 `useRouter`+`onAction`
 * 更 a11y 且支持浏览器原生 shortcut(025 spec AP-03)。
 *
 * 线稿口径:最近账单是轻量流水行,无常驻删除/编辑按钮(视觉噪声);
 * 删除/编辑在明细页(/transactions)完成。本组件只做展示 + 链接跳转。
 *
 * Server-renderable —— 无 hooks、无客户端能力(025 FR-003/FR-007)。
 */
interface Transaction {
  id: string;
  type: string;
  amount: number;
  remark: string;
  occurredAt: string | Date;
  accountName: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  accountId?: string;
  categoryId?: string;
}

export function RecentTransactions({
  transactions,
  isLoading,
  maxItems,
}: {
  transactions: Transaction[];
  isLoading: boolean;
  maxItems?: number;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="暂无交易"
        description="记一笔,流水会显示在这里"
        className="min-h-[20vh]"
      />
    );
  }

  const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
  const formatTime = (date: string | Date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const displayItems = maxItems ? transactions.slice(0, maxItems) : transactions;

  return (
    <ListBox
      aria-label="最近交易"
      selectionMode="none"
      items={displayItems}
      className="divide-y outline-none"
    >
      {(t) => (
        <ListBox.Item
          key={t.id}
          id={t.id}
          textValue={t.remark || t.categoryName || "交易"}
          className="cursor-pointer outline-none data-[focus-visible]:bg-default/50"
        >
          <Link
            href={`/transactions?edit=${t.id}`}
            className="flex w-full items-center justify-between py-3"
            aria-label={`编辑 ${t.remark || t.categoryName || "交易"}`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <CategoryIcon name={t.categoryIcon ?? "circle-help"} size={20} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {t.remark || t.categoryName || "?"}
                </p>
                <p className="truncate text-xs text-muted">
                  {t.type === "transfer" && t.toAccountName
                    ? `${t.categoryName} · ${t.accountName} → ${t.toAccountName}`
                    : `${t.categoryName} · ${t.accountName}`}
                  {" · "}
                  {formatTime(t.occurredAt)}
                </p>
              </div>
            </div>
            <p
              data-amount
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                t.type === "income"
                  ? "text-[var(--success)]"
                  : t.type === "transfer"
                    ? "text-muted"
                    : "text-[var(--danger)]",
              )}
            >
              {t.type === "income" ? "+" : t.type === "transfer" ? "" : "−"}
              {formatAmount(t.amount)}
            </p>
          </Link>
        </ListBox.Item>
      )}
    </ListBox>
  );
}
