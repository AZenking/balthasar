import Link from "next/link";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/category/category-icon";

const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
const formatDate = (date: string | Date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
};

/**
 * TransactionListItem (线稿对齐)。
 *
 * 线稿口径:轻量流水行,无常驻编辑/删除按钮(视觉噪声大)。
 * 整行用 <Link> 进入编辑(可中键/⌘点击新标签、可右键复制链接)。
 * 删除在编辑页内完成。
 * 转账行显示 账户A → 账户B。
 *
 * 025 AP-01:删除 `"use client"` —— 本文件零 hooks、零 event handler,
 * 纯 `<Link>` 渲染,Server-renderable(Vercel A1)。
 */
export function TransactionListItem({
  transaction,
  editHref,
}: {
  transaction: {
    id: string;
    type: string;
    amount: number;
    remark: string;
    occurredAt: string | Date;
    accountName: string | null;
    toAccountName?: string | null;
    categoryName: string | null;
    categoryIcon: string | null;
  };
  // 完整编辑链接(含筛选 qs),由父组件构造。用 Link 而非 onClick router.push。
  editHref: string;
}) {
  const isTransfer = transaction.type === "transfer";
  return (
    <Link
      href={editHref}
      className="flex w-full items-center justify-between border-b border-[var(--border)] py-3 text-left outline-none transition-colors focus-visible:bg-[var(--muted)]"
      aria-label={`编辑 ${transaction.categoryName ?? "交易"}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <CategoryIcon name={transaction.categoryIcon ?? "circle-help"} size={20} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">
            {transaction.remark || transaction.categoryName || "?"}
          </p>
          <p className="truncate text-xs text-[var(--muted)]">
            {isTransfer && transaction.toAccountName
              ? `${transaction.categoryName} · ${transaction.accountName} → ${transaction.toAccountName}`
              : `${transaction.categoryName} · ${transaction.accountName}`}
            {" · "}
            {formatDate(transaction.occurredAt)}
          </p>
        </div>
      </div>
      <p
        data-amount
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          transaction.type === "income"
            ? "text-[var(--success)]"
            : isTransfer
              ? "text-[var(--muted)]"
              : "text-[var(--danger)]",
        )}
      >
        {/* 收入 +、支出 −、转账 →(颜色之外加符号,避免仅靠颜色区分) */}
        {transaction.type === "income" ? "+" : isTransfer ? "→" : "−"}
        {formatAmount(transaction.amount)}
      </p>
    </Link>
  );
}
