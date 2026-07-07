# Feature 规约: 记账表单

**Feature 分支**: `008-transaction-ui`

**创建日期**: 2026-07-07

**状态**: Draft

**输入**: `docs/MVP.md` "/transaction/new" 页面,基于 002-account + 003-category + 004-transaction 后端 API

## 概述

本 feature 实现前端记账表单 —— 用户在手机上 10 秒完成一笔收支记录。用户选择类型 (收入/支出)、选账户、选分类、输入金额、可选备注、可选日期,提交后交易创建成功,跳转回 Dashboard。

这是 PRD "10 秒记账" 核心目标的**前端闭环** —— 之前后端 004-transaction 已全部就绪,但用户只能通过 curl 测试;本 feature 让记账变成手机上点几下就能完成。

本 feature **不新增后端 API**,仅实现 `/transaction/new` 前端页面 + 表单组件。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 快速记账 (Priority: P1) 🎯 MVP

已登录用户点底部导航"记账"tab,进入记账表单,选收入或支出、选账户、选分类、输金额、可选填备注,提交后交易创建,toast 提示"记账成功",跳转回 Dashboard。

**为何此优先级**: PRD "10 秒记账" 的核心。没有这个页面,App 无法在 UI 上记账。

**Acceptance Scenarios**:

1. **Given** 用户已登录且家庭下有账户, **When** 点底部"记账"tab, **Then** 显示记账表单。
2. **Given** 在记账表单, **When** 选"支出" + 选账户 + 选分类 + 输金额"35.00" + 提交, **Then** 创建成功,显示"记账成功",跳转 /dashboard。
3. **Given** 在记账表单, **When** 未选账户或分类, **Then** 提交按钮禁用或显示错误。
4. **Given** 在记账表单, **When** 金额输入 0 或负数, **Then** 显示"金额必须 > 0"。
5. **Given** 在记账表单, **When** 金额输入超过 2 位小数 (如 35.999), **Then** 自动截断到 2 位 (35.99) 或显示错误。
6. **Given** 选"收入"类型, **When** 分类列表加载, **Then** 仅显示收入分类 (type 匹配)。
7. **Given** 选"支出"类型, **When** 分类列表加载, **Then** 仅显示支出分类。
8. **Given** 提交时后端报错 (如 type/category 不匹配), **When** 响应返回, **Then** 显示后端错误消息。
9. **Given** 未登录, **When** 访问 /transaction/new, **Then** 重定向 /login。

---

### User Story 2 - 默认值与快捷操作 (Priority: P2)

用户打开记账表单时,有合理的默认值减少操作步骤:默认"支出"、默认选中第一个账户、默认今天、默认上次使用的分类。金额输入框自动聚焦,键盘弹出数字输入。

**为何此优先级**: P2 —— 默认值优化减少操作步骤,让"10 秒" 更容易达成。不影响功能完整性。

**Acceptance Scenarios**:

1. **Given** 打开记账表单, **When** 页面加载, **Then** 默认选中"支出"类型。
2. **Given** 有多个账户, **When** 页面加载, **Then** 默认选中第一个未归档账户。
3. **Given** 页面加载, **When** 渲染完成, **Then** 金额输入框自动聚焦。
4. **Given** 金额输入框, **When** 点击, **Then** 弹出数字键盘 (inputMode="decimal")。
5. **Given** 日期字段, **When** 页面加载, **Then** 默认为今天。

---

### Edge Cases

