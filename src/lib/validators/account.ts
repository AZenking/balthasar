/**
 * Account form validators (账户管理表单 zod schema).
 *
 * 与 category.ts / transaction.ts 对齐:把客户端表单约束抽成共享 zod schema,
 * 镜像后端 procedure input(src/server/api/routers/account.ts createInput),
 * 让前后端字段约束一致。
 *
 * 注意:
 * - initialBalance 在表单层是字符串(便于输入框),提交前用
 *   balanceToMinorUnits 按币种小数位转成整数 minor units(分)再传给 mutation。
 * - 允许负数余额(信用卡/贷款欠款用负数表示),与后端 domain
 *   validateInitialBalance 一致(旧表单曾错误地拦截 balanceNum < 0)。
 */
import { z } from "zod";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_MINOR_UNITS,
  type Currency,
} from "@/server/domain/account/currency";

export const accountTypeSchema = z.enum(["asset", "debt"]);
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

const nameSchema = z
  .string()
  .trim()
  .min(1, "账户名称不能为空")
  .max(50, "账户名称不能超过 50 字");

/**
 * 初始余额显示值(字符串,允许负号)。
 * - JPY(0 位小数):整数,可带负号,如 "2000" / "-3200"
 * - 其余(2 位小数):如 "1000.50" / "-3200.00"
 * refine 二次校验:解析为有限数(杜绝 NaN / 空串残留)。
 */
const initialBalanceDisplaySchema = z
  .string()
  .trim()
  .min(1, "初始余额不能为空")
  .refine((v) => /^-?\d+(\.\d+)?$/.test(v), "金额格式无效")
  .refine((v) => Number.isFinite(parseFloat(v)), "金额格式无效");

export const accountCreateSchema = z
  .object({
    name: nameSchema,
    currency: currencySchema,
    type: accountTypeSchema,
    initialBalanceDisplay: initialBalanceDisplaySchema,
  })
  .strict();

/**
 * edit 模式不含 initialBalance(后端 SC-007:余额创建后不可变)。
 */
export const accountEditSchema = z
  .object({
    name: nameSchema,
    currency: currencySchema,
    type: accountTypeSchema,
  })
  .strict();

export type AccountCreateValues = z.infer<typeof accountCreateSchema>;
export type AccountEditValues = z.infer<typeof accountEditSchema>;

/**
 * 把表单里的显示字符串按币种小数位转成整数 minor units(分)。
 *   "35.50" CNY (2) → 3550
 *   "-3200" CNY (2) → -320000
 *   "2000"  JPY (0) → 2000
 * 传入前应已通过 schema 校验,这里不重复防御。
 */
export function balanceToMinorUnits(
  display: string,
  currency: Currency,
): number {
  const decimals = CURRENCY_MINOR_UNITS[currency];
  return Math.round(parseFloat(display) * Math.pow(10, decimals));
}
