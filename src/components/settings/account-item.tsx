"use client";

import { Pencil, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBalance } from "@/server/domain/account/currency";
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
    archivedAt: Date | null;
  };
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
}) {
  const isArchived = account.archivedAt !== null;
  return (
    <div className={cn(
      "flex items-center justify-between border-b py-3",
      isArchived && "opacity-50"
    )}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{account.name}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {account.currency} · {formatBalance(account.initialBalance, account.currency as any)}
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
