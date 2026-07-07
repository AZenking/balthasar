# Feature 规约: 前端认证与首页

**Feature 分支**: `007-onboarding-ui`

**创建日期**: 2026-07-07

**状态**: Draft

**输入**: `docs/MVP.md` 列出的 "/login、/dashboard" 页面,基于 001-006 后端 API

## 概述

本 feature 是第一个**前端** feature —— 让用户通过浏览器完成"注册 → 登录 → 看到首页统计"的完整闭环。后端 001-006 已全部就绪,但用户只能通过 curl 测试;本 feature 让 App 变得"可用"。

MVP 范围:
- **认证页面**: /login (登录) + /register (注册)
- **认证流程**: 未登录 → 重定向 /login;已登录 → 重定向 /dashboard
- **App Shell**: 底部导航栏 (首页 / 流水 / 记账 / 设置)
- **首页**: /dashboard 显示当月收支 + 最近交易 + 分类占比

不在范围 (后续 feature):
- /transactions 流水列表页 (008)
- /transaction/new 新建交易表单 (009)
- /settings 设置页 (010)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 注册 (Priority: P1)

新用户打开 App,看到登录页,点"注册"链接,输入邮箱+密码+确认密码,提交后自动登录,跳转到首页。

**为何此优先级**: 第一个用户的第一步。

**Acceptance Scenarios**:

1. **Given** 未登录用户访问任意页面, **When** 页面加载, **Then** 重定向到 /login。
2. **Given** 在 /register 页, **When** 输入有效邮箱+密码+确认密码, **Then** 提交后自动登录,跳转 /dashboard。
3. **Given** 密码 < 8 位, **When** 提交, **Then** 表单显示错误,不提交。
4. **Given** 两次密码不一致, **When** 提交, **Then** 表单显示"密码不一致"。
5. **Given** 邮箱已被注册, **When** 提交, **Then** 显示"该邮箱已注册"错误。
6. **Given** 注册成功后, **When** 刷新页面, **Then** 仍在登录态 (cookie 持久)。

---

### User Story 2 - 登录 (Priority: P1)

已注册用户在 /login 输入邮箱+密码,登录后跳转 /dashboard。

**Acceptance Scenarios**:

1. **Given** 在 /login 页, **When** 输入正确凭证, **Then** 跳转 /dashboard。
2. **Given** 密码错误, **When** 提交, **Then** 显示"邮箱或密码错误"。
3. **Given** 账户被锁定 (5 次失败), **When** 提交, **Then** 显示"账户已锁定,请 N 分钟后重试"。
4. **Given** 已登录用户访问 /login, **When** 页面加载, **Then** 自动跳转 /dashboard。

---

### User Story 3 - 首页 Dashboard (Priority: P1)

已登录用户在 /dashboard 看到当月收支汇总卡片 + 最近交易列表 + 支出分类占比。

**Acceptance Scenarios**:

1. **Given** 已登录且当月有交易, **When** 访问 /dashboard, **Then** 显示 monthIncome / monthExpense / monthNet 三个数字卡片。
2. **Given** 当月有支出, **When** 页面加载, **Then** 显示分类占比列表 (分类名 + icon + 金额 + 百分比)。
3. **Given** 当月有交易, **When** 页面加载, **Then** 显示最近 5 笔交易列表 (类型 icon + 金额 + 分类 + 账户 + 备注 + 时间)。
4. **Given** 当月无交易, **When** 访问 /dashboard, **Then** 显示"暂无交易"空状态。
5. **Given** 数据加载中, **When** 页面渲染, **Then** 显示骨架屏或 loading 状态 (不闪白)。

---

### User Story 4 - 登出 + App Shell (Priority: P2)

已登录用户通过底部导航在页面间切换,可以点"设置"登出。

**为何此优先级**: P2 —— 登出不阻断核心记账流程,但 App Shell 导航是必需的。

**Acceptance Scenarios**:

1. **Given** 已登录, **When** 点击底部导航的"首页", **Then** 跳转 /dashboard。
2. **Given** 已登录, **When** 点"流水", **Then** 跳转 /transactions (本 feature 仅占位,显示"即将上线")。
3. **Given** 已登录, **When** 点"记账", **Then** 跳转 /transaction/new (本 feature 仅占位)。
4. **Given** 已登录, **When** 点"设置", **Then** 跳转 /settings (本 feature 仅占位,含"登出"按钮)。
5. **Given** 在 /settings, **When** 点"登出", **Then** 清除登录态,跳转 /login。

---

### Edge Cases

