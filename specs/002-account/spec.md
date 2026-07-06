# Feature 规约: 账户管理

**Feature 分支**: `002-account`

**创建日期**: 2026-07-06

**状态**: Draft

**输入**: 用户描述 "002-account" (基于 `docs/MVP.md` 列出的"账户 (Account)" 功能,本 feature 是 MVP 第二个核心模块)

## 概述

家庭记账系统中,账户 (Account) 是用户记录收入/支出的"钱袋子"载体 —— 现金、银行卡、支付宝、微信零钱等。本 feature 让已注册用户在自己的默认家庭下管理多个账户,包括创建、查看列表、编辑、归档。

账户是交易 (Transaction,后续 feature `004-transaction`) 的必要前置 —— 没有账户就无法记录一笔收支。本 feature 不实现交易本身,但为后续 feature 提供数据模型基础。

## Clarifications

### Session 2026-07-06

- Q: 账户操作的审计日志应该写在哪里? → A: 新建 `account_events` 表 (与 `auth_events` 解耦,业务聚合与认证聚合是不同限界上下文)。
- Q: `initialBalance` 用什么数据类型? → A: 整数分 (`bigint`,单位"分"),JS 端 `number` 类型,展示除 100。
- Q: MVP 中账户归"家庭级共享"还是允许"成员私有"? → A: 家庭级共享 (延后私有到 V2,MVP 1:1 关系下讨论私有账户为时过早)。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 创建账户 (Priority: P1)

已登录用户在"账户管理"页打开"新建账户"表单,填写名称 (如"招商银行卡")、币种 (默认人民币)、初始余额,提交后账户出现在列表中。

**为何此优先级**: 没有账户就无法记账。MVP 范围内,这是用户在认证后的第一个业务动作。

**独立测试**: 即使后续故事未实现,也能验证: 账户行已写入、归属当前用户的家庭、列表中可见。

**Acceptance Scenarios**:

1. **Given** 用户已登录, **When** 提交有效名称 + 默认币种, **Then** 账户被创建,初始余额 = 用户输入的值 (默认 0),归属当前家庭。
2. **Given** 名称为空, **When** 提交, **Then** 字段级错误,不创建。
3. **Given** 名称超过 50 字, **When** 提交, **Then** 字段级错误。
4. **Given** 初始余额含非数字字符, **When** 提交, **Then** 字段级错误。
5. **Given** 用户未登录, **When** 提交, **Then** 401 未授权,不创建任何账户。

---

### User Story 2 - 查看账户列表 (Priority: P1)

已登录用户在"账户管理"页能看到自己家庭下的所有账户 (未归档),按创建时间倒序,显示名称、余额、币种、归档状态。

**为何此优先级**: 列表是用户进入账户页的第一眼。也是后续"创建交易时选择账户"下拉的数据源。

**独立测试**: 创建 N 个账户后,列表返回这 N 个 (按预期排序),不返回其他家庭的账户。

**Acceptance Scenarios**:

1. **Given** 用户家庭下有 3 个未归档账户, **When** 访问列表, **Then** 返回 3 条,按创建时间倒序。
2. **Given** 用户家庭下有 2 个已归档账户, **When** 访问默认列表, **Then** 不返回已归档账户 (除非显式查询参数 `includeArchived=true`)。
3. **Given** 用户未登录, **When** 访问列表, **Then** 401 未授权。
4. **Given** 用户 A 创建账户, **When** 用户 B 访问列表, **Then** 不返回 A 的账户 (跨家庭隔离)。

---

### User Story 3 - 编辑账户 (Priority: P1)

已登录用户在账户列表点"编辑",修改名称或币种,提交后变更生效。**初始余额不可编辑** (一旦设了,后续只能通过交易来调整)。

**为何此优先级**: 用户起名打错是常见情况。

**独立测试**: 编辑名称 → 列表反映新名称;编辑初始余额字段 → 字段级错误。

**Acceptance Scenarios**:

1. **Given** 用户拥有该账户, **When** 提交新名称, **Then** 名称更新,`updatedAt` 时间戳更新。
2. **Given** 用户提交时尝试修改 `initialBalance`, **Then** 字段级错误或被忽略 (字段不在可编辑列表中)。
3. **Given** 账户已被归档, **When** 用户编辑, **Then** 拒绝 (归档账户不可编辑,需先取消归档)。
4. **Given** 用户 B 尝试编辑用户 A 的账户, **Then** 404 Not Found (跨家庭隔离,信息泄漏防御)。

---

### User Story 4 - 归档账户 (Priority: P2)

已登录用户在账户列表点"归档",账户从默认列表消失但保留在数据库中 (软删除)。已归档账户可"取消归档"恢复。

**为何此优先级**: P2 —— 用户停用某账户但不希望丢失历史交易记录。比创建/查看/编辑低优先级。

**独立测试**: 归档后默认列表看不到,`includeArchived=true` 能看到,取消归档后回到默认列表。

**Acceptance Scenarios**:

1. **Given** 用户拥有账户 X (余额非零,有历史交易), **When** 点击归档, **Then** 账户标记 `archivedAt` 时间戳,保留所有行。
2. **Given** 已归档账户, **When** 用户在归档列表点"取消归档", **Then** `archivedAt = NULL`,账户回到默认列表。
3. **Given** 已归档账户, **When** 用户尝试通过编辑接口修改, **Then** 拒绝 (US3 边界)。
4. **Given** 已归档账户, **When** 创建交易时尝试选择该账户, **Then** 不在选择列表中 (后续 `004-transaction` feature 强制)。

---

### Edge Cases

