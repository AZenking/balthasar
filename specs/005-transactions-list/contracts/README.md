# Contracts: 005-transactions-list

**状态**: 扩展 004 的 `transaction.list`,不新增端点。

## 扩展后的 `transaction.list`

**Input** (004 基础 + 6 个可选筛选 + includeSummary):

```typescript
{
  // 004 基础
  limit?: number;          // 1-100, 默认 50
  cursor?: string;         // ISO 8601 datetime

  // 005 新增筛选
  type?: 'income' | 'expense';
  accountId?: string;      // UUID
  categoryId?: string;     // UUID
  startDate?: string;      // ISO 8601 datetime
  endDate?: string;        // ISO 8601 datetime
  keyword?: string;        // remark ILIKE '%keyword%'

  // 005 新增
  includeSummary?: boolean; // 默认 false
}
```

**Response** (004 基础 + 可选 summary):

```typescript
{
  items: Transaction[];     // 同 004 (含 JOIN accountName/categoryName/icon)
  nextCursor: string | null;
  summary?: {               // 仅 includeSummary=true 时存在
    income: number;         // 正数 (SUM of income amounts abs)
    expense: number;        // 正数 (SUM of expense amounts abs)
    net: number;            // income - expense (可负)
  }
}
```

## 筛选语义

- 所有筛选条件 AND 组合 (FR-009)
- 跨家庭 accountId → 自然过滤后空列表 (FR-003)
- startDate > endDate → 空列表 (不报错)
- keyword 空/空白 → 忽略;> 200 字符截断
- includeSummary=true 时,summary 汇总全量 (非仅当前页,FR-012)

详细 procedure schema 见 `src/server/api/routers/transaction.ts`。
