# Phase 1 Data Model: 手机端首页及相关页面重做

**Feature**: 027-mobile-home-revamp | **Date**: 2026-07-14

本 spec **引入数据库 schema 变更**(与 026 零迁移不同):3 类 Drizzle migration。同时定义应用层契约实体(工作流层抽象,供 contracts 引用)。

> 宪章三:`Family` 是唯一聚合根。新增 `Budget` 与扩展的 `Account.type`、`Transaction.transfer` 均在 `Family` 聚合内,通过 `familyId` 引用,不变量在 tRPC procedure server 端强制。`Investment` 表仍属范围外(US1 修订后)。

---

## 1. 数据库 schema 变更(3 类 migration)

### 1.1 `transactions` 表 — 扩展 transfer 类型 + toAccountId 列

```ts
// src/server/db/schema/transaction.ts
export const transactionType = pgEnum("transaction_type", [
  "income",
  "expense",
  "transfer",   // 新增
]);

export const transaction = pgTable("transactions", {
  // ... 现有字段不变 ...
  toAccountId: uuid("to_account_id").references(() => account.id, {
    onDelete: "restrict",
  }), // 新增;NULLABLE。type='transfer' 时 NOT NULL(procedure 强不变量),其它类型 NULL
  // ... 其余不变 ...
});
```

**金额符号语义**(research R1/R9 定):
| type | amount 符号 | 备注 |
|---|---|---|
| `income` | 正 | 现有不变 |
| `expense` | 负(普通支出)/ 正(退款,反向支出) | 退款 = type='expense' + 正 amount(clarify Q1) |
| `transfer` | 正(原始金额) | 不参与收支聚合;余额计算时转出账户减、转入账户(toAccountId)加 |

**新索引**:无新增(现有 `(family_id, occurred_at)` / `(family_id, type)` 覆盖 transfer 查询)。

**Migration**:`ALTER TYPE transaction_type ADD VALUE 'transfer'` + `ALTER TABLE transactions ADD COLUMN to_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT`。

**Down 路径**:`ALTER TABLE transactions DROP COLUMN to_account_id` + `DELETE FROM transactions WHERE type='transfer'` + `ALTER TYPE transaction_type REMOVE VALUE 'transfer'`(注:PG 不支持直接 REMOVE VALUE,down 需重建枚举,见 tasks 阶段)。

**强不变量**(procedure 层强制,非 DB 约束):
- `type='transfer'` → `toAccountId IS NOT NULL` 且 `toAccountId !== accountId`(拒绝自转,FR-014)
- `type IN ('income','expense')` → `toAccountId IS NULL`
- `type='transfer'` → `categoryId` = 系统内置"转账"分类 id(见下,M3 决策)

**系统内置"转账"分类(M3 决策,向后兼容)**:`transactions.categoryId` 保持 NOT NULL(026 现有约束不变)。新增一个系统内置 category(name="转账", type 不可用于 income/expense 创建,仅 transfer 强制引用),由 migration/seed 写入。transfer 创建时 procedure 强制 `categoryId = 该内置 id`(忽略客户端传入)。理由:避免改 categoryId 为 NULLABLE 的大迁移风险(影响所有现有 `WHERE categoryId`/JOIN 查询),NOT NULL 不变 = 向后兼容。

---

### 1.2 `accounts` 表 — 新增 type 列(asset/debt)

```ts
// src/server/db/schema/account.ts
export const accountType = pgEnum("account_type", ["asset", "debt"]);

export const account = pgTable("accounts", {
  // ... 现有字段不变 ...
  type: accountType("type").notNull().default("asset"), // 新增;向后兼容存量数据全为 asset
  // ... 其余不变 ...
});
```

**Migration**:`CREATE TYPE account_type AS ENUM ('asset','debt')` + `ALTER TABLE accounts ADD COLUMN type account_type NOT NULL DEFAULT 'asset'`。

**Down 路径**:`ALTER TABLE accounts DROP COLUMN type` + `DROP TYPE account_type`。

**语义**:
- `asset`(资产,默认):银行卡/现金/支付宝等,余额通常 ≥ 0
- `debt`(负债):信用卡/贷款,余额可正可负(展示时负债取 ABS)

