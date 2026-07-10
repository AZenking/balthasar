"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { CategoryItem, type CategoryNode } from "./category-item";
import { CategoryForm } from "./category-form";
import type { CategoryCreateValues } from "@/lib/validators/category";

const CUSTOM_CATEGORY_CAP = 200;

/**
 * CategoryManager (023-category-ui T009, US1-5 容器).
 *
 * Phase 3 (US1): list + type/includeArchived toggle + empty state + 200 cap disable.
 * Phase 4 (US2): + create mutation (server-first) + create form dialog.
 * Phase 5 (US3): + update mutation + edit form dialog.
 * Phase 6 (US4): + archive/unarchive optimistic.
 * Phase 7 (US5): + @dnd-kit drag-drop.
 *
 * Mutations added incrementally per US — see git history.
 */
export function CategoryManager() {
  const utils = trpc.useUtils();

  // ─── filters state ───
  const [type, setType] = useState<"income" | "expense">("expense");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // ─── list query ───
  // list returns CategoryTreeNode[] when no parentId (buildCategoryTree applied).
  // tRPC infers a wider type; cast to CategoryNode[] for our tree-shape consumer.
  const query = trpc.category.list.useQuery({
    type,
    includeArchived,
  });
  const tree = query.data as CategoryNode[] | undefined;
  const isLoading = query.isLoading;

  // 200 cap detection (count non-built-in only; list returns tree of both)
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

  // ─── US2: create mutation (server-first, FR-024a) ───
  const createMutation = trpc.category.create.useMutation({
    onSuccess: () => {
      utils.category.list.invalidate();
      setShowCreateForm(false);
      toast.success("已创建");
    },
    onError: (err) => {
      const msg =
        err instanceof TRPCClientError ? err.message : "创建失败,请重试";
      toast.error(msg);
      // form stays open (FR-024a server-first, preserve input on error)
    },
  });

  const handleCreate = async (values: CategoryCreateValues) => {
    await createMutation.mutateAsync(values);
  };

  // ─── mutation callbacks (added in Phase 5-7) ───
  const onEdit = (_id: string) => {
    toast.info("编辑功能将在 US3 实现");
  };
  const onArchive = (_id: string, _childCount: number) => {
    toast.info("归档功能将在 US4 实现");
  };
  const onUnarchive = (_id: string, _childCount: number) => {
    toast.info("反归档功能将在 US4 实现");
  };

  return (
    <div>
      {/* type radio + includeArchived toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-border p-0.5">
          <button
            type="button"
            className={`px-3 py-1 text-sm rounded transition-colors ${
              type === "expense"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setType("expense")}
          >
            支出
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-sm rounded transition-colors ${
              type === "income"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setType("income")}
          >
            收入
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          显示已归档
        </label>
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
        <div className="rounded-md border border-border bg-card">
          {tree.map((node) => (
            <CategoryItem
              key={node.id}
              node={node}
              onEdit={onEdit}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
            />
          ))}
        </div>
      )}

      {/* US2 create form modal */}
      <Modal
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        title="新增分类"
      >
        <CategoryForm
          mode="create"
          categories={tree ?? []}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          submitting={createMutation.isPending}
        />
      </Modal>
    </div>
  );
}
