# Contract: dashboard.summary (030 扩展)

**Feature**: 030-home-trend-area-today | **Procedure**: `dashboard.summary` | **Type**: tRPC v11 query

**Spec ref**: [spec.md FR-001..FR-011](../spec.md) | **Data model**: [data-model.md §2-3](../data-model.md) | **Research**: [research.md R5/R6/R7](../research.md)

> ⚠️ 宪章二禁止手写 OpenAPI 契约。tRPC 类型自动派生,本文件仅描述**行为契约**。相对 027 的变更用 **[030 变更]** 标注。

## Procedure Signature

```ts
dashboardRouter.summary: protectedProcedure
  .input(z.object({
    year: z.number().int().min(2020).max(currentYear).optional(),
    month: z.number().int().min(1).max(12).optional(),
  }).optional())
  .query(...)
```

**Auth**:`protectedProcedure`。输入与 027 完全一致(零输入变更)。

## Input Schema

同 027。`year`/`month` 可选,server 端缺省解析为当前 UTC 年月。**注意(030)**:`year`/`month` 只影响月维度聚合(monthIncome/Expense/Net、topExpenseCategories、budget);`expenseTrend` 与 `dayExpense` 基于当前 UTC 周/日,与 `year`/`month` 输入**无关**(见 Output)。

## Output Schema

```ts
{
  queriedYearMonth: { year: number; month: number };
  monthIncome: number;        // 不变(type-driven SUM)
  monthExpense: number;       // 不变(type-driven ABS SUM,含退款)
  monthNet: number;           // 不变
  topExpenseCategories: Array<{...}>;  // 不变(≤4)
  recentTransactions: Array<{...}>;    // 不变(≤5)
  expenseTrend: ExpenseTrend;          // [030 变更] 本周 7 桶(见下),与 month 解耦
  dayExpense: number | null;           // [030 新增] 当日 expense 净额(cents);null=降级
  budget: BudgetSummary | null;        // 不变
  assets: AssetsSummary | null;        // 不变
}

// [030 变更] expenseTrend:固定本周(Mon..Sun UTC),7 桶,与 month 输入解耦
type ExpenseTrend = {
  granularity: "daily";
  buckets: Array<{ date: "YYYY-MM-DD"; amount: number }>;  // 长度恒 = 7,Mon..Sun 升序
};
// 注:027 的 daily曾有 current/previous/comparisonPercent 设计(contract 文档),
// 实际 router 从未实现(comparisonPercent 由 page.tsx 第二次查询客户端算)。
// 030 移除环比徽标(FR-009),客户端不再算 comparisonPercent。
// weekly 分支不再使用(本月每日已废,历史月也用本周),但 ExpenseTrend 类型
// 保留 weekly 联合分支以兼容 expense-trend-chart.tsx 既有 WeeklyView(本次不删)。

// BudgetSummary / AssetsSummary 同 027,不变。
```

## Business Rules

1. **缺省解析**:同 027。
2. **金额符号**:同 027 R9(type-driven;monthIncome = `SUM(CASE type='income')`;monthExpense = `ABS(SUM(CASE type='expense'))`,含退款;transfer 排除)。
3. **topExpenseCategories**:同 027(Top 4)。
4. **recentTransactions**:同 027(固定 5 条,跨月)。
5. **expenseTrend [030 变更]**:
   - 窗口 = 当前 UTC 自然周(`getCurrentUtcWeekRange(now)` = 周一 00:00 UTC .. 下周一 00:00 UTC exclusive)。
   - 7 桶(Mon..Sun 升序),每桶 = 该 UTC 日 `type='expense'` 净支出(`ABS`,含退款冲减)。
   - 缺数据日(含今日之后的本周未来日)补 0(`padDailyBuckets` 既有契约)。
   - **与 `year`/`month` 输入无关**:无论 procedure 收到什么 month,`expenseTrend` 恒为当前本周。
   - 实现复用 `getDailyTrend({familyId, weekStart, weekEnd})`(`src/server/db/queries/dashboard.ts:150`),零查询函数变更。
