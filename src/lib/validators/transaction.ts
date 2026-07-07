import { z } from "zod";

export const transactionFormSchema = z.object({
  type: z.enum(["income", "expense"]),
  accountId: z.string().min(1, "请选择账户"),
  categoryId: z.string().min(1, "请选择分类"),
  amount: z
    .string()
    .min(1, "请输入金额")
    .regex(/^\d+(\.\d{1,2})?$/, "金额格式无效,最多 2 位小数")
    .refine((v) => parseFloat(v) > 0, "金额必须大于 0"),
  remark: z.string().max(200, "备注最多 200 字").optional(),
  occurredAt: z.string().min(1, "请选择日期"),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

/**
 * Convert frontend yuan string to backend integer cents.
 * "35.50" → 3550
 */
export function yuanToCents(yuan: string): number {
  return Math.round(parseFloat(yuan) * 100);
}
