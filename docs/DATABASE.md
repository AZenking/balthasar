# DATABASE

## Tables

### 业务表

Family (001)
Member (001)
Account (002) — 家庭级账户,招商银行卡 / 现金等
Category (后续 feature)
Transaction (后续 feature)

### 认证表 (Better-Auth 自管,001 Phase 2)

User
Session
Verification
Account (Better-Auth 内部表,与业务 accounts 不同名)

### 安全审计表 (业务自管)

AuthEvent (001) — 认证事件
AuthFailureCounter (001) — 登录失败计数
AccountEvent (002) — 账户操作审计
RegistrationIpCounter (Better-Auth rate-limit 内部表)

## 后续

Category
Asset
Debt
Budget
Investment

## 详细 schema

各 feature schema 见对应 `specs/<NNN>-<feature>/data-model.md`,Drizzle
定义统一在 `src/server/db/schema/*.ts`。

### 关键不变量

- `User ↔ Family ↔ Member` 严格 1:1:1 (001 SC-005),由
  `families.owner_user_id` 与 `members.user_id` 上的 UNIQUE 约束强制。
- `auth_events.metadata` 严禁包含 password / token / ip / ua 字段
  (001 FR-016 / SC-004),由 `audit.hook.ts` 的 `redactSensitiveKeys` 兜底。
- `auth_failure_counters` 5 次失败 → 锁定 5 分钟 (001 FR-009),由
  `lockout-policy.ts` 纯函数决策。
- `accounts.family_id` 服务端派生 (002 FR-006),客户端 input 不接受
  familyId 字段,跨家庭访问统一返回 NOT_FOUND (002 SC-003)。
- `accounts.archived_at` NULL = 未归档;归档账户不可编辑 (002 FR-011),
  不可硬删除 (002 FR-013),仅可通过 archive/unarchive 软删除。
- `account_events.before` / `.after` jsonb 仅含可变字段 (name, currency),
  严禁含 password / token / initialBalance 等敏感或只读字段 (002 SC-004)。

### 迁移

- `0001_init.sql` —— 001-auth-family 初始 schema (8 张表)
- `0002_accounts.sql` —— 002-account 追加 accounts + account_events + 索引
- 通过 `pnpm db:generate` (drizzle-kit) 生成,`pnpm db:migrate` 应用
- 集成测试自动通过 `drizzle-orm/node-postgres/migrator` 应用最新迁移

### 索引

- `accounts_family_active_idx` —— partial index `WHERE archived_at IS NULL`,
  支撑 list 默认查询热路径 (002 SC-002 P95 < 200ms)
- `accounts_family_idx` —— 完整索引,支撑 includeArchived=true 查询
- `account_events_account_time_idx` —— `(account_id, occurred_at)`,
  按账户查变更历史 (V2 暴露查询接口)
