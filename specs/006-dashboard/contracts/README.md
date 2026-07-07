# Contracts: 006-dashboard

**状态**: T3 Stack,tRPC 类型自动推断。

## 入口端点 (1 个 procedure)

| 功能 | tRPC 路径 | 类型 | 鉴权 |
|---|---|---|---|
| 首页统计 | `trpc.dashboard.summary.useQuery()` | query | protectedProcedure |

## Response 类型

```typescript
{
  monthIncome: number;       // 当月收入总和 (正)
  monthExpense: number;      // 当月支出总和 (正)
  monthNet: number;          // monthIncome - monthExpense
  recentTransactions: Transaction[];  // 最近 5 笔 (不限当月,含 JOIN)
  topExpenseCategories: {
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    amount: number;          // 该分类当月支出绝对值
    percentage: number;      // 占当月总支出百分比 (1 位小数)
  }[];
}
```

无 input 参数 —— "当月" 自动从服务器当前 UTC 时间计算。
