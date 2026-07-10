"use client";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
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
  // 018 returns tree (CategoryTreeNode[]) when no parentId
  const query = trpc.category.list.useQuery({ type });
  const tree = (query.data ?? []) as CategoryNode[];

  const builtIns = tree.filter((n) => n.isBuiltIn);
  const customs = tree.filter((n) => !n.isBuiltIn);

  const renderChip = (cat: Category, indent = false) => (
    <button
      key={cat.id}
      type="button"
      onClick={() => onChange(cat.id)}
      className={cn(
        "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors",
        indent && "ml-4",
        value === cat.id
          ? "border-primary bg-primary/5 text-primary"
          : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      <span>{cat.icon}</span>
      {cat.name}
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
    </div>
  );
}
