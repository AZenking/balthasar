# Phase 0 Research: 006-dashboard

**Date**: 2026-07-07

## Q1: 3 个查询 vs 1 个大查询

### Decision
**3 个独立查询 Promise.all 并行**。

### Rationale
- monthSummary (SUM) + recentTransactions (SELECT LIMIT 5) + categoryBreakdown (GROUP BY) 逻辑不同,合并成 1 个 SQL 需要窗口函数或 CTE,复杂且 PG 优化器可能选择次优计划。
- 3 个简单查询各走各自索引,PG 优化器友好。
- Promise.all 并行 → 总延迟 ≈ max(3 个查询) ≈ 100ms,远低于 500ms 目标。
- 代码可读性: 3 个函数各司其职。

### Alternatives
- 单 CTE 查询: 复杂,可读性差。
- 2 查询 (summary + breakdown 合并,recent 单查): GROUP BY + SUM 无 GROUP 冲突,仍复杂。

---

## Q2: percentage 计算位置 — DB vs 应用层

### Decision
**应用层计算**。DB 返回 `category_id + SUM(ABS(amount))`,应用层算 `percentage = round(amount / totalExpense * 100, 1)`。

### Rationale
- DB 做除法 + ROUND 需要子查询 (先 SUM 再除),复杂化 SQL。
- 应用层有 totalExpense (来自 monthSummary 查询),直接除即可。
- 1 位小数四舍五入用 JS `Math.round(x * 10) / 10`。

### Alternatives
- DB `ROUND(SUM(ABS(amount))::numeric / $total * 100, 1)`: 需要先算 total 再传参,或子查询。复杂。

---

## Q3: "当月" UTC 边界计算

### Decision
应用层计算 `monthStart` (当月 1 日 00:00:00 UTC) 与 `monthEnd` (下月 1 日 00:00:00 UTC),传给 DB 做 `WHERE occurred_at >= $monthStart AND occurred_at < $monthEnd`。

```typescript
function getUTCMonthRange(date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}
```

### Rationale
- 与 004 Clarification Q2 (UTC 存储) 一致。
- 半开区间 `[start, end)` 避免月末 23:59:59.999 边界问题。
- 纯函数,可单元测试。

---

## 总结

3 项决策: 3 查询 Promise.all + percentage 应用层算 + UTC 月边界纯函数。
