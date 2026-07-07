# Data Model: 005-transactions-list

**Date**: 2026-07-07

本 feature **不新增表**。仅扩展 004 的 `transactions` 查询逻辑。

## 变更摘要

| 变更 | 文件 | 描述 |
|---|---|---|
| `listTransactions` 扩展 | `src/server/db/queries/transaction.ts` | input 增加筛选条件 (type/accountId/categoryId/startDate/endDate/keyword),WHERE 条件动态拼接 |
| `getTransactionSummary` 新增 | 同上 | 独立 SUM 查询,复用相同 WHERE 条件,返回 `{ income, expense, net }` |
| `list` procedure 扩展 | `src/server/api/routers/transaction.ts` | input schema 增加 6 个可选筛选 + `includeSummary: boolean`,response 增加 `summary?` 字段 |

## 查询逻辑

### listTransactions (扩展)

```sql
SELECT t.*, a.name as accountName, c.name as categoryName, c.icon as categoryIcon
FROM transactions t
LEFT JOIN accounts a ON a.id = t.account_id
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.family_id = $familyId
  [AND t.type = $type]               -- 可选
  [AND t.account_id = $accountId]     -- 可选
  [AND t.category_id = $categoryId]   -- 可选
  [AND t.occurred_at >= $startDate]   -- 可选
  [AND t.occurred_at <= $endDate]     -- 可选
  [AND t.remark ILIKE '%keyword%']    -- 可选
  [AND t.occurred_at < $cursor]       -- cursor 分页
ORDER BY t.occurred_at DESC
LIMIT $limit + 1
```

### getTransactionSummary (新增)

```sql
SELECT
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expense
FROM transactions
WHERE family_id = $familyId
  [AND ... 同上筛选条件, 不含 cursor]
```

`net = income - expense` (应用层计算)。

## 索引利用

004 已建的 4 个复合索引覆盖本 feature 所有筛选路径:
- `(family_id, occurred_at)` — 日期范围 + cursor
- `(family_id, type)` — type 筛选 + summary 聚合
- `(family_id, account_id)` — account 筛选
- `(family_id, category_id)` — category 筛选

keyword ILIKE 无法用索引 (全表扫描),但 < 1000 行场景 PG 顺序扫描 < 50ms。
