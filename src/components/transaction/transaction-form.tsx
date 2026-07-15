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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CategorySelect } from "@/components/category/category-select";
import {
  Tabs,
  NumberField,
  DatePicker,
  DateField,
  Calendar,
  Card,
  Label as HeroUILabel,
  Select as HeroUISelect,
  ListBox,
  Description,
  TextArea,
  type Key,
} from "@heroui/react";
import { CalendarDate, parseDate } from "@internationalized/date";

/**
 * 交易类型视觉映射 —— 复用 HeroUI 注入的语义色 token:
 *   支出 → --danger(红)   收入 → --success(绿)   转账 → --accent(蓝)
 *
 * indicatorCls    —— Tabs 选中态滑块软底色,挂到每个 Tabs.Indicator
 *                   (仅选中 Tab 的 Indicator 可见,故按类型着色即整组变色)。
 * selectedTextCls —— 选中 Tab 文字色。@heroui/styles 注入的
 *                   `.tabs__tab[data-selected] { text-segment-foreground }`
 *                   在样式表中,工具类需 `!` 提权才能稳定覆盖(不受 @layer
 *                   顺序影响);data-[selected=true] 仅在选中时生效。
 * submitCls       —— 提交按钮(实色底 + 前景字)
 */
const TYPE_META: Record<
  "expense" | "income" | "transfer",
  {
    label: string;
    indicatorCls: string;
    selectedTextCls: string;
    submitCls: string;
  }
> = {
  expense: {
    label: "支出",
    indicatorCls: "!bg-[var(--danger-soft)]",
    selectedTextCls: "data-[selected=true]:!text-[var(--danger)]",
    submitCls:
      "!bg-[var(--danger)] !text-[var(--danger-foreground)] hover:!bg-[var(--danger-hover)]",
  },
  income: {
    label: "收入",
    indicatorCls: "!bg-[var(--success-soft)]",
    selectedTextCls: "data-[selected=true]:!text-[var(--success)]",
    submitCls:
      "!bg-[var(--success)] !text-[var(--success-foreground)] hover:!bg-[var(--success-hover)]",
  },
  transfer: {
    label: "转账",
    indicatorCls: "!bg-[var(--accent-soft)]",
    selectedTextCls: "data-[selected=true]:!text-[var(--accent)]",
    submitCls:
      "!bg-[var(--accent)] !text-[var(--accent-foreground)] hover:!bg-[var(--accent-hover)]",
  },
};

/**
 * AccountTriggerLabel —— 账户下拉触发器里展示的「账户名 + 余额」。
 * 供 HeroUI Select.Value 的 render-prop 复用(转出/转入账户两处)。
 * 仅依赖 name + initialBalance,避免与 tRPC 序列化后的 Account 整体类型耦合。
 */
function AccountTriggerLabel({
  account,
}: {
  account: { name: string; initialBalance: number };
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="truncate">{account.name}</span>
      <span className="text-xs text-muted-foreground">
        ¥{(account.initialBalance / 100).toFixed(2)}
      </span>
    </span>
  );
}

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
      {/* 选中态滑块软底色 + 选中文字色按交易类型语义色着色
          (TYPE_META: 支出红 / 收入绿 / 转账蓝)。 */}
      <Tabs
        aria-label="交易类型"
        selectedKey={selectedType}
        onSelectionChange={(key) =>
          handleTypeSwitch(key as "income" | "expense" | "transfer")
        }
      >
        <Tabs.List>
          <Tabs.Tab
            id="expense"
            className={TYPE_META.expense.selectedTextCls}
          >
            支出
            <Tabs.Indicator className={TYPE_META.expense.indicatorCls} />
          </Tabs.Tab>
          <Tabs.Tab
            id="income"
            className={TYPE_META.income.selectedTextCls}
          >
            收入
            <Tabs.Indicator className={TYPE_META.income.indicatorCls} />
          </Tabs.Tab>
          <Tabs.Tab
            id="transfer"
            className={TYPE_META.transfer.selectedTextCls}
          >
            转账
            <Tabs.Indicator className={TYPE_META.transfer.indicatorCls} />
          </Tabs.Tab>
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
        <HeroUILabel htmlFor="accountId">
          {isTransfer ? "转出账户" : "账户"}
        </HeroUILabel>
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <HeroUISelect
              // RHF 的 accountId 是 string;空串视为未选 → null。HeroUI 的
              // value 接受 Key|null,onChange 回传 Key|null。
              value={(field.value || null) as Key | null}
              onChange={(key) => field.onChange(key === null ? "" : String(key))}
              placeholder="选择账户"
            >
              <HeroUISelect.Trigger id="accountId">
                <HeroUISelect.Value>
                  {({ state, isPlaceholder, defaultChildren }) => {
                    if (isPlaceholder) return defaultChildren;
                    const selected = state.selectedItems[0]?.key;
                    const acc = unarchivedAccounts.find(
                      (a) => a.id === selected,
                    );
                    if (!acc) return defaultChildren;
                    return <AccountTriggerLabel account={acc} />;
                  }}
                </HeroUISelect.Value>
                <HeroUISelect.Indicator />
              </HeroUISelect.Trigger>
              <HeroUISelect.Popover>
                <ListBox>
                  {unarchivedAccounts.map((a) => (
                    <ListBox.Item key={a.id} id={a.id} textValue={a.name}>
                      <HeroUILabel>{a.name}</HeroUILabel>
                      <Description>
                        ¥{(a.initialBalance / 100).toFixed(2)}
                      </Description>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </HeroUISelect.Popover>
            </HeroUISelect>
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
          <HeroUILabel htmlFor="toAccountId">转入账户</HeroUILabel>
          <HeroUISelect
            value={(toAccountId || null) as Key | null}
            onChange={(key) => setToAccountId(key === null ? "" : String(key))}
            placeholder="选择转入账户"
          >
            <HeroUISelect.Trigger id="toAccountId">
              <HeroUISelect.Value>
                {({ state, isPlaceholder, defaultChildren }) => {
                  if (isPlaceholder) return defaultChildren;
                  const selected = state.selectedItems[0]?.key;
                  const acc = unarchivedAccounts.find(
                    (a) => a.id === selected,
                  );
                  if (!acc) return defaultChildren;
                  return <AccountTriggerLabel account={acc} />;
                }}
              </HeroUISelect.Value>
              <HeroUISelect.Indicator />
            </HeroUISelect.Trigger>
            <HeroUISelect.Popover>
              <ListBox>
                {unarchivedAccounts.map((a) => (
                  <ListBox.Item key={a.id} id={a.id} textValue={a.name}>
                    <HeroUILabel>{a.name}</HeroUILabel>
                    <Description>
                      ¥{(a.initialBalance / 100).toFixed(2)}
                    </Description>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </HeroUISelect.Popover>
          </HeroUISelect>
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
        <TextArea
          id="remark"
          placeholder="如:午餐咖啡"
          rows={3}
          maxLength={200}
          className="w-full resize-none"
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
            {/* 不加 fullWidth:日期框按 年/月/日 + 日历图标 自适应宽度,
                不随整行撑满(与金额/账户等可填满整行的字段区分)。 */}
            <DateField.Group>
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

  // 提交按钮(embedded / page 模式共用)—— 底色随交易类型变化
  // (TYPE_META: 支出红 / 收入绿 / 转账蓝)。`!` 提权以稳定覆盖 HeroUI
  // .button--primary 的 --button-bg。
  const submitButton = (
    <Button
      type="submit"
      className={cn("w-full", TYPE_META[selectedType].submitCls)}
      disabled={isSubmitting}
    >
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
