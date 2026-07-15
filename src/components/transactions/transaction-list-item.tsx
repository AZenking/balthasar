"use client";

import { cn } from "@/lib/utils";

const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
const formatDate = (date: string | Date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
};

/**
 * TransactionListItem (线稿对齐)。
 *
 * 线稿口径:轻量流水行,无常驻编辑/删除按钮(视觉噪声大)。
 * 整行可点击进入编辑;删除在编辑页内完成。
 * 转账行显示 账户A → 账户B。
 */
export function TransactionListItem({
  transaction,
  onEdit,
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
  onEdit: (id: string) => void;
  onDelete?: (id: string) => void; // 保留接口兼容,但默认不渲染按钮
}) {
  const isTransfer = transaction.type === "transfer";
  return (
    <button
      type="button"
      onClick={() => onEdit(transaction.id)}
      className="flex w-full items-center justify-between border-b border-[var(--border)] py-3 text-left"
      aria-label={`编辑 ${transaction.categoryName ?? "交易"}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-xl">{transaction.categoryIcon}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">
            {transaction.remark || transaction.categoryName || "?"}
          </p>
          <p className="truncate text-xs text-[var(--muted-foreground)]">
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
              ? "text-[var(--muted-foreground)]"
              : "text-[var(--danger)]",
        )}
      >
        {transaction.type === "income" ? "+" : isTransfer ? "" : "−"}
        {formatAmount(transaction.amount)}
      </p>
    </button>
  );
}
