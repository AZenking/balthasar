# Data Model: 008-transaction-ui

**Date**: 2026-07-07

不新增表/迁移/schema。纯前端,复用 002/003/004 后端。

## 表单状态

```typescript
interface TransactionFormState {
  type: 'income' | 'expense';        // 默认 'expense'
  accountId: string;                  // 默认第一个未归档账户
  categoryId: string;                 // 用户选 (无默认)
  amount: string;                     // 元 (string, input), e.g. "35.50"
  remark: string;                     // 选填, max 200
  occurredAt: string;                 // ISO date, 默认今天
}
```

## 数据流

```
页面加载
  ├─ trpc.account.list.useQuery() → 账户列表 (选默认)
  └─ trpc.category.list.useQuery({ type: 'expense' }) → 分类列表

类型切换
  └─ trpc.category.list.useQuery({ type: newType }) → 自动 refetch

提交
  ├─ Math.round(parseFloat(amount) * 100) → 分
  ├─ trpc.transaction.create.useMutation() → { type, accountId, categoryId, amount(分), remark, occurredAt }
  ├─ 成功 → toast "记账成功" + invalidate dashboard + router.push('/dashboard')
  └─ 失败 → 显示错误,表单保留
```

## zod 校验

```typescript
// src/lib/validators/transaction.ts
const transactionFormSchema = z.object({
  type: z.enum(['income', 'expense']),
  accountId: z.string().uuid('请选择账户'),
  categoryId: z.string().uuid('请选择分类'),
  amount: z.string()
    .min(1, '请输入金额')
    .regex(/^\d+(\.\d{1,2})?$/, '金额格式无效'),
  remark: z.string().max(200).optional(),
  occurredAt: z.string(),
});
```
