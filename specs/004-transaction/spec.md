# Feature 规约: 交易管理

**Feature 分支**: `004-transaction`

**创建日期**: 2026-07-07

**状态**: Draft

**输入**: 基于 `docs/MVP.md` 列出的"收入/支出 (Transaction)"功能,本 feature 是 MVP 第四个核心模块,也是 PRD "10 秒记账" 的核心热路径

## 概述

家庭记账系统中,交易 (Transaction) 是用户记录每一笔收支的核心载体 —— 一杯咖啡 -30 元、一笔工资 +8000 元。本 feature 让已注册用户在自己的默认家庭下,对已存在的账户 (Account) 与内置分类 (Category) 进行交易创建、查询、编辑、删除。

交易是 MVP 的"心脏" —— PRD 明确要求 "10 秒完成一笔记账"。这意味着创建交易流程必须极简、极快、零阻塞。

本 feature 依赖前置三个 feature:
- `001-auth-family` —— 提供认证 + 默认家庭上下文
- `002-account` —— 提供账户选择 (创建交易必须选账户)
- `003-category` —— 提供分类选择 (创建交易必须选分类)

后续 feature `005-transactions-list` (流水列表) 与 `006-dashboard` (首页统计) 都基于本 feature 的交易数据。

## Clarifications

### Session 2026-07-07

- Q: `amount` 字段在 DB 用哪种存储方式? → A: signed bigint (income 存正、expense 存负),聚合 `SUM(amount)` 直接得净额,V2 transfer 友好。
- Q: `occurredAt` 用什么时区? → A: 服务端 UTC 存储与比较,前端传 ISO 8601 with offset;容差 ±1 day。
- Q: 同一交易的并发编辑采用哪种模型? → A: Last-Write-Wins (无版本号),Drizzle $onUpdate 自动更新 updatedAt。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 创建交易 (Priority: P1) 🎯 MVP

已登录用户在"新建交易"页选择类型 (收入/支出)、账户、分类、输入金额、备注 (可选)、日期 (默认今天),提交后交易被记录,账户余额随之更新。

**为何此优先级**: PRD "10 秒记账" 的核心。没有交易就无法记账。

**独立测试**: 创建成功后,DB 新增 1 条 transactions 行;响应不含 `password` / `token` 等敏感字段。

**Acceptance Scenarios**:

1. **Given** 用户已登录且家庭下有账户, **When** 提交 `{type, accountId, categoryId, amount, remark?, occurredAt}`, **Then** 交易被创建,响应含完整交易数据。
2. **Given** type 不在 {income, expense} 中, **When** 提交, **Then** 400 字段错误。
3. **Given** amount ≤ 0, **When** 提交, **Then** 400 (金额必须 > 0)。
4. **Given** amount 含超过 2 位小数, **When** 提交, **Then** 400。
5. **Given** accountId 不属于当前家庭, **When** 提交, **Then** 400 (跨家庭拒绝,不暴露存在性)。
6. **Given** categoryId 不在 {income, expense} 对应类型中 (如 type=expense 但 categoryId 是收入分类), **When** 提交, **Then** 400 (类型不匹配)。
7. **Given** accountId 已归档, **When** 提交, **Then** 400 (归档账户不可用于新交易)。
8. **Given** 未登录, **When** 提交, **Then** 401。

---

### User Story 2 - 查看交易详情 (Priority: P1)

已登录用户用交易 ID 查询单条交易详情 (含账户名 + 分类名 + icon)。

**为何此优先级**: 编辑交易的预填值需要它;交易详情页展示。

**独立测试**: list 拿到的 ID 调 get 返回完整数据,含 accountName + categoryName + categoryIcon (JOIN 结果)。

**Acceptance Scenarios**:

1. **Given** 交易存在且属于当前家庭, **When** 调 `transaction.get({ id })`, **Then** 返回完整字段 + 关联的账户名 + 分类名/icon。
2. **Given** 交易不存在或属于其他家庭, **When** 调 get, **Then** 404。
3. **Given** 未登录, **When** 调 get, **Then** 401。

---

### User Story 3 - 编辑交易 (Priority: P1)

已登录用户修改交易的可变字段 (类型/账户/分类/金额/备注/日期)。所有字段都可改,但改 `type` 需要同步校验 `categoryId` 类型匹配。

**为何此优先级**: 用户输错常见,需要纠正能力。

**独立测试**: 编辑金额 → DB 中 amount 更新 + updatedAt 更新;编辑 type 但不换 categoryId (类型不匹配) → 400。

**Acceptance Scenarios**:

