# DOMAIN

## 聚合

Family (聚合根,001-auth-family)
├── Member
├── Account (002-account)
├── Transaction (后续 feature,引用 Account + Category)
└── (Category 是独立聚合,不归 Family,见下)

Category (独立聚合,003-category) — 内置分类字典,所有家庭共享

## 跨聚合引用

Better-Auth 的 `User` 与业务聚合 `Family` 解耦:
- `Family.ownerUserId` 引用 `User.id` (cuid2 字符串)
- 反向不持有指针 (聚合根不持有外部身份实体)

## Account (002-account)

- id (UUID v7)
- familyId (跨聚合引用 Family)
- name (1-50 UTF-16 code unit)
- currency (ISO 4217,9 种白名单)
- initialBalance (bigint,单位"分",允许负数,**创建后只读**)
- archivedAt (timestamp NULL,归档时间戳)
- createdAt / updatedAt (Drizzle $onUpdate 自动维护)

## 关键不变量

- 1 User ⇄ 1 Family ⇄ 1 Member (SC-005,MVP)
- 注册时单事务原子写 User + Family + Member (FR-004)
- 跨聚合引用必须用 ID,禁止对象指针 (Constitution v2.0.0 Principle III)
- Account.familyId 服务端派生,客户端不可设置 (002 FR-006)
- Account.initialBalance 创建后只读 (002 SC-007)
- Account.archivedAt IS NOT NULL 时不可编辑 (002 FR-011)
- AccountEvents 是 Account 聚合的审计日志,与 AuthEvents 解耦 (002 Q1)

## Transaction

- id
- type(income|expense|transfer) — 027: 新增 transfer
- amount(signed: income +, expense −, transfer +正数)
- accountId
- toAccountId — 027: transfer 时为转入账户;income/expense 时 NULL
- categoryId — transfer 时强制 = 内置"转账"分类(M3)
- memberId
- remark
- occurredAt
- createdAt
- updatedAt

### 027 转账语义 (transfer)

- 转账关联转出账户(accountId)与转入账户(toAccountId),金额在两账户间等额移动。
- 转账**不计入月度收入或支出统计**(type-driven 聚合排除 transfer)。
- 退款 = type='expense' + isRefund=true,amount 存 +正数(跳过 applySign),
  冲减原支出分类(同分类正负 ABS 相加后净额下降)。
- 转出/转入同一账户被拒(FR-014)。

## 后续聚合 (路线图解锁)

Budget — 027 已解锁(Family 聚合内,按月)
Asset/Debt — 027 用 Account.type(asset/debt)推导,不新增表
Investment — 仍属范围外

## Budget (027-mobile-home-revamp US5)

- id, familyId, year, month(1-12), amount(分), createdAt, updatedAt
- (familyId, year, month) 唯一 —— 一个家庭一个月份只有一条预算
- 仅月预算(clarify Q3);无年预算
- 四态(computeBudgetStatus 纯函数):unset(未设置)/ normal(<80%)/
  warning(≥80% <100%)/ overspent(≥100%);阈值 80% 硬编码(设计 §4.3)
- usagePercent = usedAmount / budgetAmount,一位小数

## Category (003-category + 018-custom-category) — 内置字典 + 家庭自定义

003 内置分类 (20 条,read-only):
- id (UUID v5,基于 `"${type}:${name}"` 在 DNS 命名空间)
- name (中文名 1-30 字符)
- type (`income` | `expense`,pgEnum)
- icon (emoji,白名单见 `src/lib/constants/category-emojis.ts`)
- sortOrder (整数,默认 100,整数间隔 + 耗尽重排算法见 018 FR-031)
- isBuiltIn = true (内置)
- family_id IS NULL (所有家庭共享只读)
- 20 条种子通过迁移 SQL 注入 (003 是 12 expense + 8 income)

018 自定义分类 (V1.5 增强):
- id (UUID v7,运行时随机)
- family_id NOT NULL (按家庭隔离,跨家庭访问 → 404 不暴露存在性)
- parent_id (NULL = 顶级;非 NULL = 二级,深度上限 2 层)
- archived_at (NULL = 活跃;非 NULL = 归档,软停用,不硬删)
- updated_at (每次 update/refresh 触发)
- 子分类 type MUST 等于父分类 type (FR-005(d))
- 同家庭 + 同 type + 同 parentId 下 name 唯一 (case-insensitive + trim)
- 200 个/家庭硬上限 (含归档,advisory lock 防 race)
- CRUD via tRPC: create / update / archive / unarchive / reorder / list / get
- 审计: category_events 表 (沿用 transaction_events 模式,永久保留)
- 归档级联: archive 父 → 级联 archive 未归档子;unarchive 父 → 强制级联复活所有子 (含独立归档过的)
- 下游 feature (004 transaction / 019 budget / 020 reports) 引用 categoryId
  时不区分 isBuiltIn,行为完全一致 (FR-025)
