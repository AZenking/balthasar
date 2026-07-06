# Implementation Plan: 账户管理

**Branch**: `002-account` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-account/spec.md`

## Summary

为已认证用户提供账户 (Account) 管理:创建 (名称 + ISO 4217 币种 + 初始余额)、查看列表 (默认排除已归档)、编辑名称/币种、归档/取消归档 (软删除)。所有操作限定在当前 session 用户家庭内,跨家庭访问统一返回 404 (信息泄漏防御)。账户操作 (创建/编辑/归档/取消归档) 写入新表 `account_events` (与 `auth_events` 解耦)。

本 feature 是 002-account,前置 feature `001-auth-family` 提供认证与家庭上下文。本 feature 不破坏 001 schema,仅新增 `accounts` + `account_events` 两张表与 `accountRouter` (挂在 `appRouter` 下,与 `authRouter` 并列)。

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 20 LTS (Next.js 16 App Router) — 与 001 一致

**Primary Dependencies** (复用 001 安装的):
- `next` `^16.0.0`、`@trpc/server` `^11.0.0`、`drizzle-orm` `^0.39.0`、`pg` `^8.13.1`、`zod` `^3.24.0`、`uuidv7` `^1.0.2`
- 无需新增 npm 依赖 (本 feature 仅在已有栈上加表 + router)

**Storage**: PostgreSQL 16 (复用 001 的实例与 `db` 客户端单例)

**Testing**:
- 单元: Vitest (currency validate / name validate / familyId resolution 纯函数)
- Procedure 契约: Vitest + `createCaller`,mock db queries
- 集成: Vitest + testcontainers,真实 Postgres,跨家庭隔离 / 归档幂等等场景

**Target Platform**: Docker / Linux x64 (生产);macOS / Linux 本地开发

**Project Type**: Full-stack web app (Next.js App Router) — 复用 001 的 Next.js 工程

**Performance Goals**:
- `account.create` / `account.update` mutation p95 < 300ms
- `account.list` query p95 < 200ms (FR-014,SC-002;单家庭 < 100 账户)
- `account_events` 查询 (本 feature 暂不暴露查询接口,V2 评估) 不设定目标

**Constraints**:
- `familyId` 服务端派生 (FR-006,拒绝客户端传入)
- 跨家庭访问返回 404 (FR-012,不区分"不存在"与"无权限")
- 已归档账户不可编辑 (FR-011)
- 初始余额一旦设定不可修改 (FR-009 + SC-007)
- 余额以整数分 (`bigint`) 存储 (Q2)

**Scale/Scope**: MVP 单实例,< 1000 用户,< 100 账户/家庭;水平扩展延后 V2。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

逐条核对 `.specify/memory/constitution.md` v2.0.0:

| # | 原则 | 状态 | 备注 |
|---|---|---|---|
| 一 | MVP Scope (NON-NEGOTIABLE) | ✅ PASS | 账户 CRUD + 归档均属 MVP 范围 (`docs/MVP.md`)。明确排除: 私有账户 (V2)、硬删除 (V2)、汇率换算 (V2) |
| 二 | Feature-Sliced (tRPC + Next.js App Router) | ✅ PASS | 新增 `src/server/api/routers/account.ts` 单 router 文件,挂在 `appRouter.account`;查询模块 `src/server/db/queries/account.ts` |
| 三 | Domain-Driven Design | ✅ PASS | `Account` 是 `Family` 聚合下的实体 (聚合根仍是 Family);跨聚合引用 `account.familyId` 用 ID;`account_events` 是 Account 聚合的审计日志 |
| 四 | Test-First (NON-NEGOTIABLE) | ✅ PASS | 单元 (currency/name 纯函数) + procedure 契约 (createCaller) + 集成 (testcontainers 真实 Postgres) |
| 五 | Performance & Fast Input | ✅ PASS | procedure p95 < 200ms 目标,索引 `(family_id, archived_at)` 支撑列表查询 |
| 六 | Simplicity (YAGNI) | ✅ PASS | 拒绝私有账户 / 汇率换算 / 硬删除 / 多币种汇率缓存;新建独立 `account_events` 表 vs 复用 `auth_events` 由 Clarification Q1 决定 (已选独立表) |

**Gate Result**: ✅ ALL PASS。无 Complexity Tracking 项。

## Project Structure

### Documentation (this feature)

```text
specs/002-account/
├── spec.md              # /speckit-specify 输出 (已存在)
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出 (README 说明 tRPC 类型推断)
│   └── README.md
└── tasks.md             # Phase 2 输出 (/speckit-tasks)
```

### Source Code (新增到现有 `src/`)

```text
src/
├── server/
│   ├── api/
│   │   └── routers/
│   │       ├── auth.ts              # 001 已存在
│   │       └── account.ts           # 本 feature 新增 (5 procedures)
│   ├── db/
│   │   ├── schema/
│   │   │   ├── account.ts           # 新增
│   │   │   ├── account-events.ts    # 新增
│   │   │   └── index.ts             # 更新:追加 export
│   │   ├── migrations/
│   │   │   └── 0002_accounts.sql    # drizzle-kit generate 产出
│   │   └── queries/
│   │       └── account.ts           # 新增:账户查询 + familyId 反查
│   └── domain/
│       └── account/
│           ├── currency.ts          # 新增:ISO 4217 白名单 + minor units
│           └── validate.ts          # 新增:name / initialBalance / 等纯函数
├── app/                              # 本 feature 暂无新页面 (前端在 007-onboarding-ui)
└── tests/
    ├── unit/server/domain/account/
    │   ├── currency.test.ts
    │   └── validate.test.ts
    ├── procedure/account.test.ts    # 6 个 procedure 契约测试
    └── integration/account/
        ├── create.test.ts           # SC-005 (跨家庭隔离)、并发同名
        ├── list.test.ts             # includeArchived / 排序
        ├── update.test.ts           # 初始余额只读、归档不可编辑
        └── archive.test.ts          # 归档/取消归档幂等 (SC-004)
```

**Structure Decision**: 复用 001 的 `src/` 工程结构。新增按 feature 切 (宪章二):
- 1 个 router 文件 (`account.ts`) 暴露 5 个 procedure
- 1 个 schema 文件 (`account.ts` + `account-events.ts`) 定义 2 张表
- 1 个 query 模块 (`account.ts`) 复用 Drizzle 客户端
- 1 个 domain 模块 (`account/`) 存放纯函数 (currency validate 等)

## Complexity Tracking

无。所有原则通过,无需豁免。