1. **Given** 交易属于当前家庭, **When** 提交编辑, **Then** 字段更新,`updatedAt` 更新。
2. **Given** type 改为 expense 但 categoryId 仍是 income, **When** 提交, **Then** 400。
3. **Given** 改 accountId 到其他家庭的账户, **When** 提交, **Then** 400。
4. **Given** 交易不存在或属于其他家庭, **When** 提交编辑, **Then** 404。
5. **Given** 未登录, **When** 提交编辑, **Then** 401。

---

### User Story 4 - 删除交易 (Priority: P1)

已登录用户硬删除交易 (注意:与账户的"归档软删除"不同,交易允许真删除,因为交易量大,软删除会累积大量行)。

**为何此优先级**: 用户误操作常见,需要快速撤销。MVP 用硬删除简化;V2 评估"回收站"软删除。

**独立测试**: 删除后 DB 行消失;再次 get → 404;同一 ID 重复删除 → 404 (而非错误)。

**Acceptance Scenarios**:

1. **Given** 交易属于当前家庭, **When** 调 `transaction.delete({ id })`, **Then** 200 `{ success: true }`,DB 行消失。
2. **Given** 交易不存在或属于其他家庭, **When** 调 delete, **Then** 404。
3. **Given** 已删除的交易再调 delete, **When** 重复调, **Then** 404 (非幂等,因为硬删除后行不在)。
4. **Given** 未登录, **When** 调 delete, **Then** 401。

---

### Edge Cases

- amount 精度: 支持 2 位小数 (元),DB 以整数分 (bigint) 存储,与 002-account.initialBalance 一致。
- amount 范围: > 0 且 ≤ `Number.MAX_SAFE_INTEGER` (与 002 验证一致)。
- type 必须 ∈ {income, expense};不允许 transfer (V2 转账)。
- occurredAt: 允许过去日期 (补记)、今天;不允许未来日期 (> today + 1 day 容差)。
- remark: 1-200 字符,允许空字符串。
- familyId: 服务端派生,拒绝客户端传入 (与 002 一致,FR-006 风格)。
- 跨家庭访问: account 不属于当前家庭 → 400 (创建/编辑时);transaction 不属于当前家庭 → 404 (查询/删除时)。
- 已归档账户不可用于新交易创建 (002-FR-011 风格);编辑已有交易的 accountId 到已归档账户 → 也拒绝。
- 并发: 同一家庭多成员同时创建交易 → 都成功 (无 unique 约束)。
- 并发编辑同一笔交易: Last-Write-Wins (Clarification Q3),后提交覆盖先提交,Drizzle `$onUpdate` 自动更新 `updatedAt`。V2 多成员时再评估乐观锁。
- 软删除 (归档): MVP 不实现 —— 交易允许硬删除。V2 评估。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 允许已认证用户在自己的默认家庭下创建交易,字段: type、accountId、categoryId、amount、remark (可选)、occurredAt (可选,默认 today)。
- **FR-002**: `type` MUST ∈ {`income`, `expense`};`transfer` 暂不支持 (V2)。
- **FR-003**: `amount` MUST > 0 (前端输入),精度 ≤ 2 位小数 (元),DB 以整数分 (`bigint`) 存储;**signed 存储** —— income 存正、expense 存负 (Clarification Q1),无上限。
- **FR-004**: 前端 MUST 始终传正数 amount;后端按 `type` 自动决定存储符号 (income → 正、expense → 负),客户端不可直接传负数。
- **FR-005**: `accountId` MUST 属于当前家庭,且 `archivedAt IS NULL` (FR-007 of 002-account);否则 400。
- **FR-006**: `categoryId` MUST 存在且其 `type` 与交易的 `type` 匹配 (income→income, expense→expense);否则 400。
- **FR-007**: `familyId` MUST 服务端派生,客户端 input 不接受此字段 (与 002-FR-006 一致)。
- **FR-008**: `occurredAt` MUST 在过去或今天 (≤ `now + 1 day` 容差);未来日期拒绝。服务端按 **UTC** 存储与比较 (Clarification Q2),前端传 ISO 8601 with offset (`2026-07-07T14:30:00+08:00`)。
- **FR-009**: `remark` 长度 MUST ≤ 200 字符;允许空字符串 (默认 `""`)。
- **FR-010**: 系统 MUST 提供按家庭列出交易的能力,按 `occurredAt DESC` 排序 (流水视图,后续 `005` feature 实现完整列表 + 筛选,本 feature 提供基础查询)。
- **FR-011**: 系统 MUST 提供查询单条交易的能力 (`transaction.get`),返回完整字段 + JOIN 的 accountName / categoryName / categoryIcon。
- **FR-012**: 系统 MUST 允许用户编辑交易的可变字段 (type, accountId, categoryId, amount, remark, occurredAt);编辑 `type` 时同步重校 `categoryId` 类型匹配。
- **FR-013**: 系统 MUST 允许用户硬删除交易 (软删除延后 V2)。
- **FR-014**: 跨家庭访问 (`transaction.get` / `update` / `delete`) MUST 返回 404 (与 002-FR-012 一致)。
- **FR-015**: 跨家庭 `accountId` (创建/编辑时) MUST 返回 400 (字段级错误,而非 404,因为这是 input 校验)。
- **FR-016**: 所有交易操作 MUST 写入审计日志到 `transaction_events` 表 (与 002-account_events 同模式,event_type 4 类: transaction_created / transaction_edited / transaction_deleted)。
- **FR-017**: `transaction.create` 性能 MUST P95 < 300ms (含 account+category 校验 + 审计写入);`transaction.get` MUST P95 < 100ms (索引查询)。
- **FR-018**: 系统 MUST NOT 自动更新账户余额 (账户余额由 `006-dashboard` feature 在查询时动态聚合计算,不在 transaction 表持久化)。

