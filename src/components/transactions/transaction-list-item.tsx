"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
const formatDate = (date: string | Date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
};

export function TransactionListItem({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: {
    id: string;
    type: string;
    amount: number;
    remark: string;
    occurredAt: string | Date;
    accountName: string | null;
    categoryName: string | null;
    categoryIcon: string | null;
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-xl">{transaction.categoryIcon}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">
            {transaction.categoryName || "?"}
          </p>
          <p className="truncate text-xs text-[var(--muted-foreground)]">
            {transaction.accountName} · {transaction.remark || "—"} ·{" "}
            {formatDate(transaction.occurredAt)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p
          data-amount
          className={cn(
            "text-sm font-semibold tabular-nums",
            transaction.type === "income"
              ? "text-[var(--success)]"
              : "text-[var(--danger)]",
          )}
        >
          {transaction.type === "income" ? "+" : "-"}
          {formatAmount(transaction.amount)}
        </p>
        {/* 编辑按钮:HeroUI ghost 图标按钮 + Tooltip + aria-label + ≥44px 命中 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              onClick={() => onEdit(transaction.id)}
              aria-label={`编辑 ${transaction.categoryName ?? "交易"}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>编辑</TooltipContent>
        </Tooltip>
        {/* 删除按钮:HeroUI destructive(danger)图标按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              onClick={() => onDelete(transaction.id)}
              aria-label={`删除 ${transaction.categoryName ?? "交易"}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>删除</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
