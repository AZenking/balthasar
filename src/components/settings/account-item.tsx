"use client";

import { useState } from "react";
import { Pencil, Archive, ArchiveRestore, MoreHorizontal } from "lucide-react";
import { Button, ListBox, Popover } from "@heroui/react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  // 菜单动作分发
  const handleAction = (key: React.Key) => {
    setMenuOpen(false);
    if (key === "edit") onEdit(account.id);
    else if (key === "archive") onArchive(account.id);
    else if (key === "unarchive") onUnarchive(account.id);
  };

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
        <p className="text-xs text-muted tabular-nums">
          {account.currency} · {formatBalance(account.initialBalance, currency)}
        </p>
      </div>

      {isArchived ? (
        <span className="shrink-0 text-xs text-muted">已归档</span>
      ) : null}

      <Popover isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <Popover.Trigger>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            className="shrink-0 min-h-[44px] min-w-[44px]"
            aria-label={`${account.name} 操作`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="w-40 p-1" placement="bottom end">
          {!isArchived ? (
            <ListBox
              aria-label={`${account.name} 操作菜单`}
              selectionMode="none"
              onAction={handleAction}
            >
              <ListBox.Item id="edit" textValue="编辑">
                <div className="flex min-h-[36px] items-center gap-2 rounded-sm px-2 text-sm hover:bg-default">
                  <Pencil className="h-4 w-4 text-muted" />
                  编辑
                </div>
              </ListBox.Item>
              <ListBox.Item id="archive" textValue="归档">
                <div className="flex min-h-[36px] items-center gap-2 rounded-sm px-2 text-sm text-danger hover:bg-default">
                  <Archive className="h-4 w-4" />
                  归档
                </div>
              </ListBox.Item>
            </ListBox>
          ) : (
            <ListBox
              aria-label={`${account.name} 操作菜单`}
              selectionMode="none"
              onAction={handleAction}
            >
              <ListBox.Item id="unarchive" textValue="取消归档">
                <div className="flex min-h-[36px] w-full items-center gap-2 rounded-sm px-2 text-sm hover:bg-default">
                  <ArchiveRestore className="h-4 w-4 text-muted" />
                  取消归档
                </div>
              </ListBox.Item>
            </ListBox>
          )}
        </Popover.Content>
      </Popover>
    </div>
  );
}
