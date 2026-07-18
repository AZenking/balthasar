"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import {
  transactionFormSchema,
  yuanToCents,
  type TransactionFormValues,
} from "@/lib/validators/transaction";
import { trpc } from "@/lib/trpc/client";
import { guardOnlineWrite } from "@/lib/pwa/write-guard";
import { requestOutcomeFromError } from "@/lib/pwa/service-reachability";
import { createDraftStorage, isEmptyDraft, type DraftForm, type TransactionDraft } from "@/lib/pwa/draft-storage";
import { createDraftController } from "@/lib/pwa/transaction-draft-controller";
import { usePwaRuntime } from "@/components/pwa/pwa-provider";
import { useAccountScope } from "@/components/pwa/account-scope-sync";
import { DraftRecoveryDialog } from "@/components/pwa/draft-recovery-dialog";
import { cn } from "@/lib/utils";
import { CategorySelect } from "@/components/category/category-select";
import {
  Button,
  Skeleton,
  Tooltip,
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
import { useVisualViewport } from "@/lib/hooks/use-visual-viewport";
import { useScrollIntoViewOnFocus } from "@/lib/hooks/use-scroll-into-view-on-focus";
import { computeFooterPaddingBottom } from "@/components/transaction/compute-footer-padding-bottom";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

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
export const TYPE_META: Record<
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
      <span className="text-xs text-muted">
        ¥{(account.initialBalance / 100).toFixed(2)}
      </span>
    </span>
  );
}

