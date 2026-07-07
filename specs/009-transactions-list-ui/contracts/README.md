# Contracts: 009-transactions-list-ui

**状态**: 纯前端,无新 API。

## 页面

| 路由 | 描述 |
|---|---|
| `/transactions` | 流水列表 + 筛选 + 小计 + 编辑/删除 (替换 007 占位) |
| `/transaction/new?id=xxx` | 编辑模式 (008 表单复用,query param 切换 create→update) |

## 后端 API 调用

| 调用 | 用途 |
|---|---|
| `trpc.transaction.list.useQuery({ type?, accountId?, categoryId?, cursor?, includeSummary })` | 列表 + 分页 + 小计 |
| `trpc.account.list.useQuery()` | 筛选下拉 |
| `trpc.category.list.useQuery({ type })` | 筛选下拉 (类型联动) |
| `trpc.transaction.delete.useMutation()` | 删除 |
| `trpc.transaction.get.useQuery({ id })` | 编辑预填 |
| `trpc.transaction.update.useMutation()` | 编辑提交 |
| `trpc.useUtils().transaction.list.invalidate()` | 删除后刷新 |

## 组件

| 组件 | 路径 |
|---|---|
| TransactionFilters | `src/components/transactions/transaction-filters.tsx` |
| TransactionSummary | `src/components/transactions/transaction-summary.tsx` |
| TransactionListItem | `src/components/transactions/transaction-list-item.tsx` |
| TransactionsPage | `src/app/(app)/transactions/page.tsx` |
