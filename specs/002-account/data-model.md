# Data Model: 002-account

**Date**: 2026-07-06
**Source**: [spec.md](./spec.md) + [plan.md](./plan.md) + [research.md](./research.md)

本 feature 新增 2 张表,与 001 的 8 张表共存。复用 001 的 Better-Auth `user` / `session` 与业务 `families` / `members` 表作为外键引用。

---

## 实体关系图 (新增部分)

```text
┌──────────────────┐
│  family (001)    │
│  uuid v7 PK      │
└────────┬─────────┘
         │ 1:N (一个家庭可有多个账户)
         ▼
┌──────────────────┐         ┌────────────────────────────┐
│   accounts       │ 1:N     │     account_events         │
│   uuid v7 PK     │◀────────│     uuid v7 PK             │
│   familyId (FK)  │         │     eventType (enum)       │
│   name           │         │     accountId (FK)         │
│   currency       │         │     actorMemberId (FK→mem) │
│   initialBalance │         │     before (jsonb)         │
│   archivedAt NULL│         │     after (jsonb)          │
│   createdAt      │         │     occurredAt             │
│   updatedAt      │         └────────────────────────────┘
└──────────────────┘
```

---

## 表定义

### `accounts` — 账户实体

Drizzle schema 路径: `src/server/db/schema/account.ts`

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | uuid (v7) | PK | 应用层生成 |
| `family_id` | uuid | NOT NULL, FK → families.id, ON DELETE CASCADE | |
| `name` | text | NOT NULL, length 1-50 (应用层 zod 强制) | 允许重名 |
| `currency` | text | NOT NULL, ISO 4217 三字母代码大写 (应用层 enum 校验) | text 而非 pgEnum,research.md Q1 |
| `initial_balance` | bigint | NOT NULL, default 0 | 单位"分",research.md Q5;允许负数 |
| `archived_at` | timestamptz | NULL | NULL = 未归档,research.md Q2 |
| `created_at` | timestamptz | NOT NULL, default now() | |
| `updated_at` | timestamptz | NOT NULL, default now() + `.$onUpdate(() => new Date())` | Drizzle 应用层维护 (research.md / 001 Q11) |

**索引**:
- `idx_accounts_family_active (family_id, archived_at) WHERE archived_at IS NULL` — partial index,支撑默认列表查询热路径 (FR-007 / SC-002)
- `idx_accounts_family (family_id)` — 支撑 `includeArchived=true` 完整列表

**不变量**:
- `family_id` 服务端派生 (FR-006),客户端 input schema 不含此字段
- `initial_balance` 一旦写入不可修改 (FR-009 + SC-007),`update` procedure 不接受此字段
- `archived_at IS NOT NULL` 时,该账户不可编辑 (FR-011)
- 删除账户只能通过归档 (软删除),无硬删除路径 (FR-013)

---

### `account_events` — 账户操作审计日志 (Clarification Q1)

Drizzle schema 路径: `src/server/db/schema/account-events.ts`

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | uuid (v7) | PK | |
| `event_type` | enum | NOT NULL | 值: `account_created` / `account_edited` / `account_archived` / `account_unarchived` |
| `account_id` | uuid | NOT NULL, FK → accounts.id, ON DELETE CASCADE | |
| `actor_member_id` | uuid | NOT NULL, FK → members.id, ON DELETE CASCADE | 哪个家庭成员发起的操作 |
| `before` | jsonb | NULL | 编辑前的可变字段快照 (创建/归档时为 NULL) |
| `after` | jsonb | NULL | 编辑后的可变字段快照 |
| `occurred_at` | timestamptz | NOT NULL, default now() | |

**索引**:
- `idx_account_events_account_time (account_id, occurred_at DESC)` — 按账户查变更历史 (本 feature 暂不暴露查询接口,V2 用)

