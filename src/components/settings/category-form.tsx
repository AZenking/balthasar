"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categoryCreateSchema, type CategoryCreateValues } from "@/lib/validators/category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmojiPicker } from "./emoji-picker";
import type { CategoryNode } from "./category-item";

/**
 * CategoryForm (023-category-ui T013, US2/US3).
 *
 * Shared form for create (US2) + edit (US3) modes.
 *
 * create mode: type + name + emoji + parent (optional) + sortOrder (optional)
 * edit mode: prefill + FR-011/FR-013 置灰 (FR-012 走乐观,Clarify Q3)
 *
 * Parent select: 顶级分类 (parentId IS NULL) of same type + active + same family.
 * When parent selected → type radio locked to parent.type (FR-007).
 */
export interface CategoryFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<CategoryCreateValues> & { id?: string };
  categories: CategoryNode[]; // for parent select options
  editingCategory?: CategoryNode; // edit mode restrictions
  onSubmit: (values: CategoryCreateValues) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

export function CategoryForm({
  mode,
  defaultValues,
  categories,
  editingCategory,
  onSubmit,
  onCancel,
  submitting,
}: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryCreateValues>({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: {
      type: defaultValues?.type ?? "expense",
      name: defaultValues?.name ?? "",
      icon: defaultValues?.icon ?? "",
      parentId: defaultValues?.parentId,
      sortOrder: defaultValues?.sortOrder,
    },
  });

  const currentType = watch("type");
  const currentParentId = watch("parentId");

  // ─── FR-011: archived → type + parent disabled ───
  // ─── FR-013: has children → parent disabled ───
  const isArchived = !!editingCategory?.archivedAt;
  const hasChildren = (editingCategory?.children.length ?? 0) > 0;
  const typeDisabled = mode === "edit" && isArchived;
  const parentDisabled = mode === "edit" && (isArchived || hasChildren);

  // Parent options: 顶级 + same type + active + same family (built-in or same familyId)
  const parentOptions = categories.filter(
    (c) =>
      c.parentId === null && // 顶级
      c.type === currentType && // 同 type
      c.archivedAt === null && // active
      c.id !== editingCategory?.id && // 不选自己
      (c.isBuiltIn || c.familyId === editingCategory?.familyId),
  );

  // ─── FR-007: parent selected → lock type to parent.type ───
  useEffect(() => {
    if (currentParentId) {
      const parent = categories.find((c) => c.id === currentParentId);
      if (parent && parent.type !== currentType) {
        setValue("type", parent.type, { shouldValidate: true });
      }
    }
  }, [currentParentId, categories, currentType, setValue]);

  const submit = handleSubmit(async (values) => {
    // If parent selected, force type = parent.type (defense, already locked in UI)
    if (values.parentId) {
      const parent = categories.find((c) => c.id === values.parentId);
      if (parent) values.type = parent.type;
    }
    await onSubmit(values);
  });

  // Sentinel for "顶级分类" (no parent). shadcn Select cannot use empty-string value.
  const PARENT_ROOT_SENTINEL = "__root__";

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* type radio group (024 US2: shadcn RadioGroup) */}
      <div>
        <Label className="mb-1 block">类型</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={(v) => setValue("type", v as "expense" | "income", { shouldValidate: true })}
              disabled={typeDisabled}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="expense" id="type-expense" />
                <Label htmlFor="type-expense">支出</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="income" id="type-income" />
                <Label htmlFor="type-income">收入</Label>
              </div>
            </RadioGroup>
          )}
        />
        {typeDisabled && (
          <p className="mt-1 text-xs text-muted-foreground">已归档分类不可改类型</p>
        )}
        {errors.type && (
          <p className="mt-1 text-xs text-destructive">{errors.type.message}</p>
        )}
      </div>

      {/* name */}
      <div>
        <Label htmlFor="category-name" className="mb-1 block">名称</Label>
        <Input
          id="category-name"
          type="text"
          {...register("name")}
          maxLength={30}
          placeholder="1-30 字"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* emoji picker (Controller-wrapped, RHF manages value) */}
      <div>
        <Label className="mb-1 block">图标</Label>
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <EmojiPicker
              value={field.value ?? ""}
              onChange={field.onChange}
            />
          )}
        />
        {errors.icon && (
          <p className="mt-1 text-xs text-destructive">{errors.icon.message}</p>
        )}
      </div>

      {/* parent select (only top-level) — 024 US2: shadcn Select */}
      <div>
        <Label className="mb-1 block">父分类 (可选)</Label>
        <Controller
          control={control}
          name="parentId"
          render={({ field }) => (
            <Select
              value={field.value ?? PARENT_ROOT_SENTINEL}
              onValueChange={(v) =>
                field.onChange(v === PARENT_ROOT_SENTINEL ? undefined : v)
              }
              disabled={parentDisabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="(顶级分类)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PARENT_ROOT_SENTINEL}>(顶级分类)</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                    {c.isBuiltIn ? " (内置)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {parentDisabled && (
          <p className="mt-1 text-xs text-muted-foreground">
            {isArchived
              ? "已归档分类不可改父分类"
              : hasChildren
                ? "已有子分类,不可变为二级"
                : ""}
          </p>
        )}
      </div>

      {/* sortOrder */}
      <div>
        <Label htmlFor="category-sort-order" className="mb-1 block">排序 (可选)</Label>
        <Input
          id="category-sort-order"
          type="number"
          {...register("sortOrder", { valueAsNumber: true })}
          min={0}
          step={1}
          placeholder="默认 100"
        />
        {errors.sortOrder && (
          <p className="mt-1 text-xs text-destructive">{errors.sortOrder.message}</p>
        )}
      </div>

      {/* actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "提交中..." : mode === "create" ? "创建" : "保存"}
        </Button>
      </div>
    </form>
  );
}
