"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_MINOR_UNITS,
  type Currency,
} from "@/server/domain/account/currency";
import {
  accountCreateSchema,
  accountEditSchema,
  balanceToMinorUnits,
  type AccountCreateValues,
  type AccountEditValues,
} from "@/lib/validators/account";
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

/**
 * AccountForm (账户管理 新增/编辑 表单).
 *
 * 027 对齐 category-form:react-hook-form + zod + 每字段错误 + submitting
 * 防重复提交。弃用旧的手写 useState + 单条全局 error 模式。
 *
 * create: 名称 + 币种 + 类型 + 初始余额(允许负数,资产正 / 负债负)
 * edit:   名称 + 币种 + 类型(初始余额创建后不可变 SC-007,只读提示)
 *
 * 余额:
 * - 允许负数(信用卡/贷款欠款),与后端 domain validateInitialBalance 一致
 *   (旧表单曾错误拦截 balanceNum < 0,负债账户无法录入欠款)
 * - 币种感知:label 显示符号、placeholder 按小数位(JPY 0 位 / 其余 2 位)
 */

/** 提交给调用方的结构(create / edit 不同)。 */
export interface AccountCreateSubmit {
  name: string;
  currency: Currency;
  type: "asset" | "debt";
  initialBalanceCents: number;
}
export interface AccountEditSubmit {
  name: string;
  currency: Currency;
  type: "asset" | "debt";
}

type CreateProps = {
  mode: "create";
  onSubmit: (values: AccountCreateSubmit) => Promise<void> | void;
};
type EditProps = {
  mode: "edit";
  defaultValues: { name: string; currency: Currency; type: "asset" | "debt" };
  onSubmit: (values: AccountEditSubmit) => Promise<void> | void;
};
type CommonProps = {
  onCancel: () => void;
  submitting?: boolean;
};

export function AccountForm(
  props: (CreateProps | EditProps) & CommonProps,
) {
  const { mode, onCancel, submitting } = props;

  // ─── create: 带余额字段;edit: 不带余额 ───
  if (mode === "create") {
    return (
      <AccountCreateFormBody
        onSubmit={props.onSubmit}
        onCancel={onCancel}
        submitting={submitting}
      />
    );
  }
  return (
    <AccountEditFormBody
      defaultValues={props.defaultValues}
      onSubmit={props.onSubmit}
      onCancel={onCancel}
      submitting={submitting}
    />
  );
}

// ─────────────── create ───────────────
function AccountCreateFormBody({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (values: AccountCreateSubmit) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<AccountCreateValues>({
    resolver: zodResolver(accountCreateSchema),
    defaultValues: {
      name: "",
      currency: "CNY",
      type: "asset",
      initialBalanceDisplay: "",
    },
  });

  const currency = watch("currency");

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      name: values.name,
      currency: values.currency,
      type: values.type,
      initialBalanceCents: balanceToMinorUnits(
        values.initialBalanceDisplay,
        values.currency,
      ),
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* 名称 */}
      <div>
        <Label htmlFor="account-name" className="mb-1 block">
          账户名称
        </Label>
        <Input
          id="account-name"
          type="text"
          {...register("name")}
          maxLength={50}
          placeholder="如:招商银行卡"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* 类型 —— RadioGroup(资产/负债二选一,与 category-form 一致) */}
      <div>
        <Label className="mb-1 block">账户类型</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={(v) => field.onChange(v as "asset" | "debt")}
              className="flex h-10 items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="asset" id="account-type-asset" />
                <Label htmlFor="account-type-asset" className="cursor-pointer">
                  资产(银行卡/现金)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="debt" id="account-type-debt" />
                <Label htmlFor="account-type-debt" className="cursor-pointer">
                  负债(信用卡/贷款)
                </Label>
              </div>
            </RadioGroup>
          )}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          负债账户的初始余额用负数表示欠款(如 -3200)。
        </p>
        {errors.type && (
          <p className="mt-1 text-xs text-destructive">{errors.type.message}</p>
        )}
      </div>

      {/* 币种 */}
      <div>
        <Label className="mb-1 block">币种</Label>
        <Controller
          control={control}
          name="currency"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择币种" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.currency && (
          <p className="mt-1 text-xs text-destructive">
            {errors.currency.message}
          </p>
        )}
      </div>

      {/* 初始余额(create-only) */}
      <div>
        <Label htmlFor="account-balance" className="mb-1 block">
          初始余额({CURRENCY_SYMBOL[currency]})
        </Label>
        <Input
          id="account-balance"
          type="text"
          inputMode="decimal"
          {...register("initialBalanceDisplay")}
          placeholder={CURRENCY_MINOR_UNITS[currency] === 0 ? "0" : "0.00"}
        />
        {errors.initialBalanceDisplay && (
          <p className="mt-1 text-xs text-destructive">
            {errors.initialBalanceDisplay.message}
          </p>
        )}
      </div>

      <FormActions onCancel={onCancel} submitting={submitting} mode="create" />
    </form>
  );
}

// ─────────────── edit ───────────────
function AccountEditFormBody({
  defaultValues,
  onSubmit,
  onCancel,
  submitting,
}: {
  defaultValues: { name: string; currency: Currency; type: "asset" | "debt" };
  onSubmit: (values: AccountEditSubmit) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AccountEditValues>({
    resolver: zodResolver(accountEditSchema),
    defaultValues: {
      name: defaultValues.name,
      currency: defaultValues.currency,
      type: defaultValues.type,
    },
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      name: values.name,
      currency: values.currency,
      type: values.type,
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="account-name-edit" className="mb-1 block">
          账户名称
        </Label>
        <Input
          id="account-name-edit"
          type="text"
          {...register("name")}
          maxLength={50}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div>
        <Label className="mb-1 block">账户类型</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={(v) => field.onChange(v as "asset" | "debt")}
              className="flex h-10 items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="asset" id="account-type-edit-asset" />
                <Label htmlFor="account-type-edit-asset" className="cursor-pointer">
                  资产(银行卡/现金)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="debt" id="account-type-edit-debt" />
                <Label htmlFor="account-type-edit-debt" className="cursor-pointer">
                  负债(信用卡/贷款)
                </Label>
              </div>
            </RadioGroup>
          )}
        />
      </div>

      <div>
        <Label className="mb-1 block">币种</Label>
        <Controller
          control={control}
          name="currency"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* SC-007:初始余额创建后不可变,给用户明确提示而非静默隐藏 */}
      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        初始余额创建后不可修改。如需调整,请新建账户或通过记账变更。
      </p>

      <FormActions onCancel={onCancel} submitting={submitting} mode="edit" />
    </form>
  );
}

// ─────────────── 共用按钮 ───────────────
function FormActions({
  onCancel,
  submitting,
  mode,
}: {
  onCancel: () => void;
  submitting?: boolean;
  mode: "create" | "edit";
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={submitting}
      >
        取消
      </Button>
      <Button type="submit" disabled={submitting}>
        {submitting ? "提交中..." : mode === "create" ? "创建" : "保存"}
      </Button>
    </div>
  );
}

/**
 * 币种符号(用于余额 label)。仅展示用,不参与计算。
 * 缺省回退到币种代码本身。
 */
const CURRENCY_SYMBOL: Record<Currency, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  JPY: "¥",
  HKD: "HK$",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
};
