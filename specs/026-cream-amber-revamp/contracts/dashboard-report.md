# Contract: dashboard.report

**Feature**: 026-cream-amber-revamp | **Procedure**: `dashboard.report` | **Type**: tRPC v11 query(新增)

**Spec ref**: [spec.md FR-F002](../spec.md) | **Data model**: [data-model.md §2.3-2.4](../data-model.md)

> ⚠️ 宪章二禁止手写 OpenAPI/Swagger 契约。tRPC 类型自动派生,本文件仅描述**行为契约**。

## Procedure Signature

```ts
dashboardRouter.report: protectedProcedure
  .input(z.object({
    endYear: z.number().int().min(2020).max(currentYear).optional(),
    endMonth: z.number().int().min(1).max(12).optional(),
  }))
  .query(...)
```

**Auth**: `protectedProcedure`。

## Input Schema

| 字段 | 类型 | 必填 | 校验 | 说明 |
|---|---|---|---|---|
| `endYear` | `number` | 否 | `2020 ≤ endYear ≤ 当前 UTC 年` | 缺省 = 当前 UTC 年 |
| `endMonth` | `number` | 否 | `1 ≤ endMonth ≤ 12` | 缺省 = 当前 UTC 月 |

**语义**:`endYear/endMonth` 是"目标月"(报表的焦点月份),趋势固定为目标月往前 6 个月(含目标月)。不支持任意日期范围(spec Assumptions)。

## Output Schema

```ts
{
  endYearMonth: { year: number; month: number };  // 目标月,1-12
  monthlyTrend: Array<{  // 长度 = 6,降序(目标月在首位)
    year: number;
    month: number;       // 1-12
    label: string;       // '2026年7月'
    income: number;      // 分,正数
    expense: number;     // 分,正数
    net: number;         // = income - expense,可负
  }>;
  targetMonthCategoryBreakdown: Array<{  // 长度 = N(目标月支出分类总数),按金额降序
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    amount: number;        // 分,正数
    percentage: number;    // 0-100,一位小数
  }>;
}
```

## Business Rules

1. **6 个月窗口计算**(server 端):
   ```ts
   const end = { year: endYear ?? now.getUTCFullYear(), month: endMonth ?? now.getUTCMonth()+1 };
   // 从 end 往前 6 个月(含 end),跨年时 year 自动减
   const months = [];
   for (let i = 0; i < 6; i++) {
     const d = new Date(Date.UTC(end.year, end.month - 1 - i, 1));
     months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
   }
   // months[0] = end,months[5] = end - 5 months
   ```
2. **monthlyTrend 查询**:对每个月调用 `getMonthSummary`(已有 helper),并行 `Promise.all`;返回按时间降序(months 原序)。
3. **targetMonthCategoryBreakdown**:只针对目标月,按 `categoryId` 聚合支出金额;`percentage = round(amount / targetMonthExpense * 1000) / 10`;若 `targetMonthExpense === 0`,返回空数组(不报错)。
4. **label 格式**:`${year}年${month}月`(中文,无前置零)。
5. **familyId 隔离**:同 summary,所有查询含 `WHERE family_id = ?`。

## Error Scenarios

| 场景 | 行为 |
|---|---|
| 未登录 | `UNAUTHORIZED` |
| `endYear/endMonth` 超范围 | `BAD_REQUEST` |
| 目标月无交易 | `monthlyTrend[i].income/expense/net = 0`;`targetMonthCategoryBreakdown = []` |
| 跨年(目标月 < 6):如 endYear=2026,endMonth=2 | `monthlyTrend` 含 2025-09 ~ 2026-02 共 6 项,顺序正确 |

## Test Scenarios

1. **默认目标月**:不传参,返回以当前月结尾的 6 个月趋势
2. **指定目标月**:传 `{ endYear: 2026, endMonth: 6 }`,返回 2026-01 ~ 2026-06
3. **跨年**:传 `{ endYear: 2026, endMonth: 2 }`,返回 2025-09 ~ 2026-02,顺序正确
4. **空数据目标月**:目标月无支出,`targetMonthCategoryBreakdown = []`,monthlyTrend 该月 income/expense/net 全为 0
5. **混合数据**:6 个月中只有 3 个月有交易,其余 3 个月 trend 仍出现(income/expense/net=0)
6. **分类百分比**:目标月支出 ¥100,餐饮 ¥60 → percentage=60.0
7. **跨家庭隔离**:Family A 的交易不出现在 Family B 报表
8. **label 格式**:`monthlyTrend[i].label` 为 `${year}年${month}月`

## Performance Budget

- **p95 < 800ms**(spec plan.md Technical Context + SC-007 同量级)
- 内部:6 次 `getMonthSummary` 并行 + 1 次 `getCategoryBreakdown`(目标月)+ 6 次 month range 计算(纯函数,可忽略)
- 优化机会:可用单条 SQL `GROUP BY date_trunc('month', occurred_at)` 一次查 6 个月(Switch PR 可选优化,初版用并行 `Promise.all` 即可)
- 索引利用:`transactions_family_occurred_idx` 覆盖月范围扫描;`transactions_family_category_idx` 覆盖分类 join
