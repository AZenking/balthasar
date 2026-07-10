"use client";

import { Lock, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Category } from "@/server/db/schema";

/**
 * CategoryItem (023-category-ui T008, US1/US3/US4).
 *
 * Renders a single category row. Recursive for children (二级缩进).
 *
 * State-driven UI:
 * - built-in (isBuiltIn=true): 🔒 + 无编辑/归档按钮
 * - active-custom: 编辑 + 归档 buttons
 * - archived-custom: 灰显 + 反归档 button
 *
 * Drag handle is added by parent (SortableCategoryItem wrapper in US5),
 * not here — keeps this component pure presentational.
 */
export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export interface CategoryItemProps {
  node: CategoryNode;
  isChild?: boolean;
  onEdit?: (id: string) => void;
  onArchive?: (id: string, childCount: number) => void;
  onUnarchive?: (id: string, childCount: number) => void;
  dragHandle?: React.ReactNode;
}

export function CategoryItem({
  node,
  isChild = false,
  onEdit,
  onArchive,
  onUnarchive,
  dragHandle,
}: CategoryItemProps) {
  const isArchived = node.archivedAt !== null;
  const canManage = !node.isBuiltIn; // 内置不可写
  const childCount = node.children.length;

  return (
    <div className={isArchived ? "opacity-50" : ""}>
      <div
        className={`flex items-center justify-between py-2 ${isChild ? "pl-8" : "pl-2"}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {dragHandle}
          {!isChild && !canManage && (
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="内置分类" />
          )}
          <span className="text-lg shrink-0">{node.icon}</span>
          <span className="text-sm truncate">{node.name}</span>
          {isArchived && (
            <span className="text-xs text-muted-foreground shrink-0">(已归档)</span>
          )}
        </div>

        {canManage && !isArchived && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => onEdit?.(node.id)}
              aria-label={`编辑 ${node.name}`}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => onArchive?.(node.id, childCount)}
              aria-label={`归档 ${node.name}`}
            >
              <Archive className="h-3 w-3" />
            </Button>
          </div>
        )}
        {canManage && isArchived && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 shrink-0"
            onClick={() => onUnarchive?.(node.id, childCount)}
            aria-label={`反归档 ${node.name}`}
          >
            <ArchiveRestore className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* 二级 children 递归渲染 */}
      {node.children.length > 0 && (
        <div className="border-l border-border ml-3">
          {node.children.map((child) => (
            <CategoryItem
              key={child.id}
              node={child}
              isChild
              onEdit={onEdit}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
