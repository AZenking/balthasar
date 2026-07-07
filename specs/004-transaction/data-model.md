# Data Model: 004-transaction

**Date**: 2026-07-07
**Source**: [spec.md](./spec.md) + [plan.md](./plan.md) + [research.md](./research.md)

本 feature 新增 2 张表 + 复用 001/002/003 的 accounts/categories/families 作为外键引用。

---

## 实体关系图

```text
┌──────────────────┐
│  family (001)    │
│  uuid v7 PK      │
└────────┬─────────┘
         │ 1:N
         ▼
┌──────────────────┐         ┌────────────────────────────┐
│  transactions    │ 1:N     │   transaction_events       │
│  ─────────────   │◀────────│   ────────────────         │
│  id (uuid v7)    │         │   id (uuid v7)             │
│  familyId (FK)   │         │   eventType (enum)         │
│  type (enum)     │         │   transactionId (FK)       │
│  accountId (FK)  │         │   actorMemberId (FK→mem)   │
│  categoryId (FK) │         │   before (jsonb)           │
│  amount (bigint  │         │   after (jsonb)            │
│   signed)        │         │   occurredAt               │
│  remark          │         └────────────────────────────┘
│  occurredAt      │
│  createdAt       │     ←── FK ──→ accounts (002)
│  updatedAt       │     ←── FK ──→ categories (003)
└──────────────────┘
```

---

## 表定义

### `transactions` — 交易实体

Drizzle schema 路径: `src/server/db/schema/transaction.ts`

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | uuid (v7) | PK | 应用层生成 |
| `family_id` | uuid | NOT NULL, FK → families.id, ON DELETE CASCADE | 服务端派生 (FR-007) |
| `type` | `transaction_type` enum | NOT NULL | pgEnum,值 `income` / `expense` |
| `account_id` | uuid | NOT NULL, FK → accounts.id, ON DELETE RESTRICT | RESTRICT 防止账户硬删除丢交易 (本 MVP 不允许账户硬删除,但 RESTRICT 兜底) |
| `category_id` | uuid | NOT NULL, FK → categories.id, ON DELETE RESTRICT | 同上 |
| `amount` | bigint | NOT NULL | **signed** (Clarification Q1): income 正、expense 负;`Math.abs()` 展示 |
| `remark` | text | NOT NULL, default '' | 1-200 字符,允许空 |
| `occurred_at` | timestamptz | NOT NULL | UTC 存储 (Clarification Q2),≤ now + 1 day |
| `created_at` | timestamptz | NOT NULL, default now() | |
| `updated_at` | timestamptz | NOT NULL, default now() + `.$onUpdate(() => new Date())` | LWW (Clarification Q3) |

**索引**:
- `idx_transactions_family_occurred (family_id, occurred_at DESC)` —— 支撑 list 查询 (FR-010,按时间倒序)
- `idx_transactions_family_type (family_id, type)` —— 支撑 dashboard 按 type 聚合 (后续 006)
- `idx_transactions_family_account (family_id, account_id)` —— 支撑按账户筛选 (后续 005)
- `idx_transactions_family_category (family_id, category_id)` —— 支撑按分类筛选 (后续 005/006)

**不变量**:
- `family_id` 服务端派生 (FR-007),客户端 input 不接受
- `amount` signed: type=expense 时 DB 中为负;type=income 时为正
- `account_id` 必须属于 `family_id` 同家庭,且 `archived_at IS NULL` (FR-005)
- `category_id` 必须存在,且 `categories.type === transactions.type` (FR-006)
- 硬删除允许 (FR-013),不软删除

---

### `transaction_events` — 审计日志

Drizzle schema 路径: `src/server/db/schema/transaction-events.ts`

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | uuid (v7) | PK | |
| `event_type` | enum | NOT NULL | 值: `transaction_created` / `transaction_edited` / `transaction_deleted` |
| `transaction_id` | uuid | NOT NULL, FK → transactions.id, **ON DELETE SET NULL** | 删除交易时审计行保留 (transaction_id 置 null),支持 transaction_deleted 审计追溯 (FR-016,F1 修复) |
| `actor_member_id` | uuid | NOT NULL, FK → members.id, ON DELETE CASCADE | |
| `before` | jsonb | NULL | 编辑前可变字段快照 (edited) / 被删行快照 (deleted);create 时 null |
| `after` | jsonb | NULL | 编辑后可变字段快照 (created/edited);deleted 时 null |
| `occurred_at` | timestamptz | NOT NULL, default now() | |

