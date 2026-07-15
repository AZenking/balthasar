"use client";

import { useRouter } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { cn } from "@/lib/utils";

/**
 * RecentTransactions (027-mobile-home-revamp FR-006,线稿对齐)。
 *
 * 最近 5 条(后端 limit 5,不受月份影响 —— FR-003)。每条含分类/备注/
 * 账户/金额/时间。点击进入编辑(/transactions?edit=id)。
 *
 * 线稿口径:最近账单是轻量流水行,无常驻删除/编辑按钮(视觉噪声);
 * 删除/编辑在明细页(/transactions)完成。本组件只做展示 + 点击跳转。
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
}: {
  transactions: Transaction[];
  isLoading: boolean;
}) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-2 px-4">
        {[1, 2, 3, 4, 5].map((i) => (
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

  return (
    <div className="divide-y px-4">
      {transactions.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => router.push(`/transactions?edit=${t.id}`)}
          className={cn(
            "flex w-full items-center justify-between py-3 text-left",
          )}
          aria-label={`编辑 ${t.categoryName ?? "交易"}`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-xl">{t.categoryIcon}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {t.categoryName || "?"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {t.type === "transfer" && t.toAccountName
                  ? `${t.accountName} → ${t.toAccountName}`
                  : `${t.accountName} · ${t.remark || "—"}`}
                {" · "}
                {formatTime(t.occurredAt)}
              </p>
            </div>
          </div>
          <p
            data-amount
            className={`shrink-0 text-sm font-semibold tabular-nums ${
              t.type === "income"
                ? "text-[var(--success)]"
                : t.type === "transfer"
                  ? "text-muted-foreground"
                  : "text-[var(--danger)]"
            }`}
          >
            {t.type === "income" ? "+" : t.type === "transfer" ? "" : "−"}
            {formatAmount(t.amount)}
          </p>
        </button>
      ))}
    </div>
  );
}