**余额计算**(research R5):
```
account.balance = initialBalance
  + SUM(income/expense amount WHERE accountId = 该账户)    -- income + / expense ±
  - SUM(transfer amount WHERE accountId = 该账户)          -- 转出减
  + SUM(transfer amount WHERE toAccountId = 该账户)        -- 转入加
```

---

### 1.3 `budgets` 表 — 新增(月预算)

```ts
// src/server/db/schema/budget.ts(新文件)
import { pgTable, uuid, bigint, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { family } from "./family";
import { uuidv7 } from "uuidv7";

export const budget = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),    // YYYY, 2020+
    month: integer("month").notNull(),  // 1-12
    amount: bigint("amount", { mode: "number" }).notNull(), // 分,正数
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    // (family_id, year, month) 唯一 —— 一个家庭一个月份只有一条预算(clarify Q3)
    familyYearMonthUniq: uniqueIndex("budgets_family_year_month_uniq").on(
      t.familyId, t.year, t.month
    ),
  })
);

export type Budget = typeof budget.$inferSelect;
export type NewBudget = typeof budget.$inferInsert;
```

**Migration**:`CREATE TABLE budgets (...)` + `CREATE UNIQUE INDEX budgets_family_year_month_uniq ON budgets(family_id, year, month)`。

**Down 路径**:`DROP TABLE budgets`。

**约束**:
- `(familyId, year, month)` 唯一(UNIQUE INDEX)
- `amount > 0`(procedure 层校验,DB 层可加 CHECK)
- 仅月预算,无年预算(clarify Q3;统计页"年"周期不消费此表)

---

## 2. 应用层契约实体(工作流层抽象)

### 2.1 DashboardSummaryQuery(扩展自 026)

**含义**: 首页汇总查询输入契约。

| 字段 | 类型 | 约束 |
|---|---|---|
| `year` | `number | undefined` | 可选;缺省 = 当前 UTC 年 |
| `month` | `1-12 | undefined` | 可选;缺省 = 当前 UTC 月 |

**校验**:同 026(`year ∈ [2020, 当前年]`、`month ∈ 1-12`)。

---

### 2.2 DashboardSummaryResult(扩展)

**含义**: `dashboard.summary` 输出。在 026 基础上新增 `budget` / `assets` / 扩展 `expenseTrend`(本月每日 + 上月同期)。

| 字段 | 类型 | 语义 | 变化 |
|---|---|---|---|
| `queriedYearMonth` | `{ year; month }` | 实际查询年月 | 026 不变 |
| `monthExpense` | `number` | 本月支出(分,正数) | **改 SQL**:type-driven 聚合(research R9),含退款 |
| `monthIncome` | `number` | 本月收入(分,正数) | **改 SQL**:type-driven,排除 transfer |
| `monthNet` | `number` | `monthIncome - monthExpense` | 不变 |
| `topExpenseCategories` | `Array(前 4)` | 支出 Top **4** 分类 | **026 是 Top 2,扩为 4**(spec FR-004) |
| `recentTransactions` | `Array(最新 5)` | 全局最新,不受月份影响 | **026 是 4 条,扩为 3-5**(spec FR-006;固定 5) |
| `expenseTrend` | `ExpenseTrend` | 见 2.3 | **重做**:本月每日 + 上月同期(research R6) |
| `budget` | `BudgetSummary | null` | 预算四态;null = 加载失败降级 | **新增**(research R2/R4) |
| `assets` | `AssetsSummary | null` | 资产三项;null = 加载失败降级 | **新增**(research R2/R5) |

---

### 2.3 ExpenseTrend(重做)

```ts
type ExpenseTrend = {
  granularity: "daily";
  current: Array<{ date: "YYYY-MM-DD"; amount: number }>;   // 本月每日(补零至今天)
  previous: Array<{ date: "YYYY-MM-DD"; amount: number }>;  // 上月同长度对齐
  comparisonPercent: number | null;  // 本月合计 vs 上月合计;null=上月无数据
};
```

历史月保持 weekly(026 逻辑):
```ts
| { granularity: "weekly"; buckets: Array<{ startDate; endDate; label; amount }> }
```

---

### 2.4 BudgetSummary(新增)

