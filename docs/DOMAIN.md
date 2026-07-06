# DOMAIN

## 聚合

Family (聚合根,001-auth-family)
├── Member
├── Account (002-account)
├── Category (后续 feature)
└── Transaction (后续 feature)

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

Category
Asset
Debt
Budget
Investment
