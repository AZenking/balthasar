# Data Model: 首页趋势图改面积平滑 + 本日支出

**Feature**: 030-home-trend-area-today | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

> Phase 1 output。本 feature **不新增表、不修改 schema、不新增 migration**(spec Assumptions:纯展示 + 聚合窗口调整,不触碰领域不变量)。本文档记录**派生聚合语义**与 `dashboard.summary` 输出字段扩展。

## 1. Schema 变更

**无。**

- `transaction` 表不变(沿用 027 的 `type` / `amount` / `familyId` / `occurredAt` / `isRefund` 语义)。
- `budget` / `account` / `category` 表不变。
- 无新 migration、无新索引(所有新查询复用既有 `transaction.familyId` + `occurredAt` 过滤路径)。

## 2. 派生聚合(非持久化)

两个派生值,均由 `dashboard.summary` procedure 在请求时计算并返回。

### 2.1 本日支出(DayExpense)

```ts
type DayExpense = number | null; // cents;null = 查询失败降级
```

**定义**:当前 UTC 日(`Date.UTC(now.year, now.month, now.day)` .. +24h)、`familyId` 隔离、所有 `type='expense'` 交易金额之和的 `ABS`(含退款冲减,与 027 R9 / `getMonthSummary` 同口径)。

**计算路径**(R7):
```ts
const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const todayEnd = new Date(todayStart.getTime() + 24*60*60*1000);
// 复用 getDailyTrend 1 天窗口 → [0].amount
const dayBuckets = await getDailyTrend({ familyId, weekStart: todayStart, weekEnd: todayEnd });
const dayExpense = dayBuckets[0]?.amount ?? 0; // 1 桶,恒存在(padDailyBuckets 保证)
```

**值域**:
- `0` = 今日无 `type='expense'` 交易(合法值,显示 `¥0.00`)。
- `> 0` = 今日净支出(退款正向 amount 已冲减)。
- `null` = 子查询抛错(降级,显示 `¥0.00`,spec FR-003)。

**隔离**:`familyId` 必填,与 `getMonthSummary` 同一隔离口径(spec Edge Cases)。

### 2.2 本周趋势(CurrentWeekTrend)

```ts
type CurrentWeekTrendBucket = { date: "YYYY-MM-DD"; amount: number }; // cents
type CurrentWeekTrend = { granularity: "daily"; buckets: CurrentWeekTrendBucket[] };
// buckets.length === 7 (周一..周日 UTC),固定
```

**定义**:当前 UTC 自然周(周一 00:00 UTC .. 下周一 00:00 UTC exclusive),7 个连续日桶,每桶 = 该 UTC 日 `type='expense'` 净支出(`ABS`,含退款冲减)。**窗口固定为本周,不随 `dashboard.summary` 的 `year`/`month` 输入变化**(Clarification Q2)。

**计算路径**(R5/R6):
```ts
const { start: weekStart, end: weekEnd } = getCurrentUtcWeekRange(now);
const buckets = await getDailyTrend({ familyId, weekStart, weekEnd });
// 返回 7 桶(Mon..Sun),缺数据日(含今日之后的本周未来日)补 0
```

**桶顺序**:升序(Mon → Sun),与 `padDailyBuckets` 既有契约一致(`src/lib/date-ranges.ts:137-159`)。

**未来日补零**(Clarification Q3):今日若在本周中间(如周三),周四..周日按 0 补齐,7 桶固定。代价:折线在"今天"之后坠到 0(可接受,图表骨架稳定优先)。

**与所选 month 的关系**:procedure 的 `year`/`month` 输入只影响 `getMonthSummary`(monthExpense/Income/Net)、`getCategoryBreakdown`、`getBudget`。`expenseTrend` 与 `dayExpense` 都基于 `now`(当前 UTC),与 `year`/`month` 输入**无关**。

## 3. `dashboard.summary` 输出字段扩展

相对 027 既有输出(`specs/027-mobile-home-revamp/contracts/dashboard-summary.md`),本 feature 新增 2 个字段、修改 1 个字段的语义。

| 字段 | 027 状态 | 030 变更 |
|---|---|---|
| `monthIncome` / `monthExpense` / `monthNet` | 不变 | — |
| `topExpenseCategories` | 不变 | — |
| `recentTransactions` | 不变 | — |
| `budget` / `assets` | 不变 | — |
| `expenseTrend` | daily,本月每日(1 日..今天/月末) | **语义变更**:daily,**本周 7 桶**(Mon..Sun UTC),与 month 输入解耦 |
| `dayExpense` | — | **新增**:`number \| null`(cents),当日 expense 净额;null=降级 |

完整契约见 [contracts/dashboard-summary.md](./contracts/dashboard-summary.md)。

## 4. 不变量(本 feature 不改变任何领域不变量)

- `Family` 聚合仍是唯一聚合根,所有派生聚合通过 `familyId` 引用。
- 跨聚合引用仍用 ID。
- `Transaction` 的 `type` / `amount` / `isRefund` 语义不变(退款 = `type='expense'` + 正 amount,027 R9)。
- 金额单位全链路 cents,展示层除以 100(对齐 027 `formatCents`)。
- 所有聚合受 `familyId` 隔离,无跨家庭泄漏。

## 5. 迁移与回滚

**无 schema 迁移**。代码层回滚 = revert 本 feature 的代码改动(router/组件/page/date-ranges),不影响数据库。

- `getCurrentUtcWeekRange` 是纯新增 helper,删除即回滚。
- `dashboard.summary` 的 `expenseTrend` 语义变更与 `dayExpense` 新增字段:前端若回滚到 027 版本,会忽略 `dayExpense` 字段、且 `expenseTrend` 仍按 7 桶渲染(只是数据是本周而非本月)——向后兼容,无破坏。
