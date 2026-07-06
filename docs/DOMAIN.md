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

## Transaction (后续 feature)

- id
- type(income|expense)
- amount
- accountId
- categoryId
- memberId
- remark
- occurredAt
- createdAt
- updatedAt

## 后续聚合 (路线图解锁)

Asset
Debt
Budget
Investment

## Category (003-category) — 内置分类字典

- id (UUID v5,基于 `"${type}:${name}"` 在 DNS 命名空间)
- name (中文名 1-30 字符)
- type (`income` | `expense`,pgEnum)
- icon (emoji 1-4 UTF-16 code units)
- sortOrder (整数,默认 100)
- isBuiltIn (MVP 全 true,V2 自定义分类时区分)
- 无 family_id (所有家庭共享)
- 22 条种子通过迁移 SQL 注入,read-only (无 CRUD)
