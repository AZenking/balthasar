# Data Model: 007-onboarding-ui

**Date**: 2026-07-07

不新增后端表。纯前端 feature —— 页面 + 组件 + 客户端 hooks。

## 页面结构

```
/ (根)
├── 未登录 → redirect /login
└── 已登录 → redirect /dashboard

(auth)/ (未认证路由组, 无 App Shell)
├── /login         — 登录表单
└── /register      — 注册表单

(app)/ (已认证路由组, 含 App Shell + 底部导航)
├── layout.tsx     — auth guard + 底部导航
├── /dashboard     — 首页统计
├── /transactions  — 占位 "即将上线"
├── /transaction/new — 占位
└── /settings      — 设置 + 登出
```

## 组件清单

| 组件 | 路径 | 用途 |
|---|---|---|
| Providers | `src/app/providers.tsx` | tRPC + QueryClient 客户端 Provider |
| BottomNav | `src/components/bottom-nav.tsx` | 底部 4-tab 导航 |
| SummaryCards | `src/components/dashboard/summary-cards.tsx` | 收入/支出/结余 3 卡片 |
| RecentTransactions | `src/components/dashboard/recent-transactions.tsx` | 最近 5 笔列表 |
| CategoryBreakdown | `src/components/dashboard/category-breakdown.tsx` | 支出分类占比 |
| shadcn/ui | `src/components/ui/*` | Button/Input/Card/Label/Skeleton/Sonner |

## 认证流程

```
用户访问任意 URL
  ↓
RSC layout 检查 auth.api.getSession()
  ├─ 无 session → redirect('/login')
  └─ 有 session → 渲染页面 (dashboard 数据 via tRPC useQuery)

登录/注册页
  ├─ Better-Auth client signInEmail/signUpEmail
  ├─ 成功 → router.push('/dashboard')
  └─ 失败 → 显示错误 toast
```

## 后端 API 调用

| 页面/操作 | 调用 |
|---|---|
| 登录 | `authClient.signInEmail({ email, password })` |
| 注册 | `authClient.signUpEmail({ email, password, name })` |
| 登出 | `authClient.signOut()` |
| Dashboard | `trpc.dashboard.summary.useQuery()` |
| 认证检查 | `auth.api.getSession()` (RSC server) |