export function TransactionForm({
  editId,
  embedded = false,
  formAttachRef,
  onSubmitted,
}: {
  editId?: string;
  /**
   * embedded = true 时去掉外层 Card / Header / Footer,只渲染表单字段。
   * 用于 Drawer / Modal 等容器场景(容器自带 Header/Footer)。
   * 默认 false:独立 page 模式(/transaction/new / /transaction/[id]/edit)。
   */
  embedded?: boolean;
  /**
   * 031 R3:embedded 模式下,scroll container(Drawer.Body)由父级
   * TransactionDrawer 持有(它的 ref 指向 Drawer.Body)。本组件把父级传入的
   * attachRef 挂到表单根 div,作为 focusin 事件委托根。仅 embedded 模式使用。
   */
  formAttachRef?: (node: HTMLDivElement | null) => void;
  /** 提交成功后触发(用于关 Drawer / Modal)。embedded 模式下推荐传。 */
  onSubmitted?: () => void;
}) {
  const { connectivity, install: pwaInstall } = usePwaRuntime();
  const accountScope = useAccountScope();
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const [serverError, setServerError] = useState("");

  // 031 键盘避让收敛:
  // - embedded 模式(Drawer 内嵌):不再需要 keyboardHeight(高度由 Drawer 侧的
  //   --visual-viewport-height CSS 变量钳制);scroll 由父级 TransactionDrawer 的
  //   useScrollIntoViewOnFocus 负责,attachRef 经 formAttachRef 透传。
  // - page 模式(全屏):沿用自有 scroll container(Card.Content)+ 既有 sticky
  //   bottom(Card.Footer paddingBottom 跟随键盘,029 US2 行为不变)。
  const { keyboardHeight } = useVisualViewport();
  const pageScrollApi = useScrollIntoViewOnFocus<HTMLDivElement>();

  const isEditMode = !!editId;
  const isCreateMode = !isEditMode;
  const draftScope = isCreateMode ? accountScope : null;

  // ── Draft (create mode only) ──
  // Lazily build a single storage/controller pair per form instance. Edit
  // mode deliberately leaves these null so it can never read or overwrite a
  // saved draft.
  const draftStorageRef = useRef<ReturnType<typeof createDraftStorage> | null>(null);
  const draftControllerRef = useRef<ReturnType<typeof createDraftController> | null>(null);
  if (draftScope && typeof localStorage !== "undefined" && !draftStorageRef.current) {
    draftStorageRef.current = createDraftStorage(localStorage);
  }
  if (draftStorageRef.current && !draftControllerRef.current) {
    const storage = draftStorageRef.current;
    draftControllerRef.current = createDraftController({
      save: (scope, form) => storage.schedule(scope, form),
      clear: () => storage.clear(),
    });
  }
  const [recovery, setRecovery] = useState<{ savedAt: string; draft: TransactionDraft } | null>(null);

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

  // ── Draft: first-mount recovery check (create mode only) ──
  useEffect(() => {
    if (!draftScope || !draftStorageRef.current) return;
    const existing = draftStorageRef.current.read(draftScope);
    if (existing.kind === "valid") {
      // 修复 bug:空草稿(全是 defaultValues,无实质输入)不弹恢复窗。
      // 见 isEmptyDraft 说明:表单挂载时 watch() 会 emit 默认值并触发 auto-save,
      // 不拦就会在下一次打开时弹一个"什么都没填"的恢复窗。
      if (isEmptyDraft(existing.draft.form)) {
        draftStorageRef.current.clear();
        return;
      }
      const savedAt = new Date(existing.draft.updatedAt);
      const display = `${savedAt.getFullYear()}-${pad(savedAt.getMonth() + 1)}-${pad(savedAt.getDate())} ${pad(savedAt.getHours())}:${pad(savedAt.getMinutes())}`;
      setRecovery({ savedAt: display, draft: existing.draft });
    }
    // Run only once per form instance — we never want to re-prompt mid-session.
  }, []);

  // ── Draft: auto-save on field changes (300ms debounce inside storage) ──
  useEffect(() => {
    if (!draftScope || !draftControllerRef.current) return;
    const subscription = watch((values) => {
      const snapshot: DraftForm = {
        type: selectedType,
        accountId: (values.accountId as string) ?? "",
        toAccountId,
        categoryId: (values.categoryId as string) ?? "",
        amount: (values.amount as string) ?? "",
        remark: (values.remark as string) ?? "",
        occurredAt: (values.occurredAt as string) ?? "",
      };
      // 修复 bug:空草稿(无实质输入)不写入,从源头避免下次打开误弹恢复窗。
      // 注意:若用户先把内容填了再全部清空,这里也会把已存的草稿清掉,符合预期
      // (用户把字段清空 = 不想留草稿)。
      if (isEmptyDraft(snapshot)) {
        draftStorageRef.current?.clear();
        return;
      }
      draftControllerRef.current!.save(draftScope, snapshot);
    });
    return () => subscription.unsubscribe();
  }, [watch, draftScope, selectedType, toAccountId]);

  // ── Draft: flush on pagehide / visibilitychange ──
  useEffect(() => {
    if (!draftScope || !draftStorageRef.current) return;
    const storage = draftStorageRef.current;
    const flush = () => storage.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [draftScope]);

  const handleRestoreDraft = () => {
    if (!recovery) return;
    const draft = recovery.draft;
    setSelectedType(draft.form.type);
    setValue("accountId", draft.form.accountId);
    setValue("categoryId", draft.form.categoryId);
    setValue("amount", draft.form.amount);
    setValue("remark", draft.form.remark);
    setValue("occurredAt", draft.form.occurredAt);
    setToAccountId(draft.form.toAccountId);
    setRecovery(null);
  };
  const handleDiscardDraft = () => {
    draftStorageRef.current?.clear();
    setRecovery(null);
  };

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
      // Draft flow (create mode only): definite success → drop the draft so
      // the user can't accidentally restore an already-booked entry.
      if (draftScope && draftControllerRef.current) {
        draftControllerRef.current.onSuccess();
      }
      // US5: first successful create unlocks the one-shot proactive install
      // CTA. We never block the success path on this; it is a UI side-effect.
      try {
        pwaInstall.markCoreActionReached();
      } catch {
        // Provider may be unmounted in tests; ignore.
      }
      // 025 FR-005:optimistic 反馈 — toast 在 onSubmit 里已立刻显示
      // "已记账 ✓",这里只做 server 确认后的 invalidate + navigate。
      handlePostSuccess();
      if (!embedded) router.push("/dashboard");
    },
    onError: (e) => {
      // 后台失败:回滚 toast + 提示。表单状态仍在,用户可改后重提。
      // tRPC v11 TRPCError:.message 在 top-level,.data.code 是 SERVER_ERROR_CODE。
      const reason = e?.message ?? e?.data?.code ?? "请重试";
      toast.error(`保存失败:${reason}`, { id: "tx-create" });
    },
  });

  const updateMutation = trpc.transaction.update.useMutation({
    onSuccess: () => {
      handlePostSuccess();
      if (!embedded) router.push(transactionsHref);
    },
    onError: (e) => {
      const reason = e?.message ?? e?.data?.code ?? "请重试";
      toast.error(`保存失败:${reason}`, { id: "tx-update" });
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
        <p className="text-muted">请先创建账户</p>
        <Button variant="outline" onPress={() => router.push("/settings")}>
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
    if (!guardOnlineWrite(connectivity.stableOnline, () => {}, setServerError)) {
      return;
    }
    // 025 FR-005:optimistic 反馈 —— 通过 sonner toast 在用户点击 <100ms 内
    // 显示"已提交"状态。toast id 用于后续 onError 替换为 error 消息(回滚)。
    // 不做缓存层乐观更新(transaction.list / dashboard.summary cache 写入)
    // 因为表单提交后立即 invalidate + 路由跳转,server 真值会在 < 500ms 内
    // 反映到目标页面;真做 cache 写入收益小、风险大(YAGNI)。
    const toastId = isEditMode ? "tx-update" : "tx-create";
    toast.success(isEditMode ? "已保存 ✓ — 正在同步" : "已记账 ✓ — 正在同步", {
      id: toastId,
    });
    try {
      const baseAccountId = data.accountId || unarchivedAccounts[0]!.id;
      if (isTransfer) {
        // 027 US4:转账 —— 无 categoryId,需 toAccountId,且 !== accountId。
        if (!toAccountId) {
          setServerError("请选择转入账户");
          toast.error("请选择转入账户", { id: toastId });
          return;
        }
        if (toAccountId === baseAccountId) {
          setServerError("转出账户与转入账户不能相同");
          toast.error("转出账户与转入账户不能相同", { id: toastId });
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
          toast.error("转账暂不支持编辑,请删除后重建", { id: toastId });
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
      // Draft flow (create mode only): network/timeout means the request was
      // sent but we never saw the server's verdict. Mark the draft uncertain
      // so the user can verify the transaction list before re-submitting — we
      // never auto-retry a non-idempotent create.
      if (draftScope && draftStorageRef.current) {
        const outcome = requestOutcomeFromError(e);
        if (outcome.kind === "network" || outcome.kind === "timeout") {
          draftStorageRef.current.markUncertain(draftScope);
          draftControllerRef.current?.onUncertain();
          setServerError(
            "请求未确认,请先到交易列表核对。草稿已保留,不会自动重试。",
          );
          return;
        }
      }
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
        {/*
          031 R5 / FR-009:收紧 Tabs 密度,让 Drawer 首屏多露一个表单字段。
          HeroUI v3 Tabs 无 size prop(T003 /heroui-react skill 验证),密度经
          Tabs.List 的 className 控制 —— `*:` 前缀作用于直接子元素
          (HeroUI 的 .tabs__tab),官方 Styling 示例同款用法。
          h-8(默认 ≈ h-10-11) + px-3 + text-sm 收紧高度与字号,不碰颜色语义。
        */}
        <Tabs.List className="*:h-8 *:px-3 *:text-sm">
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
      {/* 主角高亮区(与预算弹窗一致):无边框 + surface 底 + ¥ 前缀 + 大号居中。
       * NumberField value 是 number,RHF/zod 用 string "0.00",Controller 桥接。
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
            <HeroUILabel className="sr-only">金额 (元)</HeroUILabel>
            <NumberField.Group className="h-auto items-center justify-center gap-1 rounded-2xl border-0 bg-[var(--surface)] px-4 py-4 shadow-none">
              <span className="text-3xl font-bold tabular-nums text-muted">
                ¥
              </span>
              <NumberField.Input
                placeholder="0.00"
                inputMode="decimal"
                autoFocus={!isEditMode}
                className="w-full border-0 bg-transparent p-0 text-center text-3xl font-bold tabular-nums text-foreground shadow-none outline-none focus:ring-0"
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
          <HeroUILabel htmlFor="categoryId">分类</HeroUILabel>
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
        <HeroUILabel htmlFor="remark">备注 (选填)</HeroUILabel>
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
      isDisabled={isSubmitting}
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
      {recovery && (
        <DraftRecoveryDialog
          isOpen
          savedAt={recovery.savedAt}
          onRestore={handleRestoreDraft}
          onDiscard={handleDiscardDraft}
          onClose={() => setRecovery(null)}
        />
      )}
      {embedded ? (
        // embedded 模式:无 Card 包裹(Drawer 自带 Header)。
        // 031 R1/R2/R3/R4 键盘避让收敛:
        // - **移除** 029 的 paddingBottom: keyboardHeight 补偿(R1 第二套机制);
        //   Drawer 侧用 --visual-viewport-height CSS 变量钳制 Drawer.Body 高度
        //   (见 transaction-drawer.tsx),Body 自然紧贴键盘上方。
        // - **flex flex-col + submit mt-auto**:submit 被 flex 推到 Drawer.Body
        //   可视区底部(Body 随键盘钳制收缩后,submit 自然停在键盘上方),
        //   无需任何 padding 补偿。替代把 submit 移出 Body 的更重方案(YAGNI)。
        // - formAttachRef(由父级 TransactionDrawer 传入)挂到表单根,focusin
        //   委托;父级的 scroll container ref 指向 Drawer.Body。
        <div ref={formAttachRef} className="flex min-h-full flex-col gap-4 pb-[max(env(safe-area-inset-bottom),16px)]">
          <div className="space-y-4">{formFields}</div>
          <div className="mt-auto pt-2">{submitButton}</div>
        </div>
      ) : (
        // 独立 page 模式:/transaction/new / /transaction/[id]/edit
        // 029 US2:Card.Content 接 scroll container ref 让聚焦字段滚入中心;
        // attachRef 挂表单根;Card.Footer paddingBottom 跟随键盘,让 submit
        // 始终在键盘上方 16px(全屏页行为不变,本 feature 不动)。
        <Card className="mx-4 mt-4">
          <Card.Header className="flex items-center gap-2">
            <Tooltip>
              <Tooltip.Trigger>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => router.back()}
                  aria-label="返回"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>返回</Tooltip.Content>
            </Tooltip>
            <Card.Title>{isEditMode ? "编辑交易" : "记一笔"}</Card.Title>
          </Card.Header>
          <Card.Content
            ref={(el) => {
              (
                pageScrollApi.scrollContainerRef as { current: HTMLElement | null }
              ).current = el;
              pageScrollApi.attachRef(el);
            }}
            className="space-y-4"
          >
            {formFields}
          </Card.Content>
          <Card.Footer
            className="transition-[padding-bottom] duration-200 ease-out"
            style={{
              paddingBottom: `max(env(safe-area-inset-bottom), ${computeFooterPaddingBottom(keyboardHeight)}px)`,
            }}
          >
            {submitButton}
          </Card.Footer>
        </Card>
      )}
    </form>
  );
}