```ts
type BudgetSummary =
  | { status: "unset" }                                      // 未设置预算
  | { status: "normal" | "warning"; usagePercent: number; remaining: number }
  | { status: "overspent"; usagePercent: number; overspendAmount: number };

// 由 computeBudgetStatus(monthExpense, budget.amount) 计算(research R4)
// usagePercent: 0-100+, 一位小数
// remaining / overspendAmount: 分, 正数
```

---

### 2.5 AssetsSummary(新增)

```ts
type AssetsSummary = {
  totalAssets: number;       // asset 账户余额和(分)
  totalLiabilities: number;  // debt 账户 ABS(余额)和(分,正数)
  netAssets: number;         // totalAssets - totalLiabilities
};
```

---

### 2.6 TransactionCreateInput(扩展 — transfer 模式)

```ts
type TransactionCreateInput =
  | { type: "income" | "expense"; accountId; categoryId; amount; remark?; occurredAt? }  // 026 现有
  | {
      type: "transfer";       // 新增
      accountId;              // 转出账户
      toAccountId;            // 转入账户(MUST !== accountId)
      amount;                 // 正数
      remark?; occurredAt?;
      // transfer 无需客户端传 categoryId —— procedure 强制用系统内置"转账"分类 id(M3 决策,见 §1.1)
    };
```

**强不变量**(procedure 强制):
- `type='transfer'` → `toAccountId` 必填且 `!== accountId`
- `type='transfer'` → amount 存正数(不应用 applySign 符号)
- `type IN ('income','expense')` → `toAccountId` 必须 absent/undefined

---

### 2.7 AccountCreateInput(扩展 — type 字段)

```ts
type AccountCreateInput = {
  name: string;            // 1-50 字符(026 现有)
  currency: string;        // 026 现有
  initialBalance?: number; // 026 现有,默认 0
  type?: "asset" | "debt"; // 新增;默认 "asset"
};
```

---

## 3. 领域纯函数(新增/扩展)

### 3.1 `computeBudgetStatus`(新增,`src/server/domain/dashboard/budget-status.ts`)

见 research R4。输入 `(usedAmount, budgetAmount | null)` → `BudgetSummary`。纯函数,无 IO。

**单测边界**:unset(null/0)、normal(50%)、warning(79.9%→normal / 80%→warning / 99.9%→warning)、overspent(100%→overspent / 120%→overspent)。

### 3.2 `applySign`(扩展,`src/server/domain/transaction/validate.ts`)

```ts
export function applySign(type: TransactionType, amount: number): number {
  if (amount === 0) return 0;
  if (type === "transfer") return Math.abs(amount);  // 新增:transfer 存正数
  return type === "expense" ? -Math.abs(amount) : Math.abs(amount);
}
```

> **退款不经过 applySign**:applySign 函数本身不改(对 expense 返回 -abs)。退款(`type='expense'` + `isRefund: true`)由 **procedure 层**特殊处理 —— 直接存 +abs(amount),跳过 applySign 调用。详见 contracts/transaction-create.md §Business Rule 3。聚合(`SUM(CASE WHEN type='expense' THEN ABS(amount) END)`)对普通支出(-x)与退款(+x)统一取 ABS,同分类相加后净额正确下降。

### 3.3 `validateTransfer`(新增)

```ts
export function validateTransfer(accountId: string, toAccountId: string): {
  ok: boolean;
  reason?: "same_account";
} {
  return accountId === toAccountId
    ? { ok: false, reason: "same_account" }
    : { ok: true };
}
```

---

## 4. 生命周期 / 状态转移

### 4.1 Transaction.type 转移

- 创建时定 type,后续 update 可改 type(026 已支持),但 **transfer ↔ income/expense 切换需清空/要求 toAccountId**(procedure 强不变量)。
- 删除:hard delete(026 不变);transfer 删除时两账户余额自动回滚(因余额是查询时聚合,删行即回滚)。

### 4.2 Budget 生命周期

- upsert:`dashboard.budget.set(familyId, year, month, amount)` —— 存在则 UPDATE,不存在则 INSERT(依赖 UNIQUE 索引)。
- 无归档/软删除:预算要么有要么无(`unset` 态),删除 = `dashboard.budget.delete(familyId, year, month)`。

### 4.3 Account.type 生命周期

- 创建时定 type(asset/debt),update 可改(信用卡还清后从 debt 改 asset 的场景)。
- 不影响余额计算(余额公式对两种 type 通用,type 只影响资产聚合分组)。
