---

description: "Task list for 007-onboarding-ui (前端认证 + Dashboard)"

---

# Tasks: 前端认证与首页 (007-onboarding-ui)

**Input**: Design documents from `/specs/007-onboarding-ui/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/README.md, research.md, quickstart.md

**Tests**: 手动浏览器验证 (MVP 前端不强制自动化)。

## Format: `- [ ] [ID] [P?] [Story?] Description`

---

## Phase 1: Setup

- [X] T001 安装前端依赖: `react-hook-form` + `@hookform/resolvers` in `package.json`
- [X] T002 通过 shadcn CLI 安装组件: `button input label card skeleton sonner` into `src/components/ui/`
- [X] T003 [P] Add `tailwindcss-animate` plugin to `tailwind.config.ts` (shadcn 依赖,用于 skeleton/toast 动画)

---

## Phase 2: Foundational (跨 US 共享前置)

**⚠️ CRITICAL**: 此阶段未完成,US1-US4 均无法启动

- [X] T004 Create `src/app/providers.tsx` —— tRPC Provider + QueryClientProvider 包裹整个 app,用 `"use client"`
- [X] T005 Update `src/app/layout.tsx` —— 在 `<body>` 内包裹 `<Providers>` (T004)
- [X] T006 Update `src/app/page.tsx` —— 根路由: 服务端检查 session,有 → redirect /dashboard,无 → redirect /login
- [X] T007 [P] Create `src/lib/validators/register.ts` —— zod schema: email (isPlausibleEmail) + password (min 8) + confirmPassword (refine 一致)
- [X] T008 [P] Create `src/lib/validators/login.ts` —— zod schema: email + password (min 1, 不校验强度)
- [X] T009 Create `src/app/(app)/layout.tsx` —— RSC auth guard: `auth.api.getSession()`,无 session → `redirect('/login')`;有 → 渲染 children + `<BottomNav>`
- [X] T010 [P] Create `src/components/bottom-nav.tsx` —— 底部 4-tab 导航 (首页/流水/记账/设置),当前页高亮,Mobile-First 固定底部,用 shadcn Button + lucide icons

**Checkpoint**: Providers + auth guard + 底部导航就绪。

---

## Phase 3: User Story 1 — 注册 (Priority: P1)

**Goal**: 新用户在 /register 提交邮箱+密码+确认密码,自动登录跳转 /dashboard

### Implementation for User Story 1

- [X] T011 [US1] Create `src/app/(auth)/register/page.tsx` —— 注册表单页面: RHF + zod (T007),调 `authClient.signUpEmail({ email, password, name })`,成功 `router.push('/dashboard')`,失败显示 toast (409 = 已注册)
- [X] T012 [US1] Create `src/app/(auth)/layout.tsx` —— 认证页面共享 layout (居中卡片样式,无底部导航),已登录 → redirect /dashboard
- [X] T013 [US1] Add "去注册" / "去登录" 导航链接: `/login` 页底部加链接到 `/register`,`/register` 页底部加链接到 `/login`

**Checkpoint**: US1 独立可测 —— 注册 → 自动登录 → /dashboard。

---

## Phase 4: User Story 2 — 登录 (Priority: P1)

**Goal**: 已注册用户在 /login 输入凭证,跳转 /dashboard

### Implementation for User Story 2

- [X] T014 [US2] Create `src/app/(auth)/login/page.tsx` —— 登录表单页面: RHF + zod (T008),调 `authClient.signInEmail({ email, password })`,成功 `router.push('/dashboard')`,失败显示 toast (401 = 凭证错,423 = 锁定含剩余时间)

**Checkpoint**: US2 独立可测 —— 登录 → /dashboard。

---

## Phase 5: User Story 3 — Dashboard (Priority: P1)

**Goal**: /dashboard 显示当月收支 + 最近交易 + 分类占比

### Implementation for User Story 3

- [X] T015 [P] [US3] Create `src/components/dashboard/summary-cards.tsx` —— 3 卡片 (收入/支出/结余),接收 props `{ monthIncome, monthExpense, monthNet }`,Mobile-First 横向排列
- [X] T016 [P] [US3] Create `src/components/dashboard/recent-transactions.tsx` —— 最近交易列表,接收 `Transaction[]` props,每项显示 icon+金额+分类+账户+备注+相对时间;空 → "暂无交易";loading → Skeleton
- [X] T017 [P] [US3] Create `src/components/dashboard/category-breakdown.tsx` —— 支出分类占比,接收 `CategoryBreakdown[]` props,每项 icon+名称+金额+百分比条;空 → "暂无支出"
- [X] T018 [US3] Create `src/app/(app)/dashboard/page.tsx` —— `"use client"` 页面,`trpc.dashboard.summary.useQuery()` 获取数据,loading 显示 Skeleton,渲染 SummaryCards + RecentTransactions + CategoryBreakdown

**Checkpoint**: US3 独立可测 —— /dashboard 显示完整首页数据。

---

## Phase 6: User Story 4 — 登出 + App Shell (Priority: P2)

**Goal**: 用户通过底部导航切换页面,可以登出

### Implementation for User Story 4

- [X] T019 [US4] Create `src/app/(app)/settings/page.tsx` —— 设置页 (MVP 简版): 显示用户邮箱 + "登出"按钮,点击调 `authClient.signOut()` + `router.push('/login')`
- [X] T020 [P] [US4] Create `src/app/(app)/transactions/page.tsx` —— 占位页: 居中显示"即将上线"
- [X] T021 [P] [US4] Create `src/app/(app)/transaction/new/page.tsx` —— 占位页: 居中显示"即将上线"

**Checkpoint**: US4 独立可测 —— 底部导航 4 tab 可切换,登出功能正常。

---

## Phase 7: Polish

- [X] T022 [P] 验证 Mobile-First: iPhone SE (375px) 所有页面无横向滚动 (SC-004)
- [X] T023 [P] 验证错误处理: 网络断开 / 后端 500 → 显示友好提示不崩溃
- [X] T024 [P] 验证 session 过期: 手动删 cookie → 下次请求 401 → 自动跳 /login
- [X] T025 Run [quickstart.md](./quickstart.md) end-to-end browser validation; tick all 6 SC items
- [X] T026 Final review: 页面布局美观 (Mobile-First, 简洁, 无多余空白)

---

## Dependencies & Execution Order

- Phase 1 (T001-T003) → Phase 2 (T004-T010) → Phase 3-6 (US1-US4)
- US1 (注册) + US2 (登录) 可并行 (不同页面文件)
- US3 (Dashboard) 依赖 US1/US2 (需登录才能看到 dashboard)
- US4 (登出+App Shell) 依赖 Phase 2 BottomNav (T010)
- Polish 依赖所有 US

## MVP 范围

US1+US2+US3 = 完整闭环 (注册→登录→看首页)。US4 作为快速跟进。

## Notes

- 前端 feature,复用 001-006 后端 API,无新表/迁移
- Better-Auth client (`authClient`) 用于浏览器端 auth 操作 (cookie 自动管理)
- tRPC client (`trpc.dashboard.summary.useQuery()`) 用于数据获取
- RSC auth guard: `(app)/layout.tsx` 中 `auth.api.getSession()` + redirect
- Mobile-First: 底部导航固定,375px 无横向滚动
