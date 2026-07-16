"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Tabs, Select, ListBox } from "@heroui/react";

// Sentinel for "全部账户/全部分类". shadcn Select (Radix) doesn't allow
// empty-string value, so use a string that cannot collide with uuid/cuid ids.
const ALL_SENTINEL = "__all__";

// Type tab ids — `__all__` 表示无类型筛选。
type TypeTab = "__all__" | "expense" | "income" | "transfer";

// US4(转账)已落地:transfer 类型在 DB/procedure 已支持。flag 翻 true。
// transaction.list 的 type zod 需同步加 transfer(见 router list input)。
export const TRANSFER_TAB_ENABLED = true;

export interface FilterValues {
  type: "income" | "expense" | "transfer" | undefined;
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
  // category.list type 是 income|expense;transfer 无分类,不传 type。
  const catQueryType =
    filters.type === "income" || filters.type === "expense"
      ? { type: filters.type }
      : undefined;
  const { data: categories } = trpc.category.list.useQuery(catQueryType);

  const unarchivedAccounts = (accounts ?? []).filter((a) => a.archivedAt === null);

  // 当前类型 tab(selectedKey 是 React.Key union,需 cast)。
  const currentTab: TypeTab = filters.type ?? "__all__";

  const handleTabChange = (key: React.Key | null) => {
    const tab = String(key) as TypeTab;
    onChange({
      ...filters,
      type: tab === "__all__" ? undefined : tab,
      // 切类型时清空分类(分类是 type-scoped)。
      categoryId: undefined,
    });
  };

  return (
    <div className="px-4 py-2 space-y-2">
      {/* Type — HeroUI Tabs(单选,3 个 tab)。Tabs 是高频筛选,不折叠。
       *Tabs 根继承 react-aria selectedKey + onSelectionChange 接口。 */}
      <Tabs
        aria-label="类型筛选"
        selectedKey={currentTab}
        onSelectionChange={handleTabChange}
      >
        <Tabs.List>
          <Tabs.Tab id="__all__">全部</Tabs.Tab>
          <Tabs.Tab id="expense">支出</Tabs.Tab>
          <Tabs.Tab id="income">收入</Tabs.Tab>
          {/* 转账 tab:US4 合并后 TRANSFER_TAB_ENABLED=true 时渲染 */}
          {TRANSFER_TAB_ENABLED && <Tabs.Tab id="transfer">转账</Tabs.Tab>}
        </Tabs.List>
      </Tabs>

      {/* 更多筛选(账户 / 分类):低频,折叠展开。 */}
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex h-11 items-center gap-1 rounded-md px-1 text-sm text-[var(--muted)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span>{expanded ? "▼" : "▶"}</span>
          更多筛选
          {(filters.accountId || filters.categoryId) && (
            <span className="ml-1 rounded bg-[var(--accent-soft)] px-1.5 text-xs text-[var(--accent)]">
              已筛选
            </span>
          )}
        </button>

        {expanded && (
          <div className="mt-2 space-y-3">
            {/* Account */}
            <Select
              selectedKey={filters.accountId ?? ALL_SENTINEL}
              onSelectionChange={(key) => {
                const v = key === null ? ALL_SENTINEL : String(key);
                onChange({
                  ...filters,
                  accountId: v === ALL_SENTINEL ? undefined : v,
                });
              }}
              placeholder="全部账户"
            >
              <Select.Trigger className="h-11 w-full">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id={ALL_SENTINEL} textValue="全部账户">
                    全部账户
                  </ListBox.Item>
                  {unarchivedAccounts.map((a) => (
                    <ListBox.Item key={a.id} id={a.id} textValue={a.name}>
                      {a.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {/* Category — 仅在选了 type 时显示(分类按 type 隔离)。 */}
            {filters.type && (
              <Select
                selectedKey={filters.categoryId ?? ALL_SENTINEL}
                onSelectionChange={(key) => {
                  const v = key === null ? ALL_SENTINEL : String(key);
                  onChange({
                    ...filters,
                    categoryId: v === ALL_SENTINEL ? undefined : v,
                  });
                }}
                placeholder="全部分类"
              >
                <Select.Trigger className="h-11 w-full">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id={ALL_SENTINEL} textValue="全部分类">
                      全部分类
                    </ListBox.Item>
                    {(categories ?? []).map((c) => (
                      <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                        {c.icon} {c.name}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
