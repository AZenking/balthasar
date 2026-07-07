# Implementation Plan: 前端认证与首页

**Branch**: `007-onboarding-ui` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

## Summary

第一个前端 feature。让用户通过浏览器完成注册→登录→看首页统计→登出闭环。复用 001-006 后端 API,新增 Next.js App Router 页面 + Better-Auth client SDK + tRPC client hooks + shadcn/ui 组件 + 底部导航。

## Technical Context

**Language/Version**: TypeScript 5.7+ / Next.js 16 App Router — 与 001-006 一致

**Primary Dependencies** (需新增):
- `react-hook-form` — 表单管理 (注册/登录)
- `@hookform/resolvers` — zod resolver for RHF
- shadcn/ui 组件 (Button, Input, Card, Label, Skeleton, Toast) — 已有 Tailwind,通过 CLI add
- 无其他新 npm 包 (复用 Better-Auth client + tRPC client)

**Testing**: 手动浏览器验证 (MVP 前端不强制自动化测试;Vitest Testing Library 仅测关键组件交互)

**Performance Goals**: /dashboard 加载 ≤ 2s (含 API);Mobile-First 375px 无横向滚动

## Constitution Check

| # | 原则 | 状态 | 备注 |
|---|---|---|---|
| 一 MVP Scope | ✅ | 认证页面 + Dashboard + App Shell 在 MVP 范围 |
| 二 Feature-Sliced | ✅ | 页面按 App Router 路由组织;组件按功能切 |
| 三 DDD | ✅ | 纯前端,复用后端聚合 |
| 四 Test-First | ✅ | 关键组件用 Vitest + Testing Library |
| 五 Performance | ✅ | RSC 优先 (dashboard.summary server-side),减少客户端 JS |
| 六 YAGNI | ✅ | 不做暗色模式/i18n/动画/PWA;占位页极简 |

**Gate Result**: ✅ ALL PASS。

## Project Structure

```text
src/
├── app/
│   ├── layout.tsx                    # 更新: 加 tRPC Provider + QueryClient
│   ├── page.tsx                      # 更新: 根路由 → 重定向 /login 或 /dashboard
│   ├── (auth)/                       # 路由组: 未认证可见
│   │   ├── login/page.tsx            # 新增: 登录页
│   │   └── register/page.tsx         # 新增: 注册页
│   ├── (app)/                        # 路由组: 需认证 (含 App Shell layout)
│   │   ├── layout.tsx                # 新增: 底部导航 + auth guard
│   │   ├── dashboard/page.tsx        # 新增: 首页统计
│   │   ├── transactions/page.tsx     # 新增: 占位 "即将上线"
│   │   ├── transaction/new/page.tsx  # 新增: 占位
│   │   └── settings/page.tsx         # 新增: 设置 + 登出
│   └── providers.tsx                 # 新增: tRPC Provider + QueryClientProvider
├── components/
│   ├── ui/                           # shadcn/ui 组件 (Button, Input, Card 等)
│   ├── bottom-nav.tsx                # 新增: 底部导航栏
│   └── dashboard/
│       ├── summary-cards.tsx         # 新增: 收支卡片
│       ├── recent-transactions.tsx   # 新增: 最近交易列表
│       └── category-breakdown.tsx    # 新增: 分类占比
└── lib/
    ├── auth/
    │   └── hooks.ts                  # 新增: useSession() 客户端 hook
    └── validators/
        ├── login.ts                  # 新增: zod schema
        └── register.ts               # 新增: zod schema
```

## Complexity Tracking

无。
