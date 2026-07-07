"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

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
          <select
            value={filters.accountId ?? ""}
            onChange={(e) => onChange({ ...filters, accountId: e.target.value || undefined })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">全部账户</option>
            {unarchivedAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Category */}
          {filters.type && (
            <select
              value={filters.categoryId ?? ""}
              onChange={(e) => onChange({ ...filters, categoryId: e.target.value || undefined })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">全部分类</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
