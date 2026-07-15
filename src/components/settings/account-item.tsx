"use client";

import { Pencil, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatBalance,
  isSupportedCurrency,
  type Currency,
} from "@/server/domain/account/currency";
import { cn } from "@/lib/utils";

export function AccountItem({
  account,
  onEdit,
  onArchive,
  onUnarchive,
}: {
  account: {
    id: string;
    name: string;
    currency: string;
    initialBalance: number;
    type: "asset" | "debt";
    archivedAt: Date | null;
  };
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
}) {
  const isArchived = account.archivedAt !== null;
  // 收窄 currency 到 Currency 白名单;非白名单回退展示原始值(formatBalance 需要合法币种)。
  const currency: Currency = isSupportedCurrency(account.currency)
    ? account.currency
    : "CNY";
  return (
    <div className={cn(
      "flex items-center justify-between border-b py-3",
      isArchived && "opacity-50"
    )}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{account.name}</p>
          <span className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            account.type === "debt"
              ? "bg-[var(--danger)]/10 text-[var(--danger)]"
              : "bg-[var(--success)]/10 text-[var(--success)]",
          )}>
            {account.type === "debt" ? "负债" : "资产"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {account.currency} · {formatBalance(account.initialBalance, currency)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isArchived ? (
          <>
            <span className="text-xs text-muted-foreground">已归档</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => onUnarchive(account.id)}
                  aria-label={`取消归档 ${account.name}`}
                >
                  <ArchiveRestore className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>取消归档</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => onEdit(account.id)}
                  aria-label={`编辑 ${account.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>编辑</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => onArchive(account.id)}
                  aria-label={`归档 ${account.name}`}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>归档</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
