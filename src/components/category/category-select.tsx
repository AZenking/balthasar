"use client";

import { Chip } from "@heroui/react";
import { keepPreviousData } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { CategoryIcon } from "@/components/category/category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@/server/db/schema";

/**
 * CategorySelect (023-category-ui T027, US6).
 *
 * Chip-grid component (matches 008 transaction-form style) showing
 * built-in + custom categories grouped + hierarchical.
 *
 * Replaces 008's inline category chip rendering which only handled flat
 * list (003 era). Now consumes 018's tree-shape `category.list` response.
 *
 * Grouping:
 * - 内置 (isBuiltIn=true): shown first, all families share
 * - 自定义 (isBuiltIn=false): shown second, current family only
 *
 * 二级 children: indented (pl-4) under their parent.
 * Archived: filtered out by backend (includeArchived=false default).
 */
export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export interface CategorySelectProps {
  value: string;
  onChange: (categoryId: string) => void;
  type: "income" | "expense";
}

export function CategorySelect({ value, onChange, type }: CategorySelectProps) {
  // 018 returns tree (CategoryTreeNode[]) when no parentId.
  // placeholderData: keepPreviousData —— 切换 支出/收入 Tab 时 type 变化触发
  // 新 query key,旧实现会在数据未到时 tree=[] 渲染"暂无分类"再跳回列表,
  // 造成小屏 Drawer 内明显的空白闪烁。keepPreviousData 保留上次结果直到新数据
  // 到达,实现无缝替换;isLoading 仅在首次(无缓存)时为 true,显示骨架兜底。
  const query = trpc.category.list.useQuery({ type }, {
    placeholderData: keepPreviousData,
  });
  const tree = (query.data ?? []) as CategoryNode[];
  const isInitialLoading = query.isLoading;

  const builtIns = tree.filter((n) => n.isBuiltIn);
  const customs = tree.filter((n) => !n.isBuiltIn);

  const renderChip = (cat: Category, indent = false) => (
    <button
      key={cat.id}
      type="button"
      onClick={() => onChange(cat.id)}
      className={cn("inline-flex", indent && "ml-4")}
    >
      <Chip
        size="sm"
        color={value === cat.id ? "accent" : "default"}
        variant={value === cat.id ? "soft" : "secondary"}
        className={cn(
          "cursor-pointer transition-colors",
          value !== cat.id && "hover:bg-accent",
        )}
      >
        <CategoryIcon name={cat.icon} size={16} />
        <Chip.Label>{cat.name}</Chip.Label>
      </Chip>
    </button>
  );

  const renderNode = (node: CategoryNode) => (
    <div key={node.id}>
      {renderChip(node)}
      {node.children.length > 0 && (
        <div className="ml-2 flex flex-wrap gap-2 border-l border-border pl-2">
          {node.children.map((child) => renderChip(child, true))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {isInitialLoading ? (
        // 首次加载(无缓存)骨架:两行 Chip 占位,固定高度避免 Drawer 内重排闪烁
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-full" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-full" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 内置 */}
          {builtIns.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">内置</p>
              <div className="flex flex-wrap gap-2">
                {builtIns.map((node) => renderChip(node))}
              </div>
            </div>
          )}

          {/* 自定义 */}
          {customs.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">自定义</p>
              <div className="space-y-2">
                {customs.map((node) => renderNode(node))}
              </div>
            </div>
          )}

          {builtIns.length === 0 && customs.length === 0 && (
            <p className="text-xs text-muted-foreground">暂无分类</p>
          )}
        </>
      )}
    </div>
  );
}
