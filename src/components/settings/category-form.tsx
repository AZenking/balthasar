"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RadioGroup, Radio } from "@heroui/react";
import { categoryCreateSchema, type CategoryCreateValues } from "@/lib/validators/category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconPicker } from "./icon-picker";
import { CategoryIcon } from "@/components/category/category-icon";
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
      {/* 类型 —— HeroUI RadioGroup(支出/收入二选一)。
          用原生复合 API(Radio.Content + Control + Indicator),shadcn 适配器
          的 RadioGroupItem 未渲染 Content/Control/Indicator 导致无法勾选。 */}
      <div>
        <Label className="mb-1 block">类型</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onChange={(v) => setValue("type", v as "expense" | "income", { shouldValidate: true })}
              isDisabled={typeDisabled}
              orientation="horizontal"
              className="items-center gap-6"
            >
              <Radio value="expense">
                <Radio.Content className="flex cursor-pointer items-center gap-2 text-sm">
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  支出
                </Radio.Content>
              </Radio>
              <Radio value="income">
                <Radio.Content className="flex cursor-pointer items-center gap-2 text-sm">
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  收入
                </Radio.Content>
              </Radio>
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

      {/* icon picker (Controller-wrapped, RHF manages value) */}
      <div>
        <Label className="mb-1 block">图标</Label>
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <IconPicker
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
                    <span className="flex items-center gap-1.5">
                      <CategoryIcon name={c.icon} size={16} />
                      {c.name}
                      {c.isBuiltIn ? " (内置)" : ""}
                    </span>
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

      {/* 排序:由列表拖拽管理,表单不再暴露(开发概念,避免与拖拽双入口冲突) */}

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
