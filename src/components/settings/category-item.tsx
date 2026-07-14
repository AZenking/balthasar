"use client";

import { Lock, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
 *
 * 026-switch 第一期 5:操作按钮改 HeroUI ghost/destructive variant + ≥44px
 * 命中区 + Tooltip(原 h-7 px-2 过小,FR-A007 不达标)。
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
        <div className="flex min-w-0 items-center gap-2">
          {dragHandle}
          {!isChild && !canManage && (
            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="内置分类" />
          )}
          <span className="shrink-0 text-lg">{node.icon}</span>
          <span className="truncate text-sm">{node.name}</span>
          {isArchived && (
            <span className="shrink-0 text-xs text-muted-foreground">(已归档)</span>
          )}
        </div>

        {canManage && !isArchived && (
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => onEdit?.(node.id)}
                  aria-label={`编辑 ${node.name}`}
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
                  onClick={() => onArchive?.(node.id, childCount)}
                  aria-label={`归档 ${node.name}`}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>归档</TooltipContent>
            </Tooltip>
          </div>
        )}
        {canManage && isArchived && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] shrink-0"
                onClick={() => onUnarchive?.(node.id, childCount)}
                aria-label={`反归档 ${node.name}`}
              >
                <ArchiveRestore className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>反归档</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* 二级 children 递归渲染 */}
      {node.children.length > 0 && (
        <div className="ml-3 border-l border-border">
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