6. **dayExpense [030 新增]**(R7):
   - = 当前 UTC 日(`Date.UTC(now.y, now.m, now.d)` .. +24h)、`familyId` 隔离、`type='expense'` 净支出(`ABS`,含退款)。
   - 实现复用 `getDailyTrend` 1 天窗口:`getDailyTrend({familyId, weekStart: todayStart, weekEnd: todayEnd})[0].amount`。
   - 无交易 → `0`(显示 `¥0.00`,**非** null)。
   - 子查询抛错 → `null`(降级,显示 `¥--.--`,对齐 SC-008)。
7. **budget / assets**:同 027(并行查 + `.catch(()=>null)` 降级)。
8. **familyId 隔离**:所有查询含 `WHERE family_id = ?`,dayExpense 与 expenseTrend 同口径。

## Error Scenarios

| 场景 | 行为 |
|---|---|
| 未登录 | tRPC `UNAUTHORIZED` |
| `year`/`month` 超范围 | tRPC `BAD_REQUEST` |
| dayExpense 子查询失败 | `dayExpense: null`,主汇总 + 趋势 + 其它正常返回(SC-008 / FR-003) |
| expenseTrend 子查询失败 | 走 027 既有 trend 降级路径(本 feature 不改) |
| 预算/资产子查询失败 | `budget/assets: null`(同 027) |
| 该月无交易 | monthIncome/Expense/Net=0,topExpenseCategories=[];**但 expenseTrend 仍返回本周 7 桶(可能全 0)、dayExpense 仍返回 0 或本周内今日值**(本周与所选月独立) |
| DB 主连接失败 | tRPC `INTERNAL_SERVER_ERROR` |

## Test Scenarios(集成测试)

继承 027 全部(1-11),新增:

12. **[030 新增] expenseTrend 恒为本周 7 桶,与 month 输入无关**:
    - 插入本周若干 expense + 上月若干 expense。
    - 分别以 `{month: 当前月}` 与 `{month: 上月}` 调用 summary。
    - 断言两次 `expenseTrend.buckets` **完全相同**(长度 7,Mon..Sun,值一致),且只含本周交易。
13. **[030 新增] dayExpense = 当日净支出(含退款)**:
    - 今日插入 -¥100 expense + ¥30 退款(+正 amount,`type='expense'`)。
    - 断言 `dayExpense === 7000`(¥70,退款冲减)。
14. **[030 新增] dayExpense 无交易 → 0(非 null)**:
    - 今日无任何交易。断言 `dayExpense === 0`。
15. **[030 新增] dayExpense 降级**:
    - 模拟 `getDailyTrend`(今日窗口)抛错。断言 `dayExpense === null`,其它字段正常。
16. **[030 新增] 本周未来日补零**:
    - `now` 固定为本周周三,今日有交易,周四..周日无数据。
    - 断言 `expenseTrend.buckets` 长度 7,今日(周三)桶 > 0,周四..周日桶 = 0。
17. **[030 新增] getCurrentUtcWeekRange 跨月边界**:
    - `now` 固定为某月 1 日且为周三(则本周一是上月 28/29/30 日)。
    - 断言 weekStart 落在上月,weekEnd = 本周一 + 7d,buckets 第一桶日期为上月最后几天(本周跨月,符合"自然周"语义)。

## Performance Budget

- **p95 < 500ms**(宪章五,扩展后保持)。
- 新增 1 次 `getDailyTrend`(今日 1 天窗口,1 桶)+ 1 次 `getDailyTrend`(本周 7 桶,替换原 month-daily)。原 month-daily 扫描整月 `[monthStart, monthEnd)` 行;本周窗口只扫描 7 天 + 今日 1 天,**扫描行数显著减少**(净性能收益)。
- **移除第二次 `summary` 查询**(R8:环比徽标删除连带删 `prevSummaryQuery`):每次首页加载减少 1 次完整 summary 调用(含 month 聚合 + breakdown + recent + budget + assets 全套),对首页 p95 是净收益。
- `getCurrentUtcWeekRange` 纯 CPU(O(1)),不计入 DB 预算。
- 决定项仍是 `getCategoryBreakdown`(GROUP BY + JOIN),本 feature 不改变其成本。
