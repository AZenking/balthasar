# Data Model: 001-auth-family (v2.0.0 T3 Stack)

**Date**: 2026-07-06
**Source**: [spec.md](./spec.md) + [plan.md](./plan.md) + [research.md](./research.md)

本文档定义后端持久化模型。表分两组:
1. **Better-Auth 自管表** (4 张) — schema 字段由 Better-Auth 决定,我们只声明用于 Drizzle 类型推断。
2. **业务表** (5 张) — 由我们设计,与 Better-Auth 解耦。

---

## 实体关系图 (ERD)

```text
┌──────────────────┐     ┌──────────────────┐
│  user (BA)       │     │  session (BA)    │
│  cuid2 PK        │◀────│  cuid2 PK        │
│  email           │ 1:N │  userId          │
│  passwordHash    │     │  token           │
│  ...             │     │  expiresAt       │
└──────┬───────────┘     │  ...             │
       │                 └──────────────────┘
       │
       │ 1:1 (业务层 owner 关系)
       │
       ▼
┌──────────────────┐     ┌──────────────────┐
│  family          │     │  member          │
│  uuid v7 PK      │◀────│  uuid v7 PK      │
│  ownerUserId     │ 1:1 │  familyId (FK)   │
│  name            │     │  userId          │
│  createdAt       │     │  displayName     │
└──────────────────┘     │  createdAt       │
                         └──────────────────┘

┌──────────────────┐     ┌────────────────────────────┐
│ auth_event       │     │ auth_failure_counter       │
│ (us, 自建)        │     │ (us, 自建)                  │
│ uuid v7 PK       │     │ email PK                   │
│ eventType        │     │ failedCount                │
│ email            │     │ lockedUntil                │
│ outcome          │     │ lastAttemptAt              │
│ occurredAt       │     └────────────────────────────┘
│ metadata (jsonb) │
└──────────────────┘     ┌────────────────────────────┐
                         │ registration_ip_counter    │
                         │ (Better-Auth rate-limit)    │
                         │ ipHourBucket PK            │
                         │ ip                         │
                         │ hourBucket                 │
                         │ count                      │
                         └────────────────────────────┘

Better-Auth 还自带:
- verification (邮箱验证 token, MVP 内可以不用但 schema 必须存在)
- account (OAuth account, MVP 内不用,schema 可留空)
```

---

## 表定义

### Better-Auth 自管表 (schema 1)

#### `users` — Better-Auth 用户表

Drizzle schema 路径: `src/server/db/schema/auth.ts`

> ⚠️ 字段定义需符合 Better-Auth 期望 (字段名、类型)。Better-Auth 提供官方 generator 命令 `npx @better-auth/cli@latest generate` 生成 schema。

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | text (cuid2) | PK | Better-Auth 生成 |
| `email` | text | NOT NULL, UNIQUE | Better-Auth 自动 trim + lower |
| `email_verified` | boolean | NOT NULL, default false | MVP 内不强制验证 |
| `name` | text | NOT NULL | Better-Auth 要求字段,我们填邮箱本地部分 |
| `image` | text | NULL | MVP 不用,允许 null |
| `created_at` | timestamptz | NOT NULL | Better-Auth 维护 |
| `updated_at` | timestamptz | NOT NULL | Better-Auth 维护 |

**业务关系**: 1 个 user (业务层) 对应 1 个 family 与 1 个 member (SC-005)。

#### `sessions` — Better-Auth 会话表

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | text (cuid2) | PK | |
| `user_id` | text | NOT NULL, FK → users.id | |
| `token` | text | NOT NULL, UNIQUE | opaque token,自动生成 |
| `expires_at` | timestamptz | NOT NULL | 创建时 = now + 30d |
| `ip_address` | text | NULL | Better-Auth 可填 |
| `user_agent` | text | NULL | Better-Auth 可填 |
| `created_at` | timestamptz | NOT NULL | |
| `updated_at` | timestamptz | NOT NULL | Better-Auth 维护 (滑动续期改 expires_at 时) |

**索引**: `idx_sessions_token (token)` —— cookie 凭证每次请求查询的热路径,MUST < 5ms。

**滑动续期**: Better-Auth 通过 `updateAge: '1d'` 配置实现"每天最多更新一次 expires_at",避免每次请求都写 DB。

#### `verifications` / `accounts` — Better-Auth 必需表 (MVP 不用)

Better-Auth schema 生成器会创建这两张表,即使 MVP 不使用 (邮箱验证、OAuth),也必须存在以避免 schema 校验失败。MVP 阶段保持空表。

---

### 业务表 (schema 2)

#### `families` — 记账聚合根

Drizzle schema 路径: `src/server/db/schema/family.ts`

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | uuid (v7) | PK | 应用层生成 |
| `owner_user_id` | text | NOT NULL, FK → users.id, ON DELETE CASCADE | cuid2 字符串,跨表引用 |
| `name` | text | NOT NULL, default '我的家庭' | MVP 固定,自定义 V2 |
| `created_at` | timestamptz | NOT NULL, default now() | UTC |

**索引**: `idx_families_owner (owner_user_id) UNIQUE` —— SC-005 强制 1:1。

