# Data Model: 006-dashboard

**Date**: 2026-07-07

不新增表。仅聚合查询 004 的 transactions + JOIN 002 accounts + 003 categories。

## 查询逻辑

### 1. getMonthSummary (当月收支汇总)

```sql
SELECT
  COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
  COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS expense
FROM transactions
WHERE family_id = $familyId
  AND occurred_at >= $monthStart AND occurred_at < $monthEnd
```

### 2. getRecentTransactions (最近 5 笔)

```sql
SELECT t.*, a.name AS accountName, c.name AS categoryName, c.icon AS categoryIcon
FROM transactions t
LEFT JOIN accounts a ON a.id = t.account_id
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.family_id = $familyId
ORDER BY t.occurred_at DESC
LIMIT 5
```

注意: recentTransactions 不限当月 —— 用户刚登录时本月可能没交易,显示历史最近 5 笔更友好。

### 3. getCategoryBreakdown (当月支出分类占比)

```sql
SELECT c.id AS categoryId, c.name AS categoryName, c.icon AS categoryIcon,
       SUM(ABS(t.amount)) AS amount
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.family_id = $familyId
  AND t.type = 'expense'
  AND t.occurred_at >= $monthStart AND t.occurred_at < $monthEnd
GROUP BY c.id, c.name, c.icon
ORDER BY amount DESC
```

percentage 应用层算: `round(amount / monthExpense * 100, 1)`。

## UTC 月边界

```typescript
// src/server/domain/dashboard/month-range.ts
export function getUTCMonthRange(date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}
```

## 索引利用

004 已建索引:
- `(family_id, occurred_at)` — monthStart/monthEnd 范围过滤
- `(family_id, type)` — type='expense' GROUP BY
- recentTransactions 用 PK + ORDER BY occurredAt DESC LIMIT 5
