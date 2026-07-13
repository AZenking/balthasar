# Contract: dashboard.summary

**Feature**: 026-cream-amber-revamp | **Procedure**: `dashboard.summary` | **Type**: tRPC v11 query

**Spec ref**: [spec.md FR-F001](../spec.md) | **Data model**: [data-model.md §2.1-2.2](../data-model.md)

> ⚠️ 宪章二禁止手写 OpenAPI/Swagger 契约。tRPC 类型自动派生,本文件仅描述**行为契约**(输入/输出/规则/测试),不作为 codegen 输入。

## Procedure Signature

```ts
dashboardRouter.summary: protectedProcedure
  .input(z.object({
    year: z.number().int().min(2020).max(currentYear).optional(),
    month: z.number().int().min(1).max(12).optional(),
  }))
  .query(...)
```

**Auth**: `protectedProcedure`(要求登录态,从 `ctx.session.user.id` 解析 familyId)。

## Input Schema

| 字段 | 类型 | 必填 | 校验 | 说明 |
|---|---|---|---|---|
| `year` | `number` | 否 | `2020 ≤ year ≤ 当前 UTC 年` | 缺省 = 当前 UTC 年 |
| `month` | `number` | 否 | `1 ≤ month ≤ 12` | 缺省 = 当前 UTC 月 |

**Zod schema**:
```ts
z.object({
  year: z.number().int().min(2020).max(new Date().getUTCFullYear()).optional(),
  month: z.number().int().min(1).max(12).optional(),
})
```

**注意**:若 `year` 提供但 `month` 缺省,server 端 NOT 报错,而把 `month` 当作"当前 UTC 月"(便于"看去年本月"场景)。反之同理。

## Output Schema

```ts
{
  queriedYearMonth: { year: number; month: number };  // 1-12
  monthIncome: number;     // 分,正数
  monthExpense: number;    // 分,正数
  monthNet: number;        // = monthIncome - monthExpense,可负
  topExpenseCategories: Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    amount: number;        // 分,正数
    percentage: number;    // 0-100,一位小数
  }>;                       // 长度 ≤ 2(降序)
  recentTransactions: Array<{
    id: string;
    type: 'income' | 'expense';
    amount: number;        // signed: income +, expense -
    remark: string;
    occurredAt: string;    // ISO UTC
    accountId: string;
    accountName: string | null;
    categoryId: string;
    categoryName: string | null;
    categoryIcon: string | null;
  }>;                       // 长度 ≤ 4,最新优先,**不受 month 影响**
  expenseTrend:
    | { granularity: 'daily'; buckets: Array<{ date: 'YYYY-MM-DD'; amount: number }> }
    | { granularity: 'weekly'; buckets: Array<{ startDate: 'YYYY-MM-DD'; endDate: 'YYYY-MM-DD'; label: string; amount: number }> };
}
```

## Business Rules

1. **缺省解析**(server 端,FR-F001):
   ```ts
   const now = new Date();
   const year = input?.year ?? now.getUTCFullYear();
   const month = input?.month ?? now.getUTCMonth() + 1;
   ```
2. **金额符号**(沿用 006 现有规则):
   - `monthIncome = SUM(amount) WHERE type='income'`(amount 已为正)
   - `monthExpense = SUM(ABS(amount)) WHERE type='expense'`(amount 在 DB 是负,取绝对值)
3. **topExpenseCategories**:取支出 Top 2,按金额降序;`percentage = round(amount / monthExpense * 1000) / 10`(一位小数);若 `monthExpense === 0`,所有 percentage = 0。
4. **recentTransactions**:固定 4 条,**不按月份过滤**(spec FR-C007),按 `occurredAt DESC`。
5. **expenseTrend 粒度切换**:
   - 当前月(`year === now.getFullYear() && month === now.getMonth()+1`)→ `daily`,从本周一到本周日,补零
   - 历史月 → `weekly`,按 `getUtcWeeksInMonth(year, month)` 切分,首尾不完整周仍计入
6. **familyId 隔离**:所有查询 MUST 包含 `WHERE family_id = ?`,不接受客户端传入 familyId。

## Error Scenarios

| 场景 | 行为 |
|---|---|
| 未登录 | tRPC `UNAUTHORIZED`(由 `protectedProcedure` 自动抛) |
| `year` 超范围 | tRPC `BAD_REQUEST`(zod 校验失败) |
| `month` 超范围 | tRPC `BAD_REQUEST` |
| 该月无交易 | 正常返回,`monthIncome=0, monthExpense=0, monthNet=0, topExpenseCategories=[], expenseTrend.buckets` 全为 0 |
| DB 连接失败 | tRPC `INTERNAL_SERVER_ERROR`(由全局 error handler) |

## Test Scenarios(集成测试,真实 PostgreSQL via testcontainers)

1. **当前月默认**:不传参,返回当前 UTC 月汇总 + daily trend
2. **指定月**:传 `{ year: 2026, month: 6 }`,返回 2026-06 汇总 + weekly trend
3. **只传 year**:传 `{ year: 2025 }`,month 自动解析为当前 UTC 月
4. **空数据月**:该月无交易,`monthNet=0`,trend buckets 全为 0(不返回空数组)
5. **跨家庭隔离**:Family A 的数据不出现 在 Family B 的查询结果
6. **recentTransactions 跨月**:即使指定历史月,recent 仍返回最新 4 条(可能跨越多月)
7. **Top 2 顺序**:多次同金额时,按 `categoryName` ASC 排序保证稳定
8. **percentage 边界**:`monthExpense=0` 时所有 percentage=0(不抛除零错误)
9. **daily 当前周补零**:本周一无交易,该日 amount=0
10. **weekly 历史月首尾周**:2026-06-01 是周日 → 第一周只含 1 天,仍作为独立 bucket

## Performance Budget

- **p95 < 500ms**(宪章五 + SC-007)
- 内部 3 个并行 query(summary / recent / breakdown)+ trend 聚合,通过 `Promise.all` 并发
- 索引利用:`transactions_family_occurred_idx`(time range)/ `transactions_family_type_idx`(type filter)/ `transactions_family_category_idx`(category join)
