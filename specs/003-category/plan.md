# Implementation Plan: 分类管理

**Branch**: `003-category` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-category/spec.md`

## Summary

实现家庭记账系统的"内置分类字典": 一份系统启动时通过迁移种子注入的、所有家庭共享的分类列表,包含约 22 个常见分类 (12 支出 + 8 收入 + 2 其他)。提供只读查询接口 (`category.list` 含 type 过滤 + `category.get` 单查)。本 feature 是后续 `004-transaction` 的前置依赖。

**MVP 范围精简**: 与 001-auth-family (CRUD) 和 002-account (CRUD + 归档) 不同,本 feature **仅 read-only** —— 无写入操作,无审计表,无家庭级隔离 (所有家庭看到同一份)。这显著降低实施成本。

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 20 LTS (Next.js 16 App Router) — 与 001/002 一致

**Primary Dependencies** (复用前两个 feature 安装的):
- `next` `^16.0.0`、`@trpc/server` `^11.0.0`、`drizzle-orm` `^0.39.0`、`pg` `^8.13.1`、`zod` `^3.24.0`、`uuidv7` `^1.0.2`
- 新增: `uuid` (UUID v5 确定性生成,复用 npm `uuid` 包,与 `uuidv7` 同包家族)
- 无其他新依赖

**Storage**: PostgreSQL 16 (复用 001 的实例与 `db` 客户端单例)

**Testing**:
- 单元: Vitest (`type` 枚举 / `formatCategoryForDisplay` 纯函数)
- Procedure 契约: Vitest + `createCaller`,mock db queries
- 集成: Vitest + testcontainers,验证 seed 幂等性 + type 过滤 + 排序

**Target Platform**: Docker / Linux x64 (生产);macOS / Linux 本地开发

**Project Type**: Full-stack web app (Next.js App Router) — 复用 001 的 Next.js 工程

**Performance Goals**:
- `category.list` query p95 < 100ms (FR-012,SC-004;内置 < 30 条)
- `category.get` query p95 < 50ms

**Constraints**:
- 内置分类数据通过**迁移 SQL seed**注入 (而非运行时 JS 脚本),保证幂等 + 跨环境一致
- 内置分类 ID 用 UUID v5 (基于 `name + type` 命名空间),保证确定性
- 内置分类不可被修改或删除 (DB 层无 UPDATE/DELETE 接口;迁移不写 UPDATE)
- 共享数据,无 `family_id` 字段
- `type` 严格 ∈ {`income`, `expense`}

**Scale/Scope**: 内置分类 < 30 条,常驻索引,任意规模家庭都瞬时返回。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

逐条核对 `.specify/memory/constitution.md` v2.0.0:

| # | 原则 | 状态 | 备注 |
|---|---|---|---|
| 一 | MVP Scope (NON-NEGOTIABLE) | ✅ PASS | 内置分类查询在 MVP 范围 (`docs/MVP.md`)。明确排除: 用户自定义分类 (V2)、CRUD、父子分类、合并、i18n |
| 二 | Feature-Sliced (tRPC + Next.js App Router) | ✅ PASS | 新增 `src/server/api/routers/category.ts` 单 router 文件,挂在 `appRouter.category`;查询模块 `src/server/db/queries/category.ts` |
| 三 | Domain-Driven Design | ✅ PASS | Category 是与 Family 并列的聚合 (而非 Family 内部实体),通过 ID 引用。无 family_id 字段 |
| 四 | Test-First (NON-NEGOTIABLE) | ✅ PASS | 单元 (type/format 纯函数) + procedure 契约 (createCaller) + 集成 (testcontainers 真实 Postgres) |
| 五 | Performance & Fast Input | ✅ PASS | procedure p95 < 100ms 目标,索引 `(type, sort_order, name)` 支撑 list 查询 |
| 六 | Simplicity (YAGNI) | ✅ PASS | read-only 字典,无 CRUD / 审计 / 自定义 / i18n。复用 002 schema 模式 |

**Gate Result**: ✅ ALL PASS。无 Complexity Tracking 项。

## Project Structure

### Documentation (this feature)

```text
specs/003-category/
├── spec.md              # /speckit-specify 输出
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出
│   └── README.md
└── tasks.md             # Phase 2 输出 (/speckit-tasks)
```

### Source Code (新增到现有 `src/`)

```text
src/
├── server/
│   ├── api/
│   │   └── routers/
│   │       ├── auth.ts                # 001 已存在
│   │       ├── account.ts             # 002 已存在
│   │       └── category.ts            # 本 feature 新增 (2 procedures)
│   ├── db/
│   │   ├── schema/
│   │   │   ├── category.ts            # 新增
│   │   │   └── index.ts               # 更新:追加 export
│   │   ├── migrations/
│   │   │   └── 0003_categories.sql    # drizzle-kit generate + 手写 seed INSERT
│   │   └── queries/
│   │       └── category.ts            # 新增:findAll / findById
│   └── domain/
│       └── category/
│           └── format.ts              # 新增:formatCategoryForDisplay 纯函数
└── tests/
    ├── unit/server/domain/category/
    │   └── format.test.ts
    ├── procedure/category.test.ts     # 4-5 个契约测试
    └── integration/category/
        ├── list.test.ts               # type 过滤 + 排序 + 跨家庭一致
        ├── get.test.ts                # 单查 + 404
        └── seed.test.ts               # seed 幂等 + ID 稳定性 (SC-005)
```

**Structure Decision**: 复用 001/002 的 `src/` 工程结构。新增按 feature 切 (宪章二):
- 1 个 router 文件 (`category.ts`) 暴露 2 个 procedure (list + get)
- 1 个 schema 文件 (`category.ts`) 定义 1 张表
- 1 个 query 模块 (`category.ts`) 复用 Drizzle 客户端
- 1 个 domain 模块 (`category/format.ts`) 存放纯函数

## Complexity Tracking

无。所有原则通过,无需豁免。