**索引**:
- `idx_transaction_events_tx_time (transaction_id, occurred_at DESC)` —— 按交易查变更历史 (V2)

**审计写入约束 (与 001/002 SC-004 一致)**:
- `before` / `after` jsonb 仅放可变字段 (`type`、`accountId`、`categoryId`、`amount`、`remark`、`occurredAt`),**严禁** password / token / sessionToken / ip / ua
- 应用层 `writeTransactionEvent` 函数做 `redactSensitiveKeys` 防御 (复用 001/002 模式)
- 审计写入与业务写入在同一 `db.transaction` 内 (research.md Q1 + 002-account 同模式)

---

## Drizzle schema 模板

`src/server/db/schema/transaction.ts`:

```typescript
import { pgTable, uuid, text, bigint, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { family } from "./family";
import { account } from "./account";
import { category } from "./category";
import { uuidv7 } from "uuidv7";

export const transactionType = pgEnum("transaction_type", ["income", "expense"]);

export const transaction = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    familyId: uuid("family_id").notNull().references(() => family.id, { onDelete: "cascade" }),
    type: transactionType("type").notNull(),
    accountId: uuid("account_id").notNull().references(() => account.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id").notNull().references(() => category.id, { onDelete: "restrict" }),
    amount: bigint("amount", { mode: "number" }).notNull(), // signed (income +, expense -)
    remark: text("remark").notNull().default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    familyOccurredIdx: index("transactions_family_occurred_idx").on(t.familyId, t.occurredAt),
    familyTypeIdx: index("transactions_family_type_idx").on(t.familyId, t.type),
    familyAccountIdx: index("transactions_family_account_idx").on(t.familyId, t.accountId),
    familyCategoryIdx: index("transactions_family_category_idx").on(t.familyId, t.categoryId),
  })
);

export type Transaction = typeof transaction.$inferSelect;
export type TransactionType = (typeof transactionType.enumValues)[number];
```

---

## 不变量与约束总览

| 不变量 | 来源 | 验证方式 |
|---|---|---|
| `family_id` 服务端派生 | FR-007 | 集成测试: create input 无 familyId,DB 行 familyId 正确 |
| `amount` signed | Q1 | 集成测试: type=expense 时 DB amount < 0;type=income 时 > 0 |
| `amount` 服务端按 type 加符号 | FR-004 | 集成测试: 前端传正数,DB 中 type=expense 行 amount 为负 |
| 跨家庭 account → 400 | FR-015 | 集成测试: account 属于其他家庭,create → BAD_REQUEST |
| 跨家庭 transaction → 404 | FR-014 | 集成测试: 用户 B 调用户 A 的 transaction.get → NOT_FOUND |
| type 与 categoryId 匹配 | FR-006 | 集成测试: type=expense + income categoryId → BAD_REQUEST |
| 已归档账户不可用 | FR-005 | 集成测试: archivedAt IS NOT NULL → BAD_REQUEST |
| occurredAt UTC + ≤ now+1d | FR-008 | 集成测试: 未来日期 → BAD_REQUEST |
| 硬删除 → DB 行消失 | FR-013 | 集成测试: delete 后 SELECT 0 行 |
| 审计 jsonb 无敏感字段 | SC-007 | 集成测试: grep password/token 在 before/after jsonb |
| updatedAt 自动更新 (LWW) | SC-005 | 集成测试: update 后 updatedAt > 原 createdAt |

---

## 下一阶段

- `contracts/README.md`: 5 个 procedure 入口 (create/get/list/update/delete)
- `quickstart.md`: 端到端验证脚本 (含 type/category 匹配 + 跨家庭)
- `tasks.md` (/speckit-tasks): 按本 schema 与 router 落地任务清单
