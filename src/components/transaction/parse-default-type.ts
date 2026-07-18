/**
 * parseDefaultType — 032 US3 shortcuts URL query 解析(纯函数)。
 *
 * shortcuts 的 url 是 /transaction/new?type=expense|income|transfer。
 * /transaction/new/page.tsx 读 type query 后,经本函数校验并传给
 * TransactionForm 作为 defaultType。
 *
 * 无效/缺失 → undefined → TransactionForm 用默认值 "expense"(回归保护)。
 *
 * 抽成纯函数便于在 node 环境单测(宪章原则四),并集中"合法类型集合"定义。
 */

export const TRANSACTION_TYPES = ["expense", "income", "transfer"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/**
 * 把 URL query 的 type 值解析为合法 TransactionType,或 undefined。
 *
 * @param raw - searchParams.get("type") 的返回值(可能 null)
 * @returns 合法类型字符串,或 undefined(无效/缺失)
 */
export function parseDefaultType(
  raw: string | null | undefined,
): TransactionType | undefined {
  if (!raw) return undefined;
  return TRANSACTION_TYPES.includes(raw as TransactionType)
    ? (raw as TransactionType)
    : undefined;
}
