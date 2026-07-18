# Contract: dashboard.summary (扩展)

**Feature**: 027-mobile-home-revamp | **Procedure**: `dashboard.summary` | **Type**: tRPC v11 query

**Spec ref**: [spec.md FR-001..FR-008](../spec.md) | **Data model**: [data-model.md §2.1-2.5](../data-model.md) | **Research**: [research.md R2/R4/R5/R6/R9](../research.md)

> ⚠️ 宪章二禁止手写 OpenAPI 契约。tRPC 类型自动派生,本文件仅描述**行为契约**。相对 026 的变更用 **[027 变更]** 标注。
>
> 📌 **[030 更新]**:`expenseTrend` 语义自 030-home-trend-area-today 起改为**本周 Mon..Sun UTC 7 桶**(固定,不随 month 输入),`daily.current/previous/comparisonPercent` 与 `weekly` 历史月分支均不再使用;新增 `dayExpense: number | null`(当日 expense 净额 | 降级)。当前真相源见 [`specs/030-home-trend-area-today/contracts/dashboard-summary.md`](../../030-home-trend-area-today/contracts/dashboard-summary.md)。本文件保留为 027 历史快照。

## Procedure Signature

```ts
dashboardRouter.summary: protectedProcedure
  .input(z.object({
    year: z.number().int().min(2020).max(currentYear).optional(),
    month: z.number().int().min(1).max(12).optional(),
  }).optional())
  .query(...)
```

**Auth**: `protectedProcedure`。输入与 026 完全一致(零输入变更)。

## Input Schema

同 026(见 [026 contract](../../026-cream-amber-revamp/contracts/dashboard-summary.md))。`year`/`month` 可选,server 端缺省解析为当前 UTC 年月。

## Output Schema

```ts
{
  queriedYearMonth: { year: number; month: number };
  monthIncome: number;     // [027 变更] type-driven SUM,排除 transfer
  monthExpense: number;    // [027 变更] type-driven SUM(ABS),含退款(正向 expense)
  monthNet: number;        // monthIncome - monthExpense
  topExpenseCategories: Array<{...}>;  // [027 变更] 长度 ≤ 4(026 是 2)
  recentTransactions: Array<{...}>;    // [027 变更] 长度 ≤ 5(026 是 4)
  expenseTrend: ExpenseTrend;          // [027 变更] 本月每日 + 上月同期(见下)
  budget: BudgetSummary | null;        // [027 新增] null=加载失败降级
  assets: AssetsSummary | null;        // [027 新增] null=加载失败降级
}

// [027 变更] expenseTrend 重做(research R6)
type ExpenseTrend =
  | {                                       // 当前月
      granularity: "daily";
      current: Array<{ date: "YYYY-MM-DD"; amount: number }>;   // 本月 1 日..今天,补零
      previous: Array<{ date: "YYYY-MM-DD"; amount: number }>;  // 上月 1 日..同长度,对齐
      comparisonPercent: number | null;     // 本月合计 vs 上月合计;null=上月无数据
    }
  | {                                       // 历史月(保持 026 weekly)
      granularity: "weekly";
      buckets: Array<{ startDate; endDate; label; amount }>;
    };

// [027 新增]
type BudgetSummary =
  | { status: "unset" }
  | { status: "normal" | "warning"; usagePercent: number; remaining: number }
  | { status: "overspent"; usagePercent: number; overspendAmount: number };

// [027 新增]
type AssetsSummary = {
  totalAssets: number;
  totalLiabilities: number;
  netAssets: number;
};
```

## Business Rules

1. **缺省解析**:同 026。
2. **金额符号 [027 变更]**(research R9):
   - `monthIncome = SUM(CASE WHEN type='income' THEN amount ELSE 0 END)`(type-driven,防 transfer 正 amount 误入)
   - `monthExpense = SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END)`(type-driven + ABS,含退款正向 expense)
   - transfer 完全不参与两聚合。
3. **topExpenseCategories [027 变更]**:Top **4**(026 是 2),按金额 DESC + categoryName ASC tie-break;`percentage = round(amount / monthExpense * 1000) / 10`。
4. **recentTransactions [027 变更]**:固定 **5** 条(026 是 4),不受月份影响。
5. **expenseTrend [027 变更]**:
   - 当前月 → daily,`current` 本月 1 日..今天(UTC)补零,`previous` 上月 1 日..同日数对齐,`comparisonPercent = round((本月合计 - 上月合计) / 上月合计 * 1000) / 10`(上月合计 0 → null)。
   - 历史月 → weekly(026 逻辑不变)。
6. **budget [027 新增]**(research R2/R4):并行查 `budgets` 表 by (familyId, year, month);命中则 `computeBudgetStatus(monthExpense, budget.amount)`(research R4 四态);未命中 → `{ status: "unset" }`;查询失败 → `null`(降级,SC-008)。
7. **assets [027 新增]**(research R2/R5):并行查 accounts + transactions 按 type 分组聚合;失败 → `null`。
8. **familyId 隔离**:所有查询含 `WHERE family_id = ?`。

## Error Scenarios

| 场景 | 行为 |
|---|---|
| 未登录 | tRPC `UNAUTHORIZED` |
| `year`/`month` 超范围 | tRPC `BAD_REQUEST` |
| 预算子查询失败 | `budget: null`,主汇总正常返回(SC-008) |
| 资产子查询失败 | `assets: null`,主汇总正常返回(SC-008) |
| 该月无交易 | `monthIncome=0, monthExpense=0, monthNet=0, topExpenseCategories=[], budget.status` 仍按预算计算,`expenseTrend.current` 全 0 |
| DB 主连接失败 | tRPC `INTERNAL_SERVER_ERROR` |

## Test Scenarios(集成测试)

1-5. 同 026(当前月默认 / 指定月 / 只传 year / 空数据月 / 跨家庭隔离)。
6. **[027 新增] transfer 不计入收支**:插入 transfer,recentTransactions 含它,但 monthIncome/monthExpense 不含。
7. **[027 新增] 退款冲减**:某分类有 -¥100 expense + ¥30 expense(退款),topExpenseCategories 该分类按 ¥70 排名。
8. **[027 新增] 预算四态**:分别设预算使 usagePercent = 50/80/100/120,断言 status = normal/warning/overspent/overspent;未设预算 → unset。
9. **[027 新增] 资产 type 分组**:2 asset + 1 debt 账户,断言 totalAssets/totalLiabilities/netAssets。
10. **[027 新增] 趋势上月同期**:本月与上月各有数据,断言 comparisonPercent 正确;上月无数据 → null。
11. **[027 新增] 预算失败降级**:模拟 budgets 表查询超时,budget=null,主汇总正常返回。

## Performance Budget

- **p95 < 500ms**(宪章五,扩展后保持)
- 6 个并行 task(summary / recent / breakdown / trend / budget / assets)via `Promise.all`;budget/assets 用 `.catch(() => null)` 降级
- 决定项仍是 `getCategoryBreakdown`(GROUP BY + JOIN);budget(单行 UNIQUE 查)< 5ms,assets(单次聚合)< 100ms,不改变决定项
