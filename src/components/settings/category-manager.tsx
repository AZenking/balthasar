"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  computeSortOrder,
  renumberSortOrders,
} from "@/server/domain/category/rules";
import { CategoryItem, type CategoryNode } from "./category-item";
import { CategoryForm } from "./category-form";
import type { CategoryCreateValues } from "@/lib/validators/category";

const CUSTOM_CATEGORY_CAP = 200;

/** Recursively find a node by id in the tree. */
function findNode(nodes: CategoryNode[], id: string): CategoryNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * CategoryManager (023-category-ui, US1-5 容器).
 *
 * US1: list + type/includeArchived toggle + empty state + 200 cap.
 * US2: create mutation (server-first) + create form modal.
 * US3: update mutation (server-first) + edit form modal.
 * US4: archive/unarchive (server-first with cascade toast).
 * US5: drag-drop reorder (TODO — requires @dnd-kit wrapping).
 */
export function CategoryManager() {
  const utils = trpc.useUtils();

  // ─── filters state ───
  const [type, setType] = useState<"income" | "expense">("expense");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // ─── list query ───
  const query = trpc.category.list.useQuery({ type, includeArchived });
  const tree = query.data as CategoryNode[] | undefined;
  const isLoading = query.isLoading;

  // 200 cap detection
  const customCount = useMemo(() => {
    if (!tree) return 0;
    const count = (nodes: CategoryNode[]): number =>
      nodes.reduce(
        (sum, n) => sum + (n.isBuiltIn ? 0 : 1) + count(n.children),
        0,
      );
    return count(tree);
  }, [tree]);
  const capReached = customCount >= CUSTOM_CATEGORY_CAP;

  // ─── US2: create mutation (server-first) ───
  const createMutation = trpc.category.create.useMutation({
    onSuccess: () => {
      utils.category.list.invalidate();
      setShowCreateForm(false);
      toast.success("已创建");
    },
    onError: (err) => {
      toast.error(err instanceof TRPCClientError ? err.message : "创建失败");
    },
  });

  // ─── US3: update mutation (server-first) ───
  const updateMutation = trpc.category.update.useMutation({
    onSuccess: () => {
      utils.category.list.invalidate();
      setEditingCategoryId(null);
      toast.success("已保存");
    },
    onError: (err) => {
      toast.error(err instanceof TRPCClientError ? err.message : "保存失败");
    },
  });

  // ─── US4: archive mutation ───
  const archiveMutation = trpc.category.archive.useMutation({
    onSuccess: (data) => {
      utils.category.list.invalidate();
      const n = data.archivedChildren.length;
      toast.success(n > 0 ? `已归档(含 ${n} 个子分类)` : "已归档");
    },
    onError: (err) => {
      toast.error(err instanceof TRPCClientError ? err.message : "归档失败");
    },
  });

  const unarchiveMutation = trpc.category.unarchive.useMutation({
    onSuccess: (data) => {
      utils.category.list.invalidate();
      const n = data.unarchivedChildren.length;
      toast.success(
        n > 0 ? `已恢复(含 ${n} 个子分类)` : "已恢复",
      );
    },
    onError: (err) => {
      toast.error(err instanceof TRPCClientError ? err.message : "恢复失败");
    },
  });

  // ─── US5: reorder mutations ───
  const updateForReorderMutation = trpc.category.update.useMutation({
    onSuccess: () => utils.category.list.invalidate(),
    onError: (err) => {
      utils.category.list.invalidate();
      toast.error(err instanceof TRPCClientError ? err.message : "排序失败");
    },
  });
  const reorderBatchMutation = trpc.category.reorder.useMutation({
    onSuccess: () => {
      utils.category.list.invalidate();
      toast.success("已重排");
    },
    onError: (err) => {
      utils.category.list.invalidate();
      toast.error(err instanceof TRPCClientError ? err.message : "重排失败");
    },
  });

  // ─── US5: DnD sensors ───
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  // ─── US5: onDragEnd handler ───
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !tree) return;

    // Only top-level (not children) are draggable
    const topLevel = tree.filter((n) => !n.isBuiltIn && n.archivedAt === null);
    const oldIndex = topLevel.findIndex((n) => n.id === active.id);
    const newIndex = topLevel.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Determine prev/next sortOrder at the new position
    const sorted = [...topLevel].sort((a, b) => a.sortOrder - b.sortOrder);
    const prev = newIndex === 0 ? { sortOrder: 0 } : sorted[newIndex - 1]!;
    const next =
      newIndex >= sorted.length
        ? { sortOrder: sorted[sorted.length - 1]!.sortOrder + 100 }
        : sorted[newIndex]!;

    const mid = computeSortOrder(prev.sortOrder, next.sortOrder);
    if (!Number.isNaN(mid)) {
      // Single update — interval fits
      await updateForReorderMutation.mutateAsync({
        id: active.id as string,
        sortOrder: mid,
      });
    } else {
      // Full renumber — interval exhausted
      const newOrders = renumberSortOrders(sorted.length);
      // Reconstruct item order with active moved to newIndex
      const reordered = sorted.filter((n) => n.id !== active.id);
      const moved = sorted[oldIndex]!;
      reordered.splice(newIndex, 0, moved);
      await reorderBatchMutation.mutateAsync({
        items: reordered.map((n, i) => ({ id: n.id, sortOrder: newOrders[i]! })),
      });
    }
  };

  // ─── handlers ───
  const handleCreate = async (values: CategoryCreateValues) => {
    await createMutation.mutateAsync(values);
  };

  const handleUpdate = async (values: CategoryCreateValues) => {
    if (!editingCategoryId) return;
    await updateMutation.mutateAsync({ id: editingCategoryId, ...values });
  };

  const onArchive = (id: string, childCount: number) => {
    const msg =
      childCount > 0
        ? `确定归档?该分类及其 ${childCount} 个子分类将从新建交易的下拉中隐藏,但历史交易仍保留。`
        : "确定归档?该分类将从新建交易的下拉中隐藏,但历史交易仍保留。";
    if (!window.confirm(msg)) return;
    archiveMutation.mutate({ id });
  };

  const onUnarchive = (id: string, _childCount: number) => {
    unarchiveMutation.mutate({ id });
  };

  const editingNode = editingCategoryId && tree
    ? findNode(tree, editingCategoryId)
    : undefined;

  return (
    <div>
      {/* type radio + includeArchived toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-border p-0.5">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`px-3 py-1 text-sm rounded transition-colors ${
                type === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setType(t)}
            >
              {t === "expense" ? "支出" : "收入"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Checkbox
            id="include-archived"
            checked={includeArchived}
            onCheckedChange={(v) => setIncludeArchived(v === true)}
          />
          <Label htmlFor="include-archived" className="cursor-pointer">
            显示已归档
          </Label>
        </div>
      </div>

      {/* 新增按钮 */}
      <div className="mb-3 flex justify-end">
        <Button
          size="sm"
          disabled={capReached}
          title={capReached ? `已达上限 ${CUSTOM_CATEGORY_CAP}` : undefined}
          onClick={() => setShowCreateForm(true)}
        >
          + 新增分类
        </Button>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !tree || tree.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          没有分类。点&ldquo;新增分类&rdquo;开始。
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tree.map((n) => n.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="rounded-md border border-border bg-card">
              {tree.map((node) => (
                <SortableCategoryItem
                  key={node.id}
                  node={node}
                  onEdit={setEditingCategoryId}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* create form dialog (024 US2: shadcn Dialog, replaces Modal) */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增分类</DialogTitle>
          </DialogHeader>
          <CategoryForm
            mode="create"
            categories={tree ?? []}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
            submitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* edit form dialog (US3) */}
      <Dialog
        open={!!editingCategoryId}
        onOpenChange={(v) => { if (!v) setEditingCategoryId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑分类</DialogTitle>
          </DialogHeader>
          {editingNode && (
            <CategoryForm
              mode="edit"
              categories={tree ?? []}
              editingCategory={editingNode}
              defaultValues={{
                type: editingNode.type,
                name: editingNode.name,
                icon: editingNode.icon,
                parentId: editingNode.parentId ?? undefined,
                sortOrder: editingNode.sortOrder,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingCategoryId(null)}
              submitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** SortableCategoryItem (US5): wraps CategoryItem with @dnd-kit useSortable. */
function SortableCategoryItem({
  node,
  onEdit,
  onArchive,
  onUnarchive,
}: {
  node: CategoryNode;
  onEdit: (id: string) => void;
  onArchive: (id: string, childCount: number) => void;
  onUnarchive: (id: string, childCount: number) => void;
}) {
  const canDrag = !node.isBuiltIn && node.archivedAt === null;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: node.id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handle = canDrag ? (
    <button
      type="button"
      className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
      aria-label="拖拽排序"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  ) : undefined;

  return (
    <div ref={setNodeRef} style={style}>
      <CategoryItem
        node={node}
        dragHandle={handle}
        onEdit={onEdit}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />
    </div>
  );
}
