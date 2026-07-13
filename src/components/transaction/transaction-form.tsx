"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  transactionFormSchema,
  yuanToCents,
  type TransactionFormValues,
} from "@/lib/validators/transaction";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategorySelect } from "@/components/category/category-select";
import { cn } from "@/lib/utils";

export function TransactionForm({ editId }: { editId?: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [serverError, setServerError] = useState("");

  const isEditMode = !!editId;

  const { data: accounts } = trpc.account.list.useQuery();
  const [selectedType, setSelectedType] = useState<"income" | "expense">(
    "expense"
  );

  const { data: _categories } = trpc.category.list.useQuery({
    type: selectedType,
  });
  // 023-category-ui US6: CategorySelect now handles list + grouping internally.
  // _categories unused here; CategorySelect fetches its own data.
  void _categories;

  // ── Edit mode: prefetch transaction data ──
  const { data: editData, isLoading: isLoadingEdit } =
    trpc.transaction.get.useQuery(
      { id: editId! },
      { enabled: isEditMode }
    );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: "expense",
      amount: "",
      remark: "",
      occurredAt: new Date().toISOString().split("T")[0],
    },
  });

  // ── Pre-fill form when edit data arrives ──
  useEffect(() => {
    if (!editData) return;
    setSelectedType(editData.type);
    reset({
      type: editData.type,
      accountId: editData.accountId,
      categoryId: editData.categoryId,
      amount: (editData.amount / 100).toFixed(2),
      remark: editData.remark || "",
      occurredAt: new Date(editData.occurredAt).toISOString().split("T")[0],
    });
  }, [editData, reset]);

  const createMutation = trpc.transaction.create.useMutation({
    onSuccess: () => {
      utils.dashboard.summary.invalidate();
      router.push("/dashboard");
    },
  });

  const updateMutation = trpc.transaction.update.useMutation({
    onSuccess: () => {
      utils.dashboard.summary.invalidate();
      utils.transaction.list.invalidate();
      router.push("/transactions");
    },
  });

  const unarchivedAccounts = (accounts ?? []).filter(
    (a) => a.archivedAt === null
  );

  // ── Default accountId to first unarchived account (create mode only) ──
  // 025: For shadcn Select we must set the form value explicitly (no
  // native defaultValue on the original element). Run once accounts arrive.
  // Deps intentionally limited: watch/setValue are RHF-stable refs.
  useEffect(() => {
    if (isEditMode) return;
    if (unarchivedAccounts.length === 0) return;
    if (!watch("accountId")) {
      setValue("accountId", unarchivedAccounts[0]!.id);
    }
  }, [unarchivedAccounts, isEditMode, watch, setValue]);

  // No accounts → prompt
  if (unarchivedAccounts.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">请先创建账户</p>
        <Button variant="outline" onClick={() => router.push("/settings")}>
          去设置
        </Button>
      </div>
    );
  }

  // Edit mode loading
  if (isEditMode && isLoadingEdit) {
    return (
      <div className="space-y-4 p-4 pt-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const handleTypeSwitch = (type: "income" | "expense") => {
    setSelectedType(type);
    setValue("type", type);
    setValue("categoryId", ""); // Clear category (old may not match new type)
  };

  const onSubmit = async (data: TransactionFormValues) => {
    setServerError("");
    try {
      const payload = {
        type: data.type,
        accountId: data.accountId || unarchivedAccounts[0]!.id,
        categoryId: data.categoryId,
        amount: yuanToCents(data.amount),
        remark: data.remark || "",
        occurredAt: new Date(data.occurredAt).toISOString(),
      };
      if (isEditMode && editId) {
        await updateMutation.mutateAsync({ id: editId, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (e: any) {
      setServerError(
        e?.data?.message || e?.message || "操作失败,请重试"
      );
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 p-4 pt-6"
    >
      <h1 className="text-xl font-bold">
        {isEditMode ? "编辑交易" : "记一笔"}
      </h1>

      {/* Type Switch */}
      <div className="flex gap-2">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeSwitch(t)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              selectedType === t
                ? t === "expense"
                  ? "bg-red-500 text-white"
                  : "bg-green-500 text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {t === "expense" ? "支出" : "收入"}
          </button>
        ))}
      </div>
      <input type="hidden" {...register("type")} />

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">金额 (元)</Label>
        <Input
          id="amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          autoFocus={!isEditMode}
          className="text-2xl font-bold"
          {...register("amount")}
        />
        {errors.amount && (
          <p className="text-xs text-destructive">{errors.amount.message}</p>
        )}
      </div>

      {/* Account */}
      <div className="space-y-2">
        <Label htmlFor="accountId">账户</Label>
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
            >
              <SelectTrigger id="accountId">
                <SelectValue placeholder="选择账户" />
              </SelectTrigger>
              <SelectContent>
                {unarchivedAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} (¥{(a.initialBalance / 100).toFixed(2)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.accountId && (
          <p className="text-xs text-destructive">
            {errors.accountId.message}
          </p>
        )}
      </div>

      {/* Category (023-category-ui US6: 用 CategorySelect 替换内联渲染) */}
      <div className="space-y-2">
        <Label htmlFor="categoryId">分类</Label>
        <CategorySelect
          type={selectedType}
          value={watch("categoryId")}
          onChange={(id) => setValue("categoryId", id, { shouldValidate: true })}
        />
        {errors.categoryId && (
          <p className="text-xs text-destructive">
            {errors.categoryId.message}
          </p>
        )}
      </div>

      {/* Remark */}
      <div className="space-y-2">
        <Label htmlFor="remark">备注 (选填)</Label>
        <Input
          id="remark"
          type="text"
          placeholder="如:午餐咖啡"
          maxLength={200}
          {...register("remark")}
        />
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="occurredAt">日期</Label>
        <Input
          id="occurredAt"
          type="date"
          max={today}
          {...register("occurredAt")}
        />
      </div>

      {serverError && (
        <p className="text-xs text-destructive">{serverError}</p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? "提交中..."
          : isEditMode
            ? "保存修改"
            : "确认记账"}
      </Button>
    </form>
  );
}
