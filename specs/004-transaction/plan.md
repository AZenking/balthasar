# Implementation Plan: 交易管理

**Branch**: `004-transaction` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-transaction/spec.md`

## Summary

实现家庭记账系统的交易 CRUD —— PRD "10 秒记账" 核心热路径。已认证用户在默认家庭下,对已存在的账户 + 内置分类创建/查询/编辑/删除交易。amount 用 **signed bigint** (income 正、expense 负,Clarification Q1) 存储,聚合 `SUM(amount)` 直接得净额。所有操作写入 `transaction_events` 审计表。

本 feature 依赖前置 001-auth-family (认证 + 家庭) + 002-account (账户选择) + 003-category (分类选择)。仅新增 `transactions` + `transaction_events` 两张表与 `transactionRouter`。

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 20 LTS (Next.js 16 App Router) — 与 001/002/003 一致

**Primary Dependencies** (复用前三个 feature 安装的):
- `next` `^16.0.0`、`@trpc/server` `^11.0.0`、`drizzle-orm` `^0.39.0`、`pg` `^8.13.1`、`zod` `^3.24.0`、`uuidv7` `^1.0.2`
- 无新依赖

**Storage**: PostgreSQL 16 (复用 001 的实例与 `db` 客户端单例)

**Testing**:
- 单元: Vitest (validate 纯函数: amount 符号转换、occurredAt 范围)
- Procedure 契约: Vitest + `createCaller`,mock db queries
- 集成: Vitest + testcontainers,验证跨家庭隔离 + type/category 匹配 + 审计写入

**Target Platform**: Docker / Linux x64 (生产);macOS / Linux 本地开发

**Project Type**: Full-stack web app (Next.js App Router) — 复用 001 的 Next.js 工程

**Performance Goals**:
- `transaction.create` mutation p95 < 300ms (FR-017,SC-002)
- `transaction.get` query p95 < 100ms (FR-017,SC-003)
- `transaction.update` p95 < 300ms (含审计 + accountId 校验)

**Constraints**:
- `familyId` 服务端派生 (FR-007,与 002 一致)
- `amount` 服务端按 type 决定符号 (FR-004,Clarification Q1)
- `accountId` 校验: 属于当前家庭 + 未归档 (FR-005)
- `categoryId` 校验: 存在 + type 与交易 type 匹配 (FR-006)
- `occurredAt`: UTC 存储,≤ now + 1 day (FR-008,Clarification Q2)
- 跨家庭 account → 400 (FR-015);跨家庭 transaction → 404 (FR-014)
- 删除: 硬删除 (FR-013,与 002 account 归档决策不同)
- 并发: LWW (Clarification Q3)

**Scale/Scope**: MVP 单实例,< 1000 用户,~100 交易/家庭/月 (~1200 行/年);水平扩展延后 V2。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

逐条核对 `.specify/memory/constitution.md` v2.0.0:

| # | 原则 | 状态 | 备注 |
|---|---|---|---|
| 一 | MVP Scope (NON-NEGOTIABLE) | ✅ PASS | 交易 CRUD 在 MVP 范围 (`docs/MVP.md`)。明确排除: transfer/批量/附件/标签/周期交易/软删除 |
| 二 | Feature-Sliced (tRPC + Next.js App Router) | ✅ PASS | 新增 `src/server/api/routers/transaction.ts` 单 router,挂在 `appRouter.transaction`;查询模块 `src/server/db/queries/transaction.ts` |
| 三 | Domain-Driven Design | ✅ PASS | `Transaction` 是 `Family` 聚合下的实体 (聚合根仍是 Family);跨聚合引用 `transaction.familyId` / `transaction.accountId` / `transaction.categoryId` 用 ID |
| 四 | Test-First (NON-NEGOTIABLE) | ✅ PASS | 单元 + procedure 契约 + 集成 (testcontainers real Postgres) |
| 五 | Performance & Fast Input | ✅ PASS | create p95 < 300ms 目标,索引 `(family_id, occurred_at DESC)` 支撑列表与详情 |
| 六 | Simplicity (YAGNI) | ✅ PASS | 拒绝 transfer/批量/附件/标签/周期/软删除;signed bigint 简化聚合;LWW 无 version 字段 |

**Gate Result**: ✅ ALL PASS。无 Complexity Tracking 项。

## Project Structure

### Documentation (this feature)

```text
specs/004-transaction/
├── spec.md
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出 (README)
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
│   │       ├── account.ts           # 002 已存在
│   │       ├── category.ts          # 003 已存在
│   │       └── transaction.ts       # 本 feature 新增 (4 procedures)
│   ├── db/
│   │   ├── schema/
│   │   │   ├── transaction.ts           # 新增
│   │   │   ├── transaction-events.ts    # 新增
│   │   │   └── index.ts                 # 更新:追加 export
│   │   ├── migrations/
│   │   │   └── 0004_transactions.sql    # drizzle-kit generate
│   │   └── queries/
│   │       └── transaction.ts           # 新增:含 JOIN 查询
│   └── domain/
│       └── transaction/
│           └── validate.ts          # 新增:amount 符号转换 / occurredAt 校验
└── tests/
    ├── unit/server/domain/transaction/
    │   └── validate.test.ts
    ├── procedure/transaction.test.ts
    └── integration/transaction/
        ├── create.test.ts           # US1 (含 type/category 匹配 + 跨家庭 account)
        ├── get.test.ts              # US2 (含 JOIN 字段 + 404)
        ├── update.test.ts           # US3 (含 LWW + 跨家庭 NOT_FOUND)
        └── delete.test.ts           # US4 (含硬删除 + 重复 404)
```

**Structure Decision**: 复用 001/002/003 的 `src/` 工程结构。新增按 feature 切 (宪章二):
- 1 个 router 文件 (`transaction.ts`) 暴露 4 个 procedure (create/get/update/delete)
- 2 个 schema 文件 (`transaction.ts` + `transaction-events.ts`) 定义 2 张表
- 1 个 query 模块 (`transaction.ts`) 含 JOIN 查询 (取 accountName + categoryName)
- 1 个 domain 模块 (`transaction/validate.ts`) 存放纯函数 (符号转换 + 时间校验)

## Complexity Tracking

无。所有原则通过,无需豁免。
