"use client";

import { useState } from "react";
import {
  Lock,
  Pencil,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Category } from "@/server/db/schema";
import { CategoryIcon } from "@/components/category/category-icon";

/**
 * CategoryItem (023-category-ui T008, US1/US3/US4).
 *
 * Renders a single category row. Recursive for children (二级缩进).
 *
 * State-driven UI:
 * - built-in (isBuiltIn=true): 🔒 + 无操作按钮(统一行高,仅不可管理)
 * - active-custom: ⋯ 菜单(编辑 / 归档)
 * - archived-custom: 灰显 + ⋯ 菜单(恢复)
 *
 * 操作按钮收进 Popover 溢出菜单 —— 单一 44px 触控点(满足 FR-A007),
 * 同时把横向空间还给分类名(原两个 44px 内联按钮合计 ~92px,长名称易截断)。
 *
 * Drag handle 由父级(SortableCategoryItem wrapper)注入,不在本组件内。
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
  const [menuOpen, setMenuOpen] = useState(false);

  // 菜单项点击:执行回调后关闭菜单
  const run = (fn?: (id: string, n: number) => void) => {
    setMenuOpen(false);
    fn?.(node.id, childCount);
  };

  return (
    <div className={cn(isArchived && "opacity-50")}>
      <div
        className={cn(
          "flex min-h-[40px] items-center justify-between py-2",
          isChild ? "pl-8" : "pl-2",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {dragHandle}
          {!isChild && !canManage && (
            <Lock
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-label="内置分类"
            />
          )}
          <CategoryIcon name={node.icon} size={20} className="shrink-0" />
          <span className="truncate text-sm">{node.name}</span>
          {isArchived && (
            <span className="shrink-0 text-xs text-muted-foreground">(已归档)</span>
          )}
        </div>

        {canManage && (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 min-h-[44px] min-w-[44px]"
                aria-label={`${node.name} 操作`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-40 p-1">
              {!isArchived ? (
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => run(onEdit)}
                    className="flex min-h-[40px] items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => run(onArchive)}
                    className="flex min-h-[40px] items-center gap-2 rounded-sm px-2 text-sm text-destructive hover:bg-accent"
                  >
                    <Archive className="h-4 w-4" />
                    归档
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => run(onUnarchive)}
                  className="flex min-h-[40px] w-full items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
                >
                  <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
                  恢复
                </button>
              )}
            </PopoverContent>
          </Popover>
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