### Key Entities *(include if feature involves data)*

- **Transaction**: 交易实体。属性: id (UUID v7)、familyId、type (`income` | `expense`)、accountId、categoryId、amount (bigint,单位"分",DB 中按 type 决定正负存储;income=正、expense=负,或始终正 + type 字段区分 —— 决策见 clarification)、remark (text ≤ 200)、occurredAt (timestamp)、createdAt、updatedAt。
- **TransactionEvent**: 审计日志。属性: id、eventType (transaction_created/edited/deleted)、transactionId、actorMemberId、before (jsonb,编辑前可变字段快照)、after (jsonb,编辑后)、occurredAt。
- **Account** (引用 002): 必须未归档。
- **Category** (引用 003): 必须 type 与交易 type 匹配。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户能在 10 秒内完成"打开新建交易 → 选账户/分类 → 输金额 → 提交"端到端流程 (PRD 核心目标)。
- **SC-002**: `transaction.create` 服务端处理 P95 < 300ms (FR-017)。
- **SC-003**: `transaction.get` 服务端处理 P95 < 100ms (FR-017)。
- **SC-004**: 100% 跨家庭访问尝试被拒绝 (无信息泄漏,FR-014/015)。
- **SC-005**: 编辑后 `updatedAt` MUST 更新 (与 002-SC-006 一致)。
- **SC-006**: 删除后 DB 行消失,重复删除返回 404 (非 500)。
- **SC-007**: `transaction_events` 审计写入,`before` / `after` jsonb 严禁含 password / token / amount 之外的敏感字段。
- **SC-008**: type 与 categoryId 类型不匹配的请求 100% 被拒 (FR-006)。
- **SC-009**: 已归档账户不可用于创建交易 (FR-005)。
- **SC-010**: 交易 amount 单位是"分" (bigint),前端展示除 100 转元,2 位小数。

## Assumptions

- 默认家庭已存在 (由 001-auth-family 保证)。
- 用户家庭下至少有 1 个账户 + 内置分类已 seed (002/003 完成)。
- amount 精度与 002-account.initialBalance 一致: 整数分 (`bigint`),JS 端 number 类型,展示除 100。
- amount DB 存储**signed** (Clarification Q1): income 存正、expense 存负;前端始终传正数,后端按 type 自动加符号。聚合查询 `SUM(amount)` 直接得净额,无需 CASE WHEN。
- type 不支持 transfer (V2 转账 feature)。
- occurredAt 默认 today (UTC),允许过去任意日期 (补记),允许 today 容差 ±1 day (跨时区防御)。
- remark 默认空字符串 `""` (不是 null),保持非空约束简化前端处理。
- 不持久化账户余额 (FR-018);余额由后续 dashboard feature 动态聚合 `SUM(amount)` 计算。
- 不实现"批量记账" (一次提交多笔) —— MVP 一笔一提交,V2 评估。
- 不实现"附件" (拍照小票等) —— V2 评估。
- 不实现"标签/自定义分类" —— 003-category 已限定 read-only 内置。
- 不实现"周期交易" (固定收支) —— V2 路线图项。
- 审计日志: 新建 `transaction_events` 表 (与 002-account_events 同模式,与 001-auth_events 解耦)。

## Clarifications

(本次 spec 写入 0 个 [NEEDS CLARIFICATION],所有歧义点均落入"合理默认 + 写入 Assumptions"。可在 `/speckit-clarify` 阶段进一步 challenge。)

**注意**: amount 存储策略已通过 Clarification Q1 确认为 **signed bigint** (income 正、expense 负)。聚合 `SUM(amount)` 直接得净额。
