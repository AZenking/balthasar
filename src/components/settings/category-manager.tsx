"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import { Tags } from "lucide-react";
import {
  Tabs,
  Checkbox,
  Button,
  Skeleton,
  Modal,
  AlertDialog,
} from "@heroui/react";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/feedback/empty-state";
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
 * US5: 上移/下移排序(替代原 @dnd-kit 拖拽 —— HeroUI ListBox 不支持 DnD,
 *      改用 ⋯ 菜单内的上移/下移,复用 sortOrder 插值逻辑)。
 */
export function CategoryManager() {
  const utils = trpc.useUtils();

  // ─── filters state ───
  const [type, setType] = useState<"income" | "expense">("expense");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  // 归档二次确认目标(onArchive 仅写入,AlertDialog 承载确认 UI)
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    childCount: number;
  } | null>(null);

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

  // ─── US5: reorder mutations(原 DnD,改上移/下移) ───
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

  // ─── US5: 上移/下移(复用原 onDragEnd 的 sortOrder 插值逻辑) ───
  const handleMove = async (id: string, dir: "up" | "down") => {
    if (!tree) return;
    // 仅顶级自定义 + 未归档项参与排序
    const topLevel = tree.filter((n) => !n.isBuiltIn && n.archivedAt === null);
    const sorted = [...topLevel].sort((a, b) => a.sortOrder - b.sortOrder);
    const oldIndex = sorted.findIndex((n) => n.id === id);
    if (oldIndex === -1) return;
    const newIndex = dir === "up" ? oldIndex - 1 : oldIndex + 1;
    if (newIndex < 0 || newIndex >= sorted.length) return; // 边界

    // 在新位置插入:取新位置相邻两项的 sortOrder 中值
    const reordered = sorted.filter((n) => n.id !== id);
    const moved = sorted[oldIndex]!;
    reordered.splice(newIndex, 0, moved);
    const prev = newIndex === 0 ? { sortOrder: 0 } : reordered[newIndex - 1]!;
    const next =
      newIndex >= reordered.length - 1
        ? { sortOrder: reordered[reordered.length - 1]!.sortOrder + 100 }
        : reordered[newIndex + 1]!;
    const mid = computeSortOrder(prev.sortOrder, next.sortOrder);
    if (!Number.isNaN(mid)) {
      await updateForReorderMutation.mutateAsync({ id, sortOrder: mid });
    } else {
      const newOrders = renumberSortOrders(sorted.length);
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
    setArchiveTarget({ id, childCount });
  };

  const confirmArchive = () => {
    if (!archiveTarget) return;
    archiveMutation.mutate({ id: archiveTarget.id });
    setArchiveTarget(null);
  };

  const onUnarchive = (id: string, _childCount: number) => {
    unarchiveMutation.mutate({ id });
  };

  const editingNode = editingCategoryId && tree
    ? findNode(tree, editingCategoryId)
    : undefined;

  // 排序上下文:计算每个顶级项能否上移/下移(供 CategoryItem 的 ⋯ 菜单)
  const movableIds = useMemo(() => {
    if (!tree) return new Set<string>();
    const topLevel = tree.filter((n) => !n.isBuiltIn && n.archivedAt === null);
    return new Set(topLevel.map((n) => n.id));
  }, [tree]);

  return (
    <div>
      {/* type 切换:HeroUI Tabs(替代手写 button 组)+ includeArchived toggle */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          aria-label="分类类型"
          selectedKey={type}
          onSelectionChange={(k) => setType(k as "income" | "expense")}
        >
          <Tabs.List>
            <Tabs.Tab id="expense">支出</Tabs.Tab>
            <Tabs.Tab id="income">收入</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        <Checkbox
          aria-label="显示已归档"
          isSelected={includeArchived}
          onChange={setIncludeArchived}
          className="flex items-center gap-1.5 text-sm text-muted"
        >
          <Checkbox.Content className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            显示已归档
          </Checkbox.Content>
        </Checkbox>
      </div>

      {/* 新增按钮(列表为空时隐藏:EmptyState 内已有同款 CTA,避免重复) */}
      {tree && tree.length > 0 && (
        <div className="mb-3 flex flex-col items-end gap-1">
          <Button
            size="sm"
            isDisabled={capReached}
            aria-label={capReached ? `已达上限 ${CUSTOM_CATEGORY_CAP}` : "+ 新增分类"}
            onPress={() => setShowCreateForm(true)}
          >
            + 新增分类
          </Button>
          {capReached && (
            <p className="text-xs text-muted">
              已达上限 {CUSTOM_CATEGORY_CAP} 个自定义分类
            </p>
          )}
        </div>
      )}

      {/* 列表 —— HeroUI ListBox */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !tree || tree.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="还没有自定义分类"
          description="点「新增分类」开始组织你的记账维度"
          action={
            <Button
              size="sm"
              isDisabled={capReached}
              onPress={() => setShowCreateForm(true)}
            >
              + 新增分类
            </Button>
          }
          className="min-h-[24vh]"
        />
      ) : (
        /* 分类列表 —— 普通 div + map。
           不用 ListBox:CategoryItem 行内有独立的 ⋯ Popover 菜单(上移/下移/
           编辑/归档/恢复),嵌套在 ListBox.Item(可聚焦 Option)内会拦截点击、
           破坏 focus 链,导致 Popover 打不开。ListBox 仅适合"整行单一动作"。 */
        <div className="rounded-md border border-border bg-surface">
          {tree.map((node) => (
            <CategoryItem
              key={node.id}
              node={node}
              onEdit={setEditingCategoryId}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onMove={movableIds.has(node.id) ? handleMove : undefined}
            />
          ))}
        </div>
      )}

      {/* create form modal */}
      <Modal isOpen={showCreateForm} onOpenChange={setShowCreateForm}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>新增分类</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <CategoryForm
                  mode="create"
                  categories={tree ?? []}
                  onSubmit={handleCreate}
                  onCancel={() => setShowCreateForm(false)}
                  submitting={createMutation.isPending}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* edit form modal (US3) */}
      <Modal
        isOpen={!!editingCategoryId}
        onOpenChange={(v) => { if (!v) setEditingCategoryId(null); }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>编辑分类</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
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
                    }}
                    onSubmit={handleUpdate}
                    onCancel={() => setEditingCategoryId(null)}
                    submitting={updateMutation.isPending}
                  />
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* 归档二次确认(替代 window.confirm) */}
      <AlertDialog
        isOpen={!!archiveTarget}
        onOpenChange={(v) => { if (!v) setArchiveTarget(null); }}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>归档分类</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-sm text-muted-foreground">
                  {archiveTarget && archiveTarget.childCount > 0
                    ? `确定归档?该分类及其 ${archiveTarget.childCount} 个子分类将从新建交易的下拉中隐藏,但历史交易仍保留。`
                    : "确定归档?该分类将从新建交易的下拉中隐藏,但历史交易仍保留。"}
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer className="flex justify-end gap-2">
                <Button variant="outline" onPress={() => setArchiveTarget(null)}>
                  取消
                </Button>
                <Button variant="danger" onPress={confirmArchive}>
                  归档
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  );
}