- 网络断开 → 显示"网络错误,请重试",不崩溃。
- 后端 500 错误 → 显示通用错误提示 "服务器开小差了"。
- session 过期 → 下次请求 401,前端自动跳转 /login。
- 并发: 多 tab 同时登录 → 均成功 (MVP 不限制并发 session)。
- 首次加载 (SSR/RSC): 服务端无 cookie → 渲染 /login 重定向;有 cookie → 渲染 /dashboard。
- Mobile-First: 所有页面必须适配手机屏幕 (PRD "Mobile First")。
- 暗色模式: MVP 不实现 (V2)。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 提供 /login 页面,含邮箱+密码输入框 + 登录按钮 + "去注册"链接。
- **FR-002**: 系统 MUST 提供 /register 页面,含邮箱+密码+确认密码 + 注册按钮 + "去登录"链接。
- **FR-003**: 注册流程 MUST 调用 Better-Auth signUpEmail (直连 /api/auth/sign-up/email),成功后自动登录态 (cookie 由 Better-Auth 设置)。
- **FR-004**: 登录流程 MUST 调用 Better-Auth signInEmail (直连 /api/auth/sign-in/email),成功后 cookie 设置。
- **FR-005**: 注册/登录前端 MUST 做表单校验 (邮箱格式、密码 ≥ 8 位、两次密码一致),不通过不提交。
- **FR-006**: 邮箱已注册时 MUST 显示"该邮箱已注册,请直接登录"提示。
- **FR-007**: 登录失败时 MUST 显示"邮箱或密码错误" (不区分邮箱不存在与密码错)。
- **FR-008**: 账户锁定时 MUST 显示锁定提示含剩余时间。
- **FR-009**: 未登录用户访问受保护页面 (如 /dashboard) MUST 重定向到 /login。
- **FR-010**: 已登录用户访问 /login 或 /register MUST 重定向到 /dashboard。
- **FR-011**: 系统 MUST 提供 /dashboard 页面,调用 `dashboard.summary` 显示当月收支 + 最近交易 + 分类占比。
- **FR-012**: /dashboard 收支汇总 MUST 显示 3 个卡片: 本月收入、本月支出、本月结余。
- **FR-013**: /dashboard 最近交易列表 MUST 显示每笔交易的类型 icon、金额、分类名+icon、账户名、备注、时间。
- **FR-014**: /dashboard 分类占比 MUST 按金额 DESC 排列,每项含 icon + 名称 + 金额 + 百分比。
- **FR-015**: /dashboard 无交易时 MUST 显示"暂无交易"空状态。
- **FR-016**: 系统 MUST 提供底部导航栏 (首页 / 流水 / 记账 / 设置),当前页高亮。
- **FR-017**: 系统 MUST 提供 /settings 页面 (占位),含"登出"按钮。
- **FR-018**: 登出 MUST 调用 Better-Auth signOut,清除 cookie,跳转 /login。
- **FR-019**: 系统 MUST 提供 /transactions 和 /transaction/new 占位页 (显示"即将上线")。
- **FR-020**: session 过期 (401 响应) MUST 自动跳转 /login。
- **FR-021**: 所有页面 MUST Mobile-First 适配 (PRD "Mobile First")。
- **FR-022**: 数据加载中 MUST 显示 loading 状态 (骨架屏或 spinner),不闪白屏。

### Key Entities

无新增数据实体。本 feature 纯前端,复用 001-006 的后端 API。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 新用户从打开 App 到看到首页统计,≤ 60 秒 (注册流程)。
- **SC-002**: 老用户从打开 App 到看到首页统计,≤ 5 秒 (登录流程,含网络)。
- **SC-003**: /dashboard 页面加载 (含 API 调用) ≤ 2 秒。
- **SC-004**: 所有页面在 iPhone SE (375px 宽) 上无横向滚动 (Mobile-First)。
- **SC-005**: 表单校验在提交前完成 (不发无效请求到后端)。
- **SC-006**: 登出后刷新页面不会回到 /dashboard (cookie 已清)。

## Assumptions

- 后端 001-006 全部就绪且通过 e2e 验证。
- Better-Auth 客户端 SDK (`authClient`) 用于浏览器端 sign-up/sign-in/sign-out (已有 `src/server/auth/client.ts`)。
- tRPC 客户端 hooks (`trpc.dashboard.summary.useQuery()` 等) 用于数据获取。
- 使用 shadcn/ui 组件库 (Button / Input / Card / Sheet 等)。
- 底部导航栏固定在屏幕底部 (Mobile-First),桌面端可延展。
- 占位页 (/transactions、/transaction/new、/settings 简版) 是临时 UI,后续 feature 替换。
- 不实现暗色模式 (V2)。
- 不实现 i18n (MVP 中文)。
- 不实现 PWA 离线 (V2)。
- 不实现动画过渡 (MVP 简洁,快速加载优先)。
- 密码强度实时提示: 仅前端 zod 校验 (≥ 8 位),不做实时强度计 (V2)。
- 认证守卫: 用 Next.js middleware 或 RSC 中 `auth.api.getSession()` 检查,未登录重定向。
