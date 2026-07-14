"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { cn } from "@/lib/utils";

/**
 * RecentTransactions (027-mobile-home-revamp FR-006).
 *
 * 最近 5 条(后端 limit 5,不受月份影响 —— FR-003)。每条含分类/备注/
 * 账户/金额/时间。点击进入编辑;删除(hard delete)+ sonner 撤销。
 *
 * 撤销语义(H3 收敛):删除是 hard delete;撤销 = 用原 tx 全字段重新
 * create —— 生成新 id(接受);审计链断开属可接受代价(FK ON DELETE
 * SET NULL 已保留旧审计)。前端 optimistic 回滚 + React Query 用新行
 * 替换。
 *
 * 左滑:HeroUI v3 无原生 Swipeable;当前用"行右侧常驻删除按钮 +
 * 点击编辑"的可达方案(a11y 友好),左滑手势留作后续增强(research R7
 * 已记录降级路径)。
 */
interface Transaction {
  id: string;
  type: string;
  amount: number;
  remark: string;
  occurredAt: string | Date;
  accountName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  // 撤销重建所需的全部字段(serializeTransaction 输出):
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
  const utils = trpc.useUtils();

  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const deleteMutation = trpc.transaction.delete.useMutation({
    onMutate: async ({ id }) => {
      // Optimistic: snapshot + 从缓存移除该行。
      await utils.dashboard.summary.cancel();
      const prev = utils.dashboard.summary.getData();
      setRemovingIds((s) => new Set(s).add(id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      // 回滚
      if (ctx?.prev) utils.dashboard.summary.setData(undefined, ctx.prev);
      toast.error("删除失败,已恢复");
    },
    onSettled: () => {
      utils.dashboard.summary.invalidate();
    },
  });

  const recreateMutation = trpc.transaction.create.useMutation({
    onSuccess: () => {
      utils.dashboard.summary.invalidate();
    },
    onError: () => toast.error("撤销失败"),
  });

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

  const handleDelete = (t: Transaction) => {
    deleteMutation.mutate(
      { id: t.id },
      {
        onSuccess: () => {
          toast.success("已删除", {
            action: {
              label: "撤销",
              // 撤销 = 用原字段重新 create(生成新 id;H3 收敛)。
              onClick: () => {
                recreateMutation.mutate({
                  type: t.type as "income" | "expense",
                  accountId: t.accountId ?? "",
                  categoryId: t.categoryId ?? "",
                  amount: Math.abs(t.amount),
                  remark: t.remark,
                  occurredAt:
                    typeof t.occurredAt === "string"
                      ? t.occurredAt
                      : t.occurredAt.toISOString(),
                });
              },
            },
          });
        },
      },
    );
  };

  return (
    <div className="divide-y px-4">
      {transactions.map((t) => {
        const isRemoving = removingIds.has(t.id);
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-center justify-between py-3 transition-opacity",
              isRemoving && "opacity-40",
            )}
          >
            <button
              type="button"
              onClick={() => router.push(`/transactions?edit=${t.id}`)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-label={`编辑 ${t.categoryName ?? "交易"}`}
            >
              <span className="text-xl">{t.categoryIcon}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {t.categoryName || "?"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.accountName} · {t.remark || "—"} · {formatTime(t.occurredAt)}
                </p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <p
                data-amount
                className={`text-sm font-semibold tabular-nums ${t.type === "income" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
              >
                {t.type === "income" ? "+" : "-"}
                {formatAmount(t.amount)}
              </p>
              <button
                type="button"
                onClick={() => handleDelete(t)}
                disabled={deleteMutation.isPending}
                aria-label={`删除 ${t.categoryName ?? "交易"}`}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-[var(--danger)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