- 币种非 ISO 4217 标准代码 (如 "RMB") → 拒绝,要求 "CNY"。
- 余额精度: 必须支持 2 位小数 (分),不接受超过 2 位。
- 创建账户时 `familyId` 必须从当前 session 派生,不接受客户端传入 (防越权)。
- 并发: 同一家庭并发创建同名账户 → 都成功 (无唯一约束,允许重名)。
- 删除: MVP 不提供硬删除,只能归档。V2 评估"无交易的账户允许硬删除"。
- 已归档账户的初始余额在 Dashboard 中是否计入 → V2 决策,MVP 暂不计入。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 允许已认证用户在自己的默认家庭下创建账户,字段: 名称、币种、初始余额。
- **FR-002**: 账户名称 MUST 长度 1-50 字符,允许中文/英文/数字/常见符号。
- **FR-003**: 币种 MUST 是 ISO 4217 三字母代码 (CNY/USD/EUR 等);系统 MUST 至少支持 CNY。
- **FR-004**: 初始余额 MUST 是数字 (允许负数,代表信用卡/借贷场景),数据库以 **整数分 (`bigint`)** 存储,精度 ≤ 2 位小数 (元);展示时除 100 转元。允许负数 (信用卡/借贷)。
- **FR-005**: 初始余额默认值 MUST 为 0。
- **FR-006**: 账户 MUST 自动绑定到当前 session 用户的家庭;客户端 MUST NOT 传入 `familyId` 字段。
- **FR-007**: 系统 MUST 提供按家庭列出账户的能力,默认仅返回未归档账户,按创建时间倒序。
- **FR-008**: 系统 MUST 支持 `includeArchived=true` 查询参数,返回含已归档账户的完整列表。
- **FR-009**: 系统 MUST 允许用户编辑账户名称与币种;**初始余额 MUST NOT 可编辑**。
- **FR-010**: 系统 MUST 允许用户归档账户 (设置 `archivedAt` 时间戳) 与取消归档。
- **FR-011**: 已归档账户 MUST NOT 可编辑 (需先取消归档)。
- **FR-012**: 跨家庭访问 MUST 返回 404 (不区分"不存在"与"无权限",信息泄漏防御)。
- **FR-013**: 系统 MUST NOT 提供硬删除账户的能力 (MVP;V2 评估条件)。
- **FR-014**: 列表查询 MUST 在 P95 < 200ms (单家庭 < 100 个账户的常见规模)。
- **FR-015**: 所有账户操作 MUST 写入审计日志 —— 新建 `account_events` 表 (与 `auth_events` 解耦),每条记录字段: `eventType` (account_created / account_edited / account_archived / account_unarchived)、`accountId`、`actorMemberId`、`before` (jsonb,编辑前的可变字段)、`after` (jsonb,编辑后的可变字段)、`occurredAt`。`account_events` 严禁包含 password / token / session 等敏感字段。

### Key Entities *(include if feature involves data)*

- **Account**: 账户实体。属性: id (UUID v7)、familyId、name (1-50)、currency (ISO 4217)、initialBalance (decimal,2 位小数)、archivedAt (可空)、createdAt、updatedAt。MVP 中一个账户只属于一个家庭;V2 评估"账户归属成员" (多人共管场景)。
- **Currency**: 值对象,ISO 4217 三字母代码 + 默认小数位数 (CNY/USD = 2,JPY = 0)。MVP 内置常见 ~10 种,V2 接入外部汇率。
- **AccountEvent**: 审计日志,见 FR-015。属性: id、eventType、accountId、actorMemberId、before、after、occurredAt。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户能在 30 秒内完成"创建一个账户"的端到端流程 (登录后)。
- **SC-002**: 列表查询在 100 个账户规模下 P95 < 200ms。
- **SC-003**: 100% 的跨家庭访问尝试被拒绝 (无信息泄漏)。
- **SC-004**: 归档 + 取消归档操作幂等 —— 重复归档已归档账户不报错,取消归档未归档账户也不报错。
- **SC-005**: 账户名称支持全 Unicode (中文、日文、emoji 不在名称内但常见 Unicode 字符 OK),长度按 UTF-16 code unit 计 ≤ 50。
- **SC-006**: 编辑账户名称时,`updatedAt` MUST 更新;编辑未变更字段时 `updatedAt` 仍更新 (Last-Write-Wins 语义)。
- **SC-007**: 初始余额 MUST 在创建后只读 —— 任何编辑请求均不得修改该字段。

## Assumptions

- 默认家庭已存在 (由 `001-auth-family` 注册流程保证)。本 feature 不创建家庭。
- 币种支持列表 MVP 内置: CNY (默认), USD, EUR, JPY, HKD, GBP, AUD, CAD, SGD。共 9 种。V2 接入完整 ISO 4217。
- 初始余额以"分"(`bigint`) 存储 (见 Clarification Q2),避免浮点累计误差 (金融场景经典陷阱);前端展示时除 100 转元,2 位小数。
- 初始余额支持负数 (代表信用卡/借贷账户)。
- 账户名称允许重名 (不做唯一约束)。原因: 用户可能有"招商银行卡 1"、"招商银行卡 2" 等场景,强制唯一反而麻烦。
- 归档是软删除 (`archivedAt` 时间戳),不删除行。
- 不实现"账户归属成员" —— MVP 中账户归家庭,所有家庭成员可见可编辑。V2 评估"私有账户" (见 Clarification Q3)。
- 不实现"账户图标/颜色" —— V2 视觉增强。
- 不实现"账户排序/置顶" —— 列表固定按 `createdAt` 倒序。
- 审计日志: 新建 `account_events` 表 (见 Clarification Q1),与 `auth_events` 解耦。

## Clarifications

(本次 spec 写入 0 个 [NEEDS CLARIFICATION],所有歧义点均落入"合理默认 + 写入 Assumptions"区间。可在 `/speckit-clarify` 阶段进一步 challenge。)
