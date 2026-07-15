"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft } from "lucide-react";
import {
  transactionFormSchema,
  yuanToCents,
  type TransactionFormValues,
} from "@/lib/validators/transaction";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import {
  Tabs,
  NumberField,
  DatePicker,
  DateField,
  Calendar,
  Card,
  Label as HeroUILabel,
} from "@heroui/react";
import { CalendarDate, parseDate } from "@internationalized/date";

export function TransactionForm({
  editId,
  embedded = false,
  onSubmitted,
}: {
  editId?: string;
  /**
   * embedded = true 时去掉外层 Card / Header / Footer,只渲染表单字段。
   * 用于 Drawer / Modal 等容器场景(容器自带 Header/Footer)。
   * 默认 false:独立 page 模式(/transaction/new / /transaction/[id]/edit)。
   */
  embedded?: boolean;
  /** 提交成功后触发(用于关 Drawer / Modal)。embedded 模式下推荐传。 */
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const [serverError, setServerError] = useState("");

  const isEditMode = !!editId;

  const { data: accounts } = trpc.account.list.useQuery();
  const [selectedType, setSelectedType] = useState<"income" | "expense" | "transfer">(
    "expense"
  );
  // 027 US4:转账转入账户(独立于 RHF,因 transfer 无 categoryId,字段集不同)。
  const [toAccountId, setToAccountId] = useState<string>("");

  const { data: _categories } = trpc.category.list.useQuery(
    selectedType === "transfer" ? undefined : { type: selectedType },
  );
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
      // TransactionFormValues.type 是 income|expense(validator);transfer 编辑
      // 在 onSubmit 中被拒绝(转账暂不支持编辑),此处 cast 保证类型通过。
      type: editData.type as "income" | "expense",
      accountId: editData.accountId,
      categoryId: editData.categoryId,
      amount: (editData.amount / 100).toFixed(2),
      remark: editData.remark || "",
      occurredAt: new Date(editData.occurredAt).toISOString().split("T")[0],
    });
  }, [editData, reset]);

  // ── Build the /transactions URL preserving the original filter string ──
  // FR-B004: returning from an edit on a filtered list page must keep the
  // month/type/categoryId query params so the user lands back on the same
  // filtered view, not a reset list.
  const transactionsHref = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `/transactions?${qs}` : "/transactions";
  }, [searchParams]);

  const handlePostSuccess = () => {
    // FR-B003 / clarify Q5: invalidate the 3 key families so every screen
    // (dashboard summary + report + transactions list/detail) refetches.
    utils.dashboard.summary.invalidate();
    utils.dashboard.report.invalidate();
    utils.transaction.list.invalidate();
    if (embedded && onSubmitted) {
      onSubmitted(); // 关 Drawer / Modal
    }
  };

  const createMutation = trpc.transaction.create.useMutation({
    onSuccess: () => {
      handlePostSuccess();
      if (!embedded) router.push("/dashboard");
    },
  });

  const updateMutation = trpc.transaction.update.useMutation({
    onSuccess: () => {
      handlePostSuccess();
      if (!embedded) router.push(transactionsHref);
    },
  });

  const unarchivedAccounts = (accounts ?? []).filter(
    (a) => a.archivedAt === null
  );

  // ── Default accountId to first unarchived account (create mode only) ──
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

  const handleTypeSwitch = (type: "income" | "expense" | "transfer") => {
    setSelectedType(type);
    // validator type 是 income|expense;transfer 走独立提交路径(不走 RHF type 字段)。
    if (type !== "transfer") setValue("type", type);
    setValue("categoryId", ""); // Clear category (old may not match new type)
  };

  const isTransfer = selectedType === "transfer";

  const onSubmit = async (data: TransactionFormValues) => {
    setServerError("");
    try {
      const baseAccountId = data.accountId || unarchivedAccounts[0]!.id;
      if (isTransfer) {
        // 027 US4:转账 —— 无 categoryId,需 toAccountId,且 !== accountId。
        if (!toAccountId) {
          setServerError("请选择转入账户");
          return;
        }
        if (toAccountId === baseAccountId) {
          setServerError("转出账户与转入账户不能相同");
          return;
        }
        const transferPayload = {
          type: "transfer" as const,
          accountId: baseAccountId,
          toAccountId,
          amount: yuanToCents(data.amount),
          remark: data.remark || "",
          occurredAt: new Date(data.occurredAt).toISOString(),
        };
        if (isEditMode && editId) {
          // update procedure 暂未支持 transfer 切换(留后续),降级提示。
          setServerError("转账暂不支持编辑,请删除后重建");
          return;
        }
        await createMutation.mutateAsync(transferPayload);
        return;
      }
      const payload = {
        type: data.type,
        accountId: baseAccountId,
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

  // 表单字段(embedded / page 模式共用)
  const formFields = (
    <>
      {/* Type Switch — HeroUI Tabs(027 US4:加转账) */}
      <Tabs
        aria-label="交易类型"
        selectedKey={selectedType}
        onSelectionChange={(key) =>
          handleTypeSwitch(key as "income" | "expense" | "transfer")
        }
      >
        <Tabs.List>
          <Tabs.Tab id="expense">支出</Tabs.Tab>
          <Tabs.Tab id="income">收入</Tabs.Tab>
          <Tabs.Tab id="transfer">转账</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <input type="hidden" {...register("type")} />

      {/* Amount — HeroUI NumberField + ¥ prefix */}
      {/* NumberField value 是 number,RHF/zod 用 string "0.00",Controller 桥接。
       * 不挂 data-amount(globals.css clarify Q1:记一笔页金额输入不参与隐私遮罩)。 */}
      <Controller
        control={control}
        name="amount"
        render={({ field, fieldState }) => (
          <NumberField
            value={field.value ? parseFloat(field.value) : NaN}
            onChange={(v: number) => field.onChange(String(v))}
            step={0.01}
            minValue={0.01}
            isInvalid={fieldState.invalid}
            aria-label="金额"
            fullWidth
          >
            <HeroUILabel>金额 (元)</HeroUILabel>
            <NumberField.Group>
              <NumberField.Input
                placeholder="0.00"
                autoFocus={!isEditMode}
                className="text-2xl font-bold"
              />
            </NumberField.Group>
            {fieldState.error && (
              <p className="text-xs text-[var(--danger)]">
                {fieldState.error.message}
              </p>
            )}
          </NumberField>
        )}
      />

      {/* Account(转账时为"转出账户") */}
      <div className="space-y-2">
        <Label htmlFor="accountId">{isTransfer ? "转出账户" : "账户"}</Label>
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
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
          <p className="text-xs text-[var(--danger)]">
            {errors.accountId.message}
          </p>
        )}
      </div>

      {/* 027 US4:转账转入账户(仅 transfer 模式) */}
      {isTransfer && (
        <div className="space-y-2">
          <Label htmlFor="toAccountId">转入账户</Label>
          <Select value={toAccountId} onValueChange={setToAccountId}>
            <SelectTrigger id="toAccountId">
              <SelectValue placeholder="选择转入账户" />
            </SelectTrigger>
            <SelectContent>
              {unarchivedAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} (¥{(a.initialBalance / 100).toFixed(2)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Category(转账模式无分类,强制内置转账分类 by server) */}
      {!isTransfer && (
        <div className="space-y-2">
          <Label htmlFor="categoryId">分类</Label>
          <CategorySelect
            type={selectedType}
            value={watch("categoryId")}
            onChange={(id) => setValue("categoryId", id, { shouldValidate: true })}
          />
          {errors.categoryId && (
            <p className="text-xs text-[var(--danger)]">
              {errors.categoryId.message}
            </p>
          )}
        </div>
      )}

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

      {/* Date — HeroUI DatePicker(不隐藏 day,记账需选具体日期) */}
      <Controller
        control={control}
        name="occurredAt"
        render={({ field }) => (
          <DatePicker
            value={field.value ? parseDate(field.value) : null}
            onChange={(date: CalendarDate | null) => {
              if (date) field.onChange(date.toString());
            }}
            aria-label="日期"
          >
            <HeroUILabel>日期</HeroUILabel>
            <DateField.Group fullWidth>
              <DateField.Input>
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
              <DateField.Suffix>
                <DatePicker.Trigger>
                  <DatePicker.TriggerIndicator />
                </DatePicker.Trigger>
              </DateField.Suffix>
            </DateField.Group>
            <DatePicker.Popover>
              <Calendar aria-label="日期选择日历">
                <Calendar.Header>
                  <Calendar.NavButton slot="previous" />
                  <Calendar.Heading />
                  <Calendar.NavButton slot="next" />
                </Calendar.Header>
                <Calendar.Grid>
                  <Calendar.GridHeader>
                    {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                  </Calendar.GridHeader>
                  <Calendar.GridBody>
                    {(date) => <Calendar.Cell date={date} />}
                  </Calendar.GridBody>
                </Calendar.Grid>
              </Calendar>
            </DatePicker.Popover>
          </DatePicker>
        )}
      />
      {errors.occurredAt && (
        <p className="text-xs text-[var(--danger)]">
          {errors.occurredAt.message}
        </p>
      )}

      {serverError && (
        <p className="text-xs text-[var(--danger)]">{serverError}</p>
      )}
    </>
  );

  // 提交按钮(embedded / page 模式共用)
  const submitButton = (
    <Button type="submit" className="w-full" disabled={isSubmitting}>
      {isSubmitting
        ? "提交中..."
        : isEditMode
          ? "保存修改"
          : "确认记账"}
    </Button>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {embedded ? (
        // embedded 模式:无 Card 包裹(Drawer 自带 Header/Footer)
        <div className="space-y-4 pb-4">
          {formFields}
          {submitButton}
        </div>
      ) : (
        // 独立 page 模式:/transaction/new / /transaction/[id]/edit
        <Card className="mx-4 mt-4">
          <Card.Header className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.back()}
                  aria-label="返回"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>返回</TooltipContent>
            </Tooltip>
            <Card.Title>{isEditMode ? "编辑交易" : "记一笔"}</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-4">{formFields}</Card.Content>
          <Card.Footer>{submitButton}</Card.Footer>
        </Card>
      )}
    </form>
  );
}
