"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Chip } from "@heroui/react";
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
        className="flex items-center gap-1 text-sm text-[var(--muted-foreground)]"
      >
        <span>{expanded ? "▼" : "▶"}</span>
        筛选
        {(filters.type || filters.accountId || filters.categoryId) && (
          <span className="ml-1 rounded bg-[var(--accent-soft)] px-1.5 text-xs text-[var(--accent)]">
            已筛选
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-3">
          {/* Type — ChipGroup(单选)。
           * HeroUI v3.2.2 Chip 是简单 span,无 .Group 子组件 / selectionMode,
           * 这里手动用 color + variant 表达 active 态:
           *   active → variant="primary" color="accent"(实心 accent)
           *   inactive → 默认(soft default)。
           * 全部 / 收入 / 支出 三态切换。 */}
          <div className="flex gap-2">
            <Chip
              variant={!filters.type ? "primary" : "secondary"}
              color={!filters.type ? "accent" : "default"}
              onClick={() =>
                onChange({ ...filters, type: undefined, categoryId: undefined })
              }
            >
              全部
            </Chip>
            <Chip
              variant={filters.type === "expense" ? "primary" : "secondary"}
              color={filters.type === "expense" ? "danger" : "default"}
              onClick={() =>
                onChange({ ...filters, type: "expense", categoryId: undefined })
              }
            >
              支出
            </Chip>
            <Chip
              variant={filters.type === "income" ? "primary" : "secondary"}
              color={filters.type === "income" ? "success" : "default"}
              onClick={() =>
                onChange({ ...filters, type: "income", categoryId: undefined })
              }
            >
              收入
            </Chip>
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
