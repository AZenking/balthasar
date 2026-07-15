# DATABASE

## Tables

### 业务表

Family (001)
Member (001)
Account (002) — 家庭级账户,招商银行卡 / 现金等
Category (003) — 内置分类字典,22 条种子 (12 支出 + 8 收入),UUID v5 确定性 ID
Transaction (004) — 交易记录 (signed bigint amount, 硬删除)

### 认证表 (Better-Auth 自管,001 Phase 2)

User
Session
Verification
Account (Better-Auth 内部表,与业务 accounts 不同名)

### 安全审计表 (业务自管)

AuthEvent (001) — 认证事件
AuthFailureCounter (001) — 登录失败计数
AccountEvent (002) — 账户操作审计
TransactionEvent (004) — 交易操作审计 (FK SET NULL,删除后审计保留)
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
- `0003_categories.sql` —— 003-category 追加 categories 表 + 22 条种子
- `0004_transactions.sql` —— 004-transaction 追加 transactions (signed bigint) + transaction_events (FK SET NULL)
- `0005_api_keys.sql` —— 011-open-api 追加 api_keys 表
- `0006_category_v15_extensions.sql` —— 018-custom-category: ALTER
  categories 加 4 字段 (family_id/parent_id/archived_at/updated_at) +
  2 索引 + 新建 category_events 审计表 + 003 内置 updated_at 回填
- `0006_slim_madripoor.sql` —— 027-mobile-home-revamp US4:增量迁移
  transactions.type 枚举增 `transfer` + 新增 `to_account_id` 列(FK accounts,
  RESTRICT);seed 系统内置"转账"分类(id=6206a8ba-...,type=expense,M3 决策)。
- `0007_wandering_fixer.sql` —— 027-mobile-home-revamp US5:新建 `budgets` 表
  (family_id/year/month/amount)+ UNIQUE(family_id,year,month) + FK families。
- 通过 `pnpm db:generate` (drizzle-kit) 生成,`pnpm db:migrate` 应用
- 集成测试自动通过 `drizzle-orm/node-postgres/migrator` 应用最新迁移

### 索引

- `accounts_family_active_idx` —— partial index `WHERE archived_at IS NULL`,
  支撑 list 默认查询热路径 (002 SC-002 P95 < 200ms)
- `accounts_family_idx` —— 完整索引,支撑 includeArchived=true 查询
- `account_events_account_time_idx` —— `(account_id, occurred_at)`,
  按账户查变更历史 (V2 暴露查询接口)
- `categories_type_sort_name_idx` —— 003 保留,`(type, sort_order, name)`
- `categories_name_type_unique_idx` —— 003 保留,防 seed 重复插入
- `categories_family_type_parent_sort_idx` —— 018 新增,层级 list 主索引
  `(family_id, type, parent_id, sort_order, created_at)`,支撑 018 SC-003
  P95 < 150ms
- `categories_family_type_parent_name_unique_idx` —— 018 新增,family-scoped
  唯一性表达式索引 (COALESCE NULL→sentinel + LOWER(name) 大小写不敏感),
  防 same family+type+parent 下重名
- `category_events_cat_time_idx` —— 018 新增,`(category_id, occurred_at)`,
  按分类查审计历史

### 018 关键约束 (procedure 层强制,DB 不强制因跨行/复杂语义)

- 内置分类 (isBuiltIn=true) 不可写 (403)
- 自定义分类 family_id NOT NULL (procedure 强制)
- 二级深度上限 2 层 (parent 必须是顶级)
- 子 type MUST 等于父 type
- 已归档分类仅可改 name/icon/sortOrder (不可改 type/parentId)
- 已被交易引用 OR 有子分类的分类不可切换 type
- 200 个/家庭硬上限 (advisory lock 防 race)
- 归档父级联子;反归档父强制复活所有子
