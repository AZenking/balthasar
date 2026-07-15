"use client";

import { useState } from "react";
import {
  Lock,
  Pencil,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { ListBox } from "@heroui/react";
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
 * CategoryItem (023-category-ui T008, US1/US3/US4/US5).
 *
 * Renders a single category row. Recursive for children (二级缩进).
 *
 * State-driven UI:
 * - built-in (isBuiltIn=true): 🔒 + 无操作按钮
 * - active-custom: ⋯ 菜单(上移 / 下移 / 编辑 / 归档)
 * - archived-custom: 灰显 + ⋯ 菜单(恢复)
 *
 * 操作按钮收进 Popover 溢出菜单内的 ListBox —— 单一 44px 触控点(满足
 * FR-A007),菜单项获得 ListBox 的键盘箭头导航 + roving focus。
 * 排序由 ⋯ 菜单的上移/下移完成(替代原拖拽,HeroUI ListBox 不支持 DnD)。
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
  /** 上移/下移(仅顶级自定义项可排序时传入)。 */
  onMove?: (id: string, dir: "up" | "down") => void;
}

export function CategoryItem({
  node,
  isChild = false,
  onEdit,
  onArchive,
  onUnarchive,
  onMove,
}: CategoryItemProps) {
  const isArchived = node.archivedAt !== null;
  const canManage = !node.isBuiltIn; // 内置不可写
  const childCount = node.children.length;
  const [menuOpen, setMenuOpen] = useState(false);

  // 菜单动作分发
  const handleAction = (key: React.Key) => {
    setMenuOpen(false);
    if (key === "edit") onEdit?.(node.id);
    else if (key === "archive") onArchive?.(node.id, childCount);
    else if (key === "unarchive") onUnarchive?.(node.id, childCount);
    else if (key === "up") onMove?.(node.id, "up");
    else if (key === "down") onMove?.(node.id, "down");
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
                <ListBox
                  aria-label={`${node.name} 操作菜单`}
                  selectionMode="none"
                  onAction={handleAction}
                >
                  {onMove && (
                    <ListBox.Item id="up" textValue="上移">
                      <div className="flex min-h-[36px] items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent">
                        <ArrowUp className="h-4 w-4 text-muted-foreground" />
                        上移
                      </div>
                    </ListBox.Item>
                  )}
                  {onMove && (
                    <ListBox.Item id="down" textValue="下移">
                      <div className="flex min-h-[36px] items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent">
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        下移
                      </div>
                    </ListBox.Item>
                  )}
                  <ListBox.Item id="edit" textValue="编辑">
                    <div className="flex min-h-[36px] items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                      编辑
                    </div>
                  </ListBox.Item>
                  <ListBox.Item id="archive" textValue="归档">
                    <div className="flex min-h-[36px] items-center gap-2 rounded-sm px-2 text-sm text-destructive hover:bg-accent">
                      <Archive className="h-4 w-4" />
                      归档
                    </div>
                  </ListBox.Item>
                </ListBox>
              ) : (
                <ListBox
                  aria-label={`${node.name} 操作菜单`}
                  selectionMode="none"
                  onAction={handleAction}
                >
                  <ListBox.Item id="unarchive" textValue="恢复">
                    <div className="flex min-h-[36px] items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent">
                      <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
                      恢复
                    </div>
                  </ListBox.Item>
                </ListBox>
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
