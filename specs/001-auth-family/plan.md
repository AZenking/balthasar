# Implementation Plan: 用户认证与默认家庭初始化

**Branch**: `001-auth-family` | **Date**: 2026-07-06 (v2.0.0 T3 重写) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-auth-family/spec.md`

## Summary

实现家庭记账系统的认证与家庭初始化闭环,采用 T3 Stack (Next.js App Router + tRPC + Better-Auth + Drizzle)。新用户提交邮箱+密码注册 → Better-Auth 创建 user record → 在同一 transaction 内创建 `Family` + `Member` → Better-Auth 自动建立 session 并签发 cookie (30 天滑动续期)。配套实现:登录失败锁定 (5 次/邮箱/5 分钟,自定义 hook,因 Better-Auth 默认限流按 IP)、注册 IP 限流 (Better-Auth rate-limit 插件)、关键安全事件审计日志 (Better-Auth events hook → 自建 `auth_events` 表)、密码策略 (Better-Auth password 插件 + 自定义强度规则,NIST 800-63B)。

Better-Auth 接管:user、session、verification、account 四张表;cookie 与 CSRF;基础登录/登出/会话查询。本 feature 在其上叠加业务聚合 (Family/Member)、自定义锁定逻辑、审计写入、IP 限流配置。

## Technical Context

**Language/Version**: TypeScript 5.4+ / Node.js 20 LTS (Next.js 14+ App Router)

**Primary Dependencies**:
- `next` `^14.x` (App Router 全栈)
- `@trpc/server` `^11.x`, `@trpc/client` `^11.x`, `@trpc/react-query` `^11.x`
- `@trpc/next` `^11.x` (App Router 集成)
- `superjson` `^2.x` (tRPC transformer,支持 Date/Map)
- `better-auth` `^1.x` (认证库)
- `drizzle-orm` `^0.30.x` + `drizzle-kit` `^0.20.x`
- `pg` `^8.x` (Postgres 驱动)
- `zod` `^3.x` (procedure 输入校验)
- `@tanstack/react-query` `^5.x` (tRPC 客户端底层)
- `bcrypt` `^5.x` (仅作 fallback;Better-Auth 默认 scrypt)
- `testcontainers` `^10.x`
- `vitest` `^1.x`

**Storage**: PostgreSQL 16 (单一真相源,无 Redis)

**Testing**:
- 单元: Vitest,纯领域函数,tRPC procedure 通过 `createCaller` 调用
- 集成: Vitest + testcontainers,真实 Postgres (禁止 mock Drizzle)
- 组件: Vitest + Testing Library (本 feature 暂无关键 UI,US1-US4 主要是后端 procedure;前端页面是后续 `002-onboarding-ui` feature)

**Target Platform**: Docker 容器 / Linux x64 (生产);macOS / Linux 本地开发

**Project Type**: Full-stack web app (Next.js App Router)

**Performance Goals**:
- `auth.register` / `auth.login` mutation p95 < 300ms (warm,服务端)
- `auth.me` query p95 < 100ms
- `auth.auditEvents` query (按邮箱查最近 30 天) p95 < 5s (SC-010)

**Constraints**:
- 30 天滑动会话 (FR-008) — Better-Auth session 配置
- 5 次/邮箱 登录锁定 (FR-009) — 自定义 hook
- 10 次/小时/IP 注册限流 (FR-018) — Better-Auth rate-limit 插件
- 密码哈希禁止 MD5/SHA1/明文 (FR-013) — Better-Auth 默认 scrypt 满足
- 单次事务原子写 Family + Member (FR-004) — Better-Auth `after` 钩子内 + Drizzle transaction

**Scale/Scope**: MVP 单实例部署,预期 < 1000 用户;水平扩展延后 V2。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

逐条核对 `.specify/memory/constitution.md` v2.0.0:

| # | 原则 | 状态 | 备注 |
|---|---|---|---|
| 一 | MVP Scope (NON-NEGOTIABLE) | ✅ PASS | 登录、默认家庭、单成员均在 MVP 范围内 |
| 二 | Feature-Sliced (tRPC + Next.js) | ✅ PASS | 见 Project Structure: 按 feature 切 router 文件,无 NestJS Controller/Service 模式 |
| 三 | Domain-Driven Design | ✅ PASS | `Family` 为聚合根;Better-Auth 的 user/session/verification/account 与业务聚合解耦,通过 `Family.ownerUserId` 引用 |
| 四 | Test-First (NON-NEGOTIABLE) | ✅ PASS | Vitest + testcontainers,procedure 测试用 createCaller,真实 Postgres 集成测试 |
| 五 | Performance & Fast Input | ✅ PASS | procedure p95 < 300ms 目标;Server Components 减客户端 JS |
| 六 | Simplicity (YAGNI) | ✅ PASS | 拒绝手写 REST 契约、拒绝独立 Controller/Service/Repository 三层,直接 tRPC procedure + 函数导入 |

**Gate Result**: ✅ ALL PASS。无 Complexity Tracking 项。

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-family/
├── spec.md              # /speckit-specify 输出
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出 (仅 README,实际契约由 tRPC 类型推断)
│   └── README.md
└── tasks.md             # Phase 2 输出 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # 根 layout,引入 tRPC Provider
│   ├── page.tsx                      # 首页 (登录/未登录态)
│   ├── (auth)/                       # 路由组: 未登录可见
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── api/
│       ├── auth/
│       │   └── [...all]/route.ts     # Better-Auth handler 挂载
│       └── trpc/
│           └── [trpc]/route.ts       # tRPC API 入口 (fetchRequestHandler)
├── server/                           # 后端逻辑全部在此
│   ├── api/
│   │   ├── root.ts                   # tRPC root router: appRouter
│   │   ├── trpc.ts                   # createTRPCContext + router 工厂
│   │   └── routers/
│   │       ├── auth.ts               # 本 feature 主 router
│   │       └── (后续 feature 在此扩展)
│   ├── auth/
│   │   ├── config.ts                 # Better-Auth 配置 (session、rate-limit、hooks)
│   │   ├── client.ts                 # createAuthClient (browser 调用)
│   │   └── hooks/
│   │       ├── lockout.hook.ts       # FR-009 自定义锁定逻辑
│   │       ├── audit.hook.ts         # FR-016 审计事件写入
│   │       └── family-init.hook.ts   # FR-004/005 注册后建 Family+Member
│   ├── db/
│   │   ├── client.ts                 # Drizzle 客户端单例
│   │   ├── schema/                   # Drizzle schema (随 feature 演进)
│   │   │   ├── auth.ts               # Better-Auth 必需表 (user/session/verification/account)
│   │   │   ├── family.ts             # 业务聚合根
│   │   │   ├── member.ts
│   │   │   ├── auth-events.ts        # 自建审计表
│   │   │   ├── auth-failure-counters.ts
│   │   │   └── registration-ip-counters.ts
│   │   └── migrations/               # Drizzle Kit 生成的 .sql
│   └── domain/                       # 纯领域函数 (无 IO,无 next/tRPC 依赖)
│       └── auth/
│           ├── password-policy.ts    # NIST 800-63B 长度 + 黑名单
│           ├── lockout-policy.ts      # 5/5min 决策
│           └── email-normalize.ts
├── lib/                              # 前后端共享工具
│   ├── env.ts                        # zod 校验环境变量 (server + client)
│   ├── utils.ts                      # cn() 等小工具
│   └── trpc/
│       ├── client.ts                 # createTRPCReact (browser hooks)
│       ├── server.ts                 # server 端 caller (RSC 内调用)
│       └── query-client.ts
├── components/                       # React 组件 (本 feature 暂无关键 UI)
└── tests/
    ├── unit/
    │   └── server/domain/auth/
    │       ├── password-policy.test.ts
    │       ├── lockout-policy.test.ts
    │       └── email-normalize.test.ts
    ├── procedure/                    # tRPC procedure 契约测试
    │   └── auth.test.ts              # createCaller 调用,无 DB
    └── integration/                  # 真实 Postgres
        └── auth/
            ├── register.test.ts
            ├── login-lockout.test.ts
            ├── logout.test.ts
            ├── session-expiry.test.ts
            └── audit-events.test.ts
```

**Structure Decision**: 单 `src/` 工程 (T3 Stack 默认布局)。`src/server/` 是后端全部,`src/app/` 是 Next.js 路由 + UI,`src/components/` 是共享 React 组件。后端内部按"功能域"分文件,无强分层。Better-Auth 配置在 `src/server/auth/`,业务级钩子 (锁定、审计、建家庭) 各自独立文件便于测试。

## Complexity Tracking

无。所有原则通过,无需豁免。
