# Data Model: 009-transactions-list-ui

**Date**: 2026-07-07

不新增表/迁移。纯前端。

## 页面状态

```typescript
interface TransactionsPageState {
  // 筛选
  type: 'income' | 'expense' | undefined;
  accountId: string | undefined;
  categoryId: string | undefined;

  // 分页
  items: Transaction[];          // 累积的交易列表
  nextCursor: string | null;     // 下一页 cursor
  isLoadingMore: boolean;         // "加载更多" loading

  // 小计
  summary: { income: number; expense: number; net: number } | undefined;

  // 筛选区折叠
  filtersExpanded: boolean;       // 默认 false
}
```

## 数据流

```
页面加载
  └─ trpc.transaction.list.useQuery({
       type, accountId, categoryId,
       includeSummary: true
     }) → { items, nextCursor, summary }

"加载更多"
  ├─ trpc.transaction.list.useQuery({ cursor: nextCursor, ... })
  └─ 追加 items, 更新 nextCursor

筛选变化
  ├─ 重置 items (清空累积)
  └─ useQuery input 变化 → 自动 refetch 第 1 页

编辑
  └─ router.push('/transaction/new?id=交易ID')

删除
  ├─ window.confirm("确认删除?")
  ├─ trpc.transaction.delete.useMutation()
  └─ invalidate list + summary
```

## 组件结构

```
/transactions (page.tsx)
├── TransactionFilters (可折叠)
│   ├── 类型 tab (全部/支出/收入)
│   ├── 账户下拉
│   └── 分类下拉 (联动类型)
├── TransactionSummary (小计条)
│   └── 收入 / 支出 / 结余
├── TransactionList (列表)
│   └── TransactionListItem × N
│       ├── icon + 金额 + 分类 + 账户 + 备注 + 日期
│       ├── 编辑按钮 → /transaction/new?id=xxx
│       └── 删除按钮 → confirm → delete
├── "加载更多" 按钮 (nextCursor !== null)
└── 空状态 ("暂无交易" / "无符合条件的交易")
```
