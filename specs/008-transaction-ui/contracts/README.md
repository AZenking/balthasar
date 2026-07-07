# Contracts: 008-transaction-ui

**状态**: 纯前端,无新 API 端点。

## 页面

| 路由 | 描述 |
|---|---|
| `/transaction/new` | 记账表单 (替换 007 占位页) |

## 后端 API 调用

| 调用 | 用途 |
|---|---|
| `trpc.account.list.useQuery()` | 加载账户下拉 (默认第一个未归档) |
| `trpc.category.list.useQuery({ type })` | 加载分类 (类型联动) |
| `trpc.transaction.create.useMutation()` | 提交交易 |
| `trpc.useUtils().dashboard.summary.invalidate()` | 刷新首页数据 |

## 组件

| 组件 | 路径 |
|---|---|
| TransactionForm | `src/components/transaction/transaction-form.tsx` |
| TransactionNewPage | `src/app/(app)/transaction/new/page.tsx` |

## 金额转换

```
前端输入: "35.50" (元, string)
提交转换: Math.round(parseFloat("35.50") * 100) = 3550 (分, integer)
后端接收: amount = 3550, type = 'expense' → DB amount = -3550 (signed)
```