**审计写入约束 (与 001 SC-004 一致)**:
- `before` / `after` jsonb 仅放可变字段 (`name`、`currency`),**严禁**包含 `password`、`token`、`sessionToken`、`ip`、`ua` 等敏感字段
- 应用层在 `writeAccountEvent` 函数中做 `redactSensitiveKeys` 防御 (复用 001 的模式)
- 审计写入与业务写入在同一 `db.transaction` 内 (research.md Q6)

---

## Drizzle schema 模板

`src/server/db/schema/account.ts`:

```typescript
import { pgTable, uuid, text, bigint, timestamp, index } from "drizzle-orm/pg-core";
import { family } from "./family";
import { uuidv7 } from "uuidv7";

export const account = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    familyId: uuid("family_id").notNull().references(() => family.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    currency: text("currency").notNull(),
    initialBalance: bigint("initial_balance", { mode: "number" }).notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    familyActiveIdx: index("accounts_family_active_idx")
      .on(t.familyId, t.archivedAt)
      .where(sql`${t.archivedAt} IS NULL`),
    familyIdx: index("accounts_family_idx").on(t.familyId),
  })
);

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
```

`src/server/db/schema/account-events.ts`:

```typescript
import { pgTable, uuid, text, jsonb, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { account } from "./account";
import { member } from "./member";
import { uuidv7 } from "uuidv7";

export const accountEventType = pgEnum("account_event_type", [
  "account_created",
  "account_edited",
  "account_archived",
  "account_unarchived",
]);

export const accountEvent = pgTable(
  "account_events",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    eventType: accountEventType("event_type").notNull(),
    accountId: uuid("account_id").notNull().references(() => account.id, { onDelete: "cascade" }),
    actorMemberId: uuid("actor_member_id").notNull().references(() => member.id, { onDelete: "cascade" }),
    before: jsonb("before"),
    after: jsonb("after"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountTimeIdx: index("account_events_account_time_idx").on(t.accountId, t.occurredAt),
  })
);

export type AccountEvent = typeof accountEvent.$inferSelect;
export type AccountEventType = (typeof accountEventType.enumValues)[number];
```

---

## 不变量与约束总览

| 不变量 | 来源 | 验证方式 |
|---|---|---|
| `familyId` 服务端派生 | FR-006 | 集成测试: create 请求 body 不含 familyId,但写入的行 familyId = 当前用户家庭 |
| 跨家庭访问 404 | FR-012, SC-003 | 集成测试: 用户 A 创建账户,用户 B 调 `account.update` / `account.archive` 应得 NOT_FOUND |
| 初始余额不可修改 | FR-009, SC-007 | 集成测试: update 请求带 initialBalance → 字段被忽略或 400;DB 中 initialBalance 不变 |
| 已归档账户不可编辑 | FR-011 | 集成测试: 归档后调 update → 400/409 |
| 归档/取消归档幂等 | SC-004 | 集成测试: 已归档再归档 → 200 + 状态不变;未归档取消归档 → 200 + 状态不变 |
| 审计写入原子 | research.md Q6 | 集成测试: 注入 audit 写入失败 → 整个 procedure 回滚,业务不变 |
| 审计 jsonb 无敏感字段 | SC-004 同源 | 单元测试: writeAccountEvent 传入 metadata 含 password → 被剥离 |

---

## 与 001 schema 的衔接

- **复用** `families` (family 聚合根) 和 `members` (家庭成员) 作为外键
- **不动** 001 的 8 张表 schema
- **新增迁移** `0002_accounts.sql`,只 CREATE 新表与新索引
- **运行 `pnpm db:migrate`** 应用,无需重建 001 数据

---

## 下一阶段

- `contracts/README.md`: tRPC 5 个 procedure 的入口说明 (类型推断)
- `quickstart.md`: 端到端验证脚本 (含 SC-002 性能、SC-003 隔离、SC-004 幂等)
- `tasks.md` (/speckit-tasks): 按本 schema 与 router 落地任务清单
