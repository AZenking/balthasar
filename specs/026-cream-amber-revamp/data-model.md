# Phase 1 Data Model: 1.0.0 奶油琥珀全站改版

**Feature**: 026-cream-amber-revamp | **Date**: 2026-07-13

本 spec **不引入数据库实体**(零 Drizzle migration,零 PostgreSQL schema 变更)。宪章 v3.0.0 §技术栈的 Drizzle/PostgreSQL 边界不受影响。本文档定义**应用层契约实体**及其属性、关系、生命周期,作为 contracts 与 quickstart 的语义基础。

---

## 1. 数据库实体(零变更,仅引用)

复用现有 schema,无新增 / 修改 / 删除:

| 表 | 字段(026 用到的子集) | 用途 |
|---|---|---|
| `members` | `id`, `familyId`, `userId`, `displayName`, `createdAt` | 昵称 mutation 目标;`displayName` 复用 |
| `transactions` | `id`, `familyId`, `type`, `accountId`, `categoryId`, `amount`(signed bigint), `remark`, `occurredAt`(UTC), `createdAt` | 报表 / 首页汇总 / 账单筛选数据源 |
| `accounts` | `id`, `familyId`, `name`, ... | 账单 join 显示 |
| `categories` | `id`, `familyId`, `name`, `icon`, ... | 报表分类分析 / 首页 Top 2 |
| `families` | `id`, `ownerUserId`, ... | 聚合根,familyId 隔离边界 |

详细 schema 见 `src/server/db/schema/*.ts` 与 `docs/DATABASE.md`。

**强约束**:026 不允许新增表 / 新增列 / 新增索引 / 修改约束。若 plan 阶段发现性能瓶颈需要新索引,作为 1.0.x patch 单独 spec 处理,不并入 026。

---

## 2. 应用层契约实体(工作流层抽象)

### 2.1 DashboardSummaryQuery(扩展自 006-dashboard)

**含义**: 首页汇总查询的输入契约。

| 字段 | 类型 | 约束 |
|---|---|---|
| `year` | `number | undefined` | 可选;缺省 = 当前 UTC 年 |
| `month` | `1-12 | undefined` | 可选;缺省 = 当前 UTC 月 |

**校验**:
- 若提供 `year`,MUST 在 `[2020, 当前年]` 范围
- 若提供 `month`,MUST 在 `1-12`
- 缺省解析在 server 端完成(避免客户端时区漂移)

**生命周期**: stateless query,每次调用独立;React Query 缓存 key 含 `year` + `month`。

---

### 2.2 DashboardSummaryResult

**含义**: `dashboard.summary` procedure 的输出。

| 字段 | 类型 | 语义 |
|---|---|---|
| `queriedYearMonth` | `{ year: number; month: 1-12 }` | 实际查询的年月(供客户端校正显示,见 FR-F001) |
| `monthIncome` | `number` | 该月收入合计(分,正数) |
| `monthExpense` | `number` | 该月支出合计(分,正数) |
| `monthNet` | `number` | `monthIncome - monthExpense`(可负) |
| `topExpenseCategories` | `Array<CategoryAmount>(前 2)` | 支出 Top 2 分类,按金额降序 |
| `recentTransactions` | `Array<SerializedTransaction>(最新 4)` | **不受月份影响**,固定最新 4 条 |
| `expenseTrend` | `DailyTrend | WeeklyTrend` | 当前月 → daily;历史月 → weekly |

**`CategoryAmount`**(复用 006-dashboard 现有 shape):
```ts
{ categoryId: string; categoryName: string; categoryIcon: string | null;
  amount: number; percentage: number }  // percentage 0-100,一位小数
```

**`SerializedTransaction`**(复用现有 `serializeTransaction` 输出):
```ts
{ id, type, amount, remark, occurredAt, accountId, accountId, accountName,
  categoryId, categoryName, categoryIcon }
```

**`DailyTrend`**:
```ts
{ granularity: 'daily';
  buckets: Array<{ date: 'YYYY-MM-DD'; amount: number }> }  // 周一至周日,补零
```

**`WeeklyTrend`**:
```ts
{ granularity: 'weekly';
  buckets: Array<{ startDate: 'YYYY-MM-DD'; endDate: 'YYYY-MM-DD';
                   label: string; amount: number }> }  // 首尾不完整周仍计入
```

**金额单位**: 所有 `amount` 字段为"分"(bigint signed,前端除以 100 显示)。`monthIncome` 为正数(server 端取 `SUM(amount) WHERE type='income'`);`monthExpense` 为正数(server 端取 `SUM(-amount) WHERE type='expense'` 或 `SUM(ABS(amount))`)。

---

### 2.3 DashboardReportQuery(新增 procedure)

**含义**: 报表页查询的输入。

| 字段 | 类型 | 约束 |
|---|---|---|
| `endYear` | `number | undefined` | 可选;缺省 = 当前 UTC 年 |
| `endMonth` | `1-12 | undefined` | 可选;缺省 = 当前 UTC 月 |

**校验**: 同 2.1。

---

### 2.4 DashboardReportResult

**含义**: `dashboard.report` 输出。

| 字段 | 类型 | 语义 |
|---|---|---|
| `endYearMonth` | `{ year, month }` | 目标月(实际查询的) |
| `monthlyTrend` | `Array<MonthlyTrendItem>(6 项,降序)` | 目标月往前 6 个月(含目标月) |
| `targetMonthCategoryBreakdown` | `Array<CategoryAmount>` | 目标月支出分类(全部分类,按金额降序) |

**`MonthlyTrendItem`**:
```ts
{ year: number; month: 1-12; label: string;  // '2026年7月'
  income: number; expense: number; net: number }  // 均为分
```

**`CategoryAmount`**: 复用 2.2 同名类型。

