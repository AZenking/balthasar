"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { cn } from "@/lib/utils";

export function TransactionForm() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [serverError, setServerError] = useState("");

  const { data: accounts } = trpc.account.list.useQuery();
  const [selectedType, setSelectedType] = useState<"income" | "expense">(
    "expense"
  );

  const { data: categories } = trpc.category.list.useQuery({
    type: selectedType,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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

  const createMutation = trpc.transaction.create.useMutation({
    onSuccess: () => {
      utils.dashboard.summary.invalidate();
      router.push("/dashboard");
    },
  });

  const unarchivedAccounts = (accounts ?? []).filter(
    (a) => a.archivedAt === null
  );

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

  const handleTypeSwitch = (type: "income" | "expense") => {
    setSelectedType(type);
    setValue("type", type);
    setValue("categoryId", ""); // Clear category (old may not match new type)
  };

  const onSubmit = async (data: TransactionFormValues) => {
    setServerError("");
    try {
      await createMutation.mutateAsync({
        type: data.type,
        accountId: data.accountId || unarchivedAccounts[0]!.id,
        categoryId: data.categoryId,
        amount: yuanToCents(data.amount),
        remark: data.remark || "",
        occurredAt: new Date(data.occurredAt).toISOString(),
      });
    } catch (e: any) {
      setServerError(
        e?.data?.message || e?.message || "记账失败,请重试"
      );
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const currentAccountId = watch("accountId");

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 p-4 pt-6"
    >
      <h1 className="text-xl font-bold">记一笔</h1>

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
          autoFocus
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
        <select
          id="accountId"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register("accountId")}
          defaultValue={unarchivedAccounts[0]?.id}
        >
          {unarchivedAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} (¥{(a.initialBalance / 100).toFixed(2)})
            </option>
          ))}
        </select>
        {errors.accountId && (
          <p className="text-xs text-destructive">
            {errors.accountId.message}
          </p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="categoryId">分类</Label>
        <div className="flex flex-wrap gap-2">
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setValue("categoryId", c.id)}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                watch("categoryId") === c.id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              <span>{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>
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
          defaultValue={today}
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
        {isSubmitting ? "提交中..." : "确认记账"}
      </Button>
    </form>
  );
}
