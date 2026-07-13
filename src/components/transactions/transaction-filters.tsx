"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Sentinel for "全部账户/全部分类". shadcn Select (Radix) doesn't allow
// empty-string value, so use a string that cannot collide with uuid/cuid ids.
const ALL_SENTINEL = "__all__";

export interface FilterValues {
  type: "income" | "expense" | undefined;
  accountId: string | undefined;
  categoryId: string | undefined;
}

export function TransactionFilters({
  filters,
  onChange,
}: {
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: accounts } = trpc.account.list.useQuery();
  const { data: categories } = trpc.category.list.useQuery(
    filters.type ? { type: filters.type } : undefined
  );

  const unarchivedAccounts = (accounts ?? []).filter((a) => a.archivedAt === null);

  return (
    <div className="px-4 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <span>{expanded ? "▼" : "▶"}</span>
        筛选
        {(filters.type || filters.accountId || filters.categoryId) && (
          <span className="ml-1 rounded bg-primary/10 px-1.5 text-xs text-primary">
            已筛选
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-3">
          {/* Type */}
          <div className="flex gap-2">
            <button
              onClick={() => onChange({ ...filters, type: undefined, categoryId: undefined })}
              className={cn(
                "rounded-lg px-3 py-1 text-xs",
                !filters.type ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              全部
            </button>
            <button
              onClick={() => onChange({ ...filters, type: "expense", categoryId: undefined })}
              className={cn(
                "rounded-lg px-3 py-1 text-xs",
                filters.type === "expense" ? "bg-red-500 text-white" : "bg-muted"
              )}
            >
              支出
            </button>
            <button
              onClick={() => onChange({ ...filters, type: "income", categoryId: undefined })}
              className={cn(
                "rounded-lg px-3 py-1 text-xs",
                filters.type === "income" ? "bg-green-500 text-white" : "bg-muted"
              )}
            >
              收入
            </button>
          </div>

          {/* Account */}
          <Select
            value={filters.accountId ?? ALL_SENTINEL}
            onValueChange={(v) =>
              onChange({
                ...filters,
                accountId: v === ALL_SENTINEL ? undefined : v,
              })
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="全部账户" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SENTINEL}>全部账户</SelectItem>
              {unarchivedAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category */}
          {filters.type && (
            <Select
              value={filters.categoryId ?? ALL_SENTINEL}
              onValueChange={(v) =>
                onChange({
                  ...filters,
                  categoryId: v === ALL_SENTINEL ? undefined : v,
                })
              }
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>全部分类</SelectItem>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