**边界**:
- 跨年:`monthlyTrend[5]` 可能是上一年的月份(如目标月 2026-02,首项是 2025-09)
- 无数据月:income/expense/net 全为 0,仍出现在 trend
- 分类百分比:基于 `targetMonthCategoryBreakdown` 的总支出计算,前端展示

---

### 2.5 UpdateNicknameInput(新增 mutation)

**含义**: `auth.updateNickname` mutation 的输入。

| 字段 | 类型 | 约束 |
|---|---|---|
| `displayName` | `string` | trim 后长度 1–30;不允许纯空白 |

**校验**(server 端 zod):
```ts
z.object({
  displayName: z.string().trim().min(1, '昵称不能为空').max(30, '昵称不超过 30 字符')
})
```

**幂等性**: 同一用户多次更新只覆盖 `displayName` 列,`updatedAt`(若 schema 加)刷新;不引入版本号。

---

### 2.6 UpdateNicknameResult

**含义**: `auth.updateNickname` 输出。

| 字段 | 类型 | 语义 |
|---|---|---|
| `member` | `{ id, displayName }` | 更新后的 member 子集 |

**注意**: 只返回 `member` 子集,不泄露 `userId` / `familyId` 等。客户端用它更新本地 `auth.me` 缓存。

---

### 2.7 ThemeToken(纯客户端实体)

**含义**: 奶油琥珀主题令牌(FR-A005)。

```ts
type ThemeToken = {
  background: '#F8F4EA';
  surface: '#FFFDF8';
  accent: '#C79032';
  accentHover: '#A97420';
  foreground: '#292721';
  muted: '#817B6D';
  darkSurface: '#22211E';
  income: '#3B9B74';
  expense: '#D76555';
};
```

**实现**: `src/lib/theme.ts` 导出常量;`globals.css` 同步落地 CSS 变量(`--background` 等);**两者 MUST 保持一致**(由单元测试 `tests/unit/theme.test.ts` 校验)。

---

### 2.8 PrivacyState(纯客户端实体)

**含义**: 隐私模式状态(localStorage 持久化)。

```ts
type PrivacyState = {
  enabled: boolean;
  localStorageKey: 'balthasar.privacy.enabled';  // 固定
  toggle(): void;       // 写 localStorage + 切 <html> class
  syncFromStorage(): void;  // 启动时读
};
```

**不变量**:
- `<html>` 的 `privacy-on` class 与 `localStorage[balthasar.privacy.enabled] === '1'` MUST 一致
- `data-amount` 元素在 `.privacy-on` 下 MUST 不可见(CSS 规则强制)

---

### 2.9 DateRangeUtility(纯函数实体)

**含义**: UTC 日期工具(R7)。

```ts
// 4 个函数签名,详见 research.md R7
getUtcMonthRange(year, month): { start: Date; end: Date }
getUtcWeeksInMonth(year, month): Array<{ start, end, label }>
padDailyBuckets(txs, start, end): Array<{ date, amount }>
getLast24Months(now?): Array<{ year, month, label }>
```

**纯函数**: 无副作用,无 IO,易测试。tasks 阶段先写测试(红)再实现(绿)。

---

## 3. 实体关系图(文字版)

```
DashboardSummaryQuery ──┐
                        ▼
            dashboard.summary procedure
                        │
                        ▼
              DashboardSummaryResult
              ├── CategoryAmount (×2, Top 支出)
              ├── SerializedTransaction (×4, 最新)
              └── DailyTrend | WeeklyTrend

DashboardReportQuery ───┐
                        ▼
            dashboard.report procedure
                        │
                        ▼
              DashboardReportResult
              ├── MonthlyTrendItem (×6, 趋势)
              └── CategoryAmount (×N, 目标月分类)

UpdateNicknameInput ────┐
                        ▼
            auth.updateNickname mutation
                        │
                        ▼
              UpdateNicknameResult (member 子集)

ThemeToken ──┐
            ├─→ globals.css (CSS 变量)
            └─→ lib/theme.ts (TS 常量)

PrivacyState ──→ localStorage
                + <html>.classList['privacy-on']
                + CSS 规则 (.privacy-on [data-amount])

DateRangeUtility ──→ 纯函数,被 procedure 与 UI 共用
```

---

## 4. 跨实体不变量

1. **金额单位一致**:所有 `amount` / `income` / `expense` / `net` 字段 MUST 为"分"(signed integer);前端展示除以 100。`monthlyTrend[].net` 可能为负(支大于收)。
2. **时区一致**:所有 `year` / `month` 解析基于 UTC;`occurredAt` 数据库列已是 `timestamp with time zone`,SQL 切分用 UTC 边界。
3. **familyId 隔离**:所有 procedure MUST 在 server 端从 `ctx.session.user.id` 解析 `familyId`,不接受客户端传入的 `familyId`。
4. **member 隔离**:`updateNickname` MUST 只更新当前会话用户对应的 `member`(`userId === ctx.session.user.id`),不允许跨 member 更新。
5. **ThemeToken 双写一致**:`globals.css` 与 `lib/theme.ts` 的令牌值 MUST 完全一致(单元测试 `tests/unit/theme.test.ts` 校验)。
6. **PrivacyState DOM 一致**:`<html>.classList` 与 `localStorage` MUST 同步(inline script + toggle 函数共同保证)。

## 5. 不引入的实体(YAGNI)

- ❌ 报表 bookmark / 保存查询(无用户需求)
- ❌ 隐私模式 per-page 配置(简单布尔足够)
- ❌ Theme 切换器(本期单一奶油琥珀,无切换)
- ❌ `theme_version` / `privacy_version` 版本号(未达迁移复杂度)
- ❌ `dashboard.report` 任意日期范围(固定近 6 月)