- 家庭下无账户 → 表单显示"请先创建账户"提示 + 跳转 /settings 链接。
- 家庭下仅归档账户 (无未归档) → 同上。
- 网络断开 → 提交失败,显示"网络错误,请重试",表单数据保留 (不清空)。
- 后端 400 (type/category 不匹配) → 显示后端错误消息。
- 后端 401 (session 过期) → 自动跳转 /login。
- 金额大数 → 前端不做上限 (后端 004 FR-003 无上限),但输入框 maxLength 防误输超长。
- 备注超 200 字 → 前端 zod 校验 + maxLength=200。
- 并发提交 (快速双击) → 按钮 loading 状态防重复提交。
- 类型切换 (收入↔支出) → 分类列表刷新,清空已选分类 (旧分类可能类型不匹配)。
- 日期选未来 → 前端允许 (后端 ±1 day 容差,004 Clarification Q2),但不选未来更好 → 前端 max=today。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 提供 `/transaction/new` 页面,含记账表单:类型切换 (收入/支出)、账户选择、分类选择、金额输入、备注输入、日期选择、提交按钮。
- **FR-002**: 类型切换 MUST 默认"支出",用户可切换为"收入"。
- **FR-003**: 类型切换时分类列表 MUST 刷新,仅显示当前类型对应的分类 (调用 `category.list({ type })`)。
- **FR-004**: 账户选择 MUST 列出当前家庭所有未归档账户 (调用 `account.list()`)。
- **FR-005**: 金额输入 MUST 接受正数,精度 ≤ 2 位小数 (元);前端自动 `*100` 转分后提交后端。
- **FR-006**: 金额 0 或空 MUST 不允许提交 (按钮禁用或显示错误)。
- **FR-007**: 金额输入框 MUST 使用 `inputMode="decimal"`,移动端弹出数字键盘。
- **FR-008**: 备注输入 MUST 可选,最大 200 字符,placeholder 提示"选填,如午餐咖啡"。
- **FR-009**: 日期选择 MUST 默认今天,允许选过去日期,max=today (不允许选未来)。
- **FR-010**: 提交 MUST 调用 `transaction.create` mutation (tRPC client),传入 `{ type, accountId, categoryId, amount (分), remark, occurredAt }`。
- **FR-011**: 提交成功后 MUST 显示"记账成功"反馈 + 跳转 /dashboard。
- **FR-012**: 提交失败 MUST 显示错误消息,表单数据保留不清空。
- **FR-013**: 提交中 (loading) MUST 禁用提交按钮,防重复提交。
- **FR-014**: 家庭下无未归档账户 MUST 显示"请先创建账户"提示 + /settings 链接。
- **FR-015**: 金额输入框 MUST 页面加载后自动聚焦。
- **FR-016**: 类型切换 MUST 清空已选分类 (旧分类类型可能不匹配)。
- **FR-017**: 所有表单校验 MUST 在提交前完成 (不发无效请求)。
- **FR-018**: 页面 MUST Mobile-First 适配 (PRD "Mobile First")。

### Key Entities

无新增数据实体。复用 002-account + 003-category + 004-transaction 的后端 API。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户从打开记账页到提交完成 ≤ 10 秒 (PRD 核心目标)。
- **SC-002**: 表单提交 (含网络) 服务端响应 ≤ 2 秒。
- **SC-003**: 页面在 iPhone SE (375px 宽) 上无横向滚动。
- **SC-004**: 金额输入框聚焦时弹出数字键盘 (移动端)。
- **SC-005**: 提交成功后 Dashboard 的当月收支数字立即更新 (cache invalidation)。
- **SC-006**: 类型切换时分类列表 ≤ 200ms 刷新。

## Assumptions

- 后端 002-account + 003-category + 004-transaction 全部就绪且通过 e2e 验证。
- tRPC client hooks (`trpc.transaction.create.useMutation()`, `trpc.account.list.useQuery()`, `trpc.category.list.useQuery()`) 已在 007 配置好。
- react-hook-form + zod 已在 007 安装。
- shadcn/ui 组件 (Button, Input, Label, Card) 已在 007 创建。
- 金额前端用元 (decimal),提交时 `*100` 转分 (integer);后端 004 接受整数分。
- 默认值: 类型=支出、账户=第一个未归档、分类=用户选 (无默认,因分类不能自动选 type 不匹配的)、日期=今天。
- 不实现"拍照小票" —— V2。
- 不实现"周期记账" —— V2。
- 不实现"批量记账" —— V2。
- 提交成功后用 `router.push('/dashboard')` + `utils.dashboard.invalidate()` 刷新首页数据。
- 底部导航"记账"tab 高亮在 `/transaction/new` 页面 (007 BottomNav 已实现)。
