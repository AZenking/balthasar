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
import {
  Button,
  Input,
  Label,
  RadioGroup,
  Radio,
  Select,
  ListBox,
} from "@heroui/react";

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
          <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
        )}
      </div>

      {/* 类型 —— HeroUI RadioGroup(资产/负债二选一)。
          HeroUI v3 Radio 是复合组件:必须用 Radio.Content(= react-aria
          RadioButton,可点击 label)包裹 Control + Indicator + 文字,
          否则无法勾选、布局错乱(无 RadioButton 容器)。 */}
      <div>
        <Label className="mb-1 block">账户类型</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onChange={(v) => field.onChange(v as "asset" | "debt")}
              orientation="horizontal"
              className="items-center gap-6"
            >
              <Radio value="asset">
                <Radio.Content className="flex cursor-pointer items-center gap-2 text-sm">
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  资产(银行卡/现金)
                </Radio.Content>
              </Radio>
              <Radio value="debt">
                <Radio.Content className="flex cursor-pointer items-center gap-2 text-sm">
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  负债(信用卡/贷款)
                </Radio.Content>
              </Radio>
            </RadioGroup>
          )}
        />
        <p className="mt-1 text-xs text-muted">
          负债账户的初始余额用负数表示欠款(如 -3200)。
        </p>
        {errors.type && (
          <p className="mt-1 text-xs text-danger">{errors.type.message}</p>
        )}
      </div>

      {/* 币种 */}
      <div>
        <Label className="mb-1 block">币种</Label>
        <Controller
          control={control}
          name="currency"
          render={({ field }) => (
            <Select
              selectedKey={field.value}
              onSelectionChange={(key) => field.onChange(key as Currency)}
              placeholder="选择币种"
            >
              <Select.Trigger className="w-full">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <ListBox.Item key={c} id={c} textValue={c}>
                      {c}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        />
        {errors.currency && (
          <p className="mt-1 text-xs text-danger">
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
          <p className="mt-1 text-xs text-danger">
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
          <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
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
              onChange={(v) => field.onChange(v as "asset" | "debt")}
              orientation="horizontal"
              className="items-center gap-6"
            >
              <Radio value="asset">
                <Radio.Content className="flex cursor-pointer items-center gap-2 text-sm">
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  资产(银行卡/现金)
                </Radio.Content>
              </Radio>
              <Radio value="debt">
                <Radio.Content className="flex cursor-pointer items-center gap-2 text-sm">
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  负债(信用卡/贷款)
                </Radio.Content>
              </Radio>
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
            <Select
              selectedKey={field.value}
              onSelectionChange={(key) => field.onChange(key as Currency)}
            >
              <Select.Trigger className="w-full">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <ListBox.Item key={c} id={c} textValue={c}>
                      {c}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        />
      </div>

      {/* SC-007:初始余额创建后不可变,给用户明确提示而非静默隐藏 */}
      <p className="rounded-md bg-default/50 px-3 py-2 text-xs text-muted">
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
        onPress={onCancel}
        isDisabled={submitting}
      >
        取消
      </Button>
      <Button type="submit" isDisabled={submitting}>
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
