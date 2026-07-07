---

description: "Task list for 010-settings-ui (设置页与账户管理)"

---

# Tasks: 设置页与账户管理 (010-settings-ui)

**Input**: Design documents from `/specs/010-settings-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 手动浏览器验证 (与 009 模式一致)。

## Format: `- [ ] [ID] [P?] [Story?] Description`

---

## Phase 1: Setup

无新依赖。复用 001-009 栈 (Next.js 16 + tRPC v11 + Tailwind + shadcn/ui)。

---

## Phase 2: Foundational (组件)

**Purpose**: 创建设置页子组件,阻塞所有 User Story。

- [X] T001 [P] Create `src/components/settings/account-item.tsx` —— 单行账户展示: name + currency + `formatBalance(initialBalance, currency)` (import 自 `@/server/domain/account/currency`);活跃账户 (`archivedAt === null`) → "编辑"+"归档"按钮;已归档账户 → "已归档"灰色标记 + "取消归档"按钮 (不显示编辑按钮,clarify Q1);接收 `account` prop + `onEdit(id)` / `onArchive(id)` / `onUnarchive(id)` callbacks
- [X] T002 [P] Create `src/components/settings/account-form.tsx` —— 共享内联表单: `mode: "create" | "edit"` prop;create 模式 → name (text) + currency (原生 `<select>`,9 币种,默认 CNY) + initialBalance (number,元,默认 "0");edit 模式 → name + currency 仅两字段 (无 initialBalance,clarify Q2);验证: name 非空 ≤50 字 (FR-003),initialBalance 为有效数字 ≤2 位小数 (FR-005);提交时 initialBalance 按 `CURRENCY_MINOR_UNITS[currency]` 转换为分 (research Q2);接收 `onSubmit` callback + `onCancel` callback + 可选 `defaultValues` (edit 预填);"取消"按钮收起表单 (FR-009)

**Checkpoint**: 2 个子组件就绪,可组装到设置页。

---

## Phase 3: User Story 1+2 — 创建账户 + 查看列表 (Priority: P1) 🎯 MVP

**Goal**: `/settings` 显示账户列表 (活跃在前/归档在后) + 内联新建表单 + 登出按钮

**Independent Test**: 登录 → /settings → 看到账户列表 → 点"新建账户" → 填写提交 → 列表新增一行

### Implementation

- [X] T003 [US1] [US2] Replace `src/app/(app)/settings/page.tsx` —— `"use client"` 完整设置页: 调 `trpc.account.list.useQuery({ includeArchived: true })` 获取全部账户;客户端按 `archivedAt` 分区 (active 在前,archived 在后灰色标注);渲染 `AccountItem` 列表;"新建账户"按钮 toggle `showCreateForm` state → 展开 `AccountForm` (create 模式);create mutation `trpc.account.create.useMutation()` → `onSuccess`: `utils.account.list.invalidate()` + `utils.dashboard.summary.invalidate()` + 收起表单;`isLoading` 显示 `<Skeleton>` (FR-014);无账户显示"暂无账户,请先创建" (FR-013);保留底部"登出"按钮 (US5,`authClient.signOut()` → `router.push("/login")`,FR-015);mutation error 显示"网络错误,请重试" (FR-017)

**Checkpoint**: US1+US2+US5 可测 —— 列表 + 创建 + 登出完整。

---

## Phase 4: User Story 3 — 编辑账户 (Priority: P2)

**Goal**: 点活跃账户"编辑"按钮 → 展开内联表单预填 name+currency → 修改提交 → 列表刷新

**Independent Test**: 点编辑 → 表单预填 (不含初始余额) → 改名称 → 提交 → 列表显示新名称

### Implementation

- [X] T004 [US3] Update `src/app/(app)/settings/page.tsx` —— 加 `editingAccountId` state;AccountItem 的 `onEdit(id)` → `setEditingAccountId(id)` → 该行位置展开 `AccountForm` (edit 模式,`defaultValues` 取当前账户 name+currency);提交 → `trpc.account.update.useMutation({ id, name, currency })` → `onSuccess`: `utils.account.list.invalidate()` + 清除 `editingAccountId`;"取消" → 清除 `editingAccountId` 收起表单 (FR-009);已归档账户不显示编辑按钮 (已由 AccountItem 组件处理)

**Checkpoint**: US3 可测 —— 编辑 → 预填 → 修改 → 列表刷新。

---

## Phase 5: User Story 4 — 归档/取消归档 (Priority: P2)

**Goal**: 点"归档" → confirm → 账户移到归档区;点"取消归档" → 恢复活跃

**Independent Test**: 活跃账户 → 点归档 → 确认 → 移到列表下方;已归档 → 点取消归档 → 移回上方

### Implementation

- [X] T005 [US4] Update `src/app/(app)/settings/page.tsx` —— 加 `onArchive(id)` handler: `window.confirm("确认归档?此操作不影响已有交易")` → `trpc.account.archive.useMutation({ id })` → `onSuccess`: `utils.account.list.invalidate()` (列表刷新,账户自动移到归档区,SC-004);加 `onUnarchive(id)` handler (无确认): `trpc.account.unarchive.useMutation({ id })` → `onSuccess`: `utils.account.list.invalidate()`;将 `onArchive` / `onUnarchive` 传给 AccountItem

**Checkpoint**: US4 可测 —— 归档确认 → 移到下方 → 取消归档 → 移回上方。

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 验证所有 SC + 端到端 quickstart。

- [X] T006 [P] 验证 Mobile-First: iPhone SE (375px) 设置页无横向滚动 (SC-003)
- [X] T007 [P] 验证创建流程: 点"新建账户" → 填写 → 提交 → 列表更新 ≤ 30s (SC-002);首次加载 ≤ 2s (SC-001)
- [X] T008 [P] 验证归档流程: 归档 → 列表立即更新 (SC-004);登出 → 跳转 /login ≤ 1s (SC-005)
- [X] T009 Run [quickstart.md](./quickstart.md) end-to-end browser validation; tick all 5 SC items

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 无依赖,可立即开始 (无新依赖,空 phase)
- **Phase 2 (Foundational)**: 无依赖,T001+T002 可并行
- **Phase 3 (US1+US2)**: 依赖 Phase 2 (T003 使用 AccountItem + AccountForm)
- **Phase 4 (US3)**: 依赖 Phase 3 (T004 修改 page.tsx,需 T003 已创建页面)
- **Phase 5 (US4)**: 依赖 Phase 3 (T005 修改 page.tsx,需 T003 已创建页面);可与 Phase 4 并行 (不同功能,但同文件 → 建议顺序执行)
- **Phase 6 (Polish)**: 依赖所有 US 完成

### User Story Dependencies

- **US1+US2 (P1)**: 依赖 Foundational — 核心列表 + 创建
- **US3 (P2)**: 依赖 US1+US2 (在已构建的页面上加编辑功能)
- **US4 (P2)**: 依赖 US1+US2 (在已构建的页面上加归档功能)
- **US5 (P3)**: 包含在 US1+US2 中 (登出按钮在 T003 保留)

### Parallel Opportunities

- Phase 2: T001 (AccountItem) + T002 (AccountForm) 可并行 (不同文件)
- Phase 6: T006+T007+T008 可并行 (不同验证维度)

---

## MVP 范围

US1+US2 = 列表 + 创建 (核心功能,"能创建账户" MVP 标准)。US3+US4 快速跟进。US5 已包含在 MVP 中 (登出按钮保留)。

---

## Notes

- 不新增后端/表/迁移 (纯前端,复用 002-account API)
- 编辑表单仅含 name+currency (002 update API 限制,不含 initialBalance)
- 已归档账户不可编辑 (002 FR-011),AccountItem 不显示编辑按钮
- 初始余额按 `CURRENCY_MINOR_UNITS` 转换 (CNY ×100, JPY ×1)
- 归档用 `window.confirm` (MVP 简化,与 009 删除模式一致)
- 列表用 `account.list({ includeArchived: true })` 单次调用,客户端分区
- 刷新用 `utils.account.list.invalidate()` (不做乐观更新)
- 币种用原生 `<select>` (shadcn Select 未安装,YAGNI)
- 表单用 useState (不用 react-hook-form,字段少)
- `formatBalance` + `CURRENCY_MINOR_UNITS` import 自 `@/server/domain/account/currency` (纯常量,客户端可用)