**不变量**:
- 创建 User 时 MUST 同事务创建 1 个默认 Family (FR-004)。
- 一个 user 在 MVP 中严格对应 1 个 family (SC-005)。

#### `members` — 家庭下的成员

Drizzle schema 路径: `src/server/db/schema/member.ts`

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | uuid (v7) | PK | |
| `family_id` | uuid | NOT NULL, FK → families.id, ON DELETE CASCADE | |
| `user_id` | text | NOT NULL, FK → users.id, UNIQUE | cuid2;MVP 1:1 (user → member) |
| `display_name` | text | NOT NULL | MVP 默认取邮箱本地部分 |
| `created_at` | timestamptz | NOT NULL, default now() | |

**索引**: `idx_members_family_id (family_id)`, `idx_members_user_id (user_id) UNIQUE`。

**不变量**:
- 一个 family 在 MVP 内 MUST 有且仅有 1 个 member (SC-005)。

#### `auth_events` — 审计日志 (FR-016/017)

Drizzle schema 路径: `src/server/db/schema/auth-events.ts`

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | uuid (v7) | PK | |
| `event_type` | enum | NOT NULL | 值: `register_success` / `login_success` / `login_failure` / `lockout_triggered` / `logout` |
| `email` | text | NOT NULL | 规范化后;即使注册端点校验失败也存 |
| `outcome` | enum | NOT NULL | 值: `success` / `failure` |
| `occurred_at` | timestamptz | NOT NULL, default now() | UTC |
| `metadata` | jsonb | NOT NULL, default '{}' | 非敏感上下文;严禁 password / token / ip / ua |

**索引**:
- `idx_auth_events_email_time (email, occurred_at DESC)` — FR-017 查询热路径
- `idx_auth_events_type_time (event_type, occurred_at DESC)` — 运营报表

#### `auth_failure_counters` — 登录失败计数与锁定 (FR-009 自管)

Drizzle schema 路径: `src/server/db/schema/auth-failure-counters.ts`

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `email` | text | PK | 规范化后 |
| `failed_count` | int | NOT NULL, default 0 | |
| `locked_until` | timestamptz | NULL | NULL = 未锁定 |
| `last_attempt_at` | timestamptz | NOT NULL, default now() | |

**不变量**:
- 登录失败 → `failed_count += 1`,达 5 → 同时设 `locked_until = now + 5min` 并写一条 `lockout_triggered` 审计事件 (FR-009)。
- 登录成功 → 删除该行 (重置)。
- 锁定窗口内 → 返回 423 + 剩余时间 (FR-009 + Clarification Q4)。
- 锁定窗口结束 → `failed_count` 重置为 0,`locked_until = NULL`。

#### `registration_ip_counters` — 注册 IP 限流 (FR-018, 由 Better-Auth rate-limit 插件管理)

> ⚠️ 此表的实际 schema 由 Better-Auth `rate-limit` 插件决定,我们提供配置但**不**手动建表。下面描述概念结构,Better-Auth 会自动管理。

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `key` | text | PK | 形如 `register:ip:192.0.2.1:2026-07-06T14` |
| `count` | int | NOT NULL, default 0 | |
| `expires_at` | timestamptz | NOT NULL | TTL 索引自动清理 |

**配置** (在 `src/server/auth/config.ts`):
```typescript
rateLimit: {
  window: 3600,         // 1 小时
  max: 10,              // FR-018
  rules: {
    'sign-up-email': { window: 3600, max: 10 },
  },
}
```

---

## Drizzle schema 模板示例

`src/server/db/schema/family.ts`:

```typescript
import { pgTable, uuid, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const families = pgTable('families', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  ownerUserId: text('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('我的家庭'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ownerUniqueIdx: uniqueIndex('families_owner_user_id_unique_idx').on(t.ownerUserId),
}));
```

(Better-Auth 表用 `npx @better-auth/cli@latest generate` 生成,无需手写。)

---

## 不变量与约束总览

| 不变量 | 来源 | 验证方式 |
|---|---|---|
| User ↔ Family ↔ Member 严格 1:1:1 | SC-005 | 集成测试: 注册后查 3 表计数 |
| 注册 3 表写入原子 (含 Better-Auth user 行) | FR-004 | 集成测试: 注入中间失败,验证 0 残留 (含 user 行) |
| password hash 永不出现在响应/日志 | SC-004 | 集成测试 + 抓包断言 |
| session token 仅在 cookie 与 sessions.token 出现 | SC-004 | 集成测试 |
| 30 天滑动续期 (Better-Auth updateAge=1d) | FR-008, SC-009 | 集成测试 (使用 fake timer,验证 24h 内重复请求不写 DB) |
| 锁定窗口内拒绝 | FR-009 | 集成测试 (Better-Auth signIn.before hook 触发) |
| 注册 IP 限流 10/小时 | FR-018, SC-011 | 集成测试 (testcontainers 多请求) |
| 审计事件 5 类齐全 | FR-016 | 集成测试覆盖每类事件 (Better-Auth events hook 触发) |

---

## 下一阶段

- `contracts/README.md`: 说明 tRPC 契约由类型推断,无 REST 文档
- `quickstart.md`: 端到端验证脚本 (浏览器 + tRPC client)
- `tasks.md` (/speckit-tasks): 按 schema 与 router 落地任务清单
