# Implementation Plan: 自定义分类 (018-custom-category)

**Branch**: `feat/018-custom-category` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-custom-category/spec.md`

## Summary

003-category 已交付只读内置分类字典 (22 个,UUID v5,无 familyId)。本 feature 是 003 的 V1.5 增量增强,**不重写** 003,而是叠加 4 项能力:

1. **CRUD 写操作** —— 家庭范围内的新增/编辑/归档/反归档 (内置分类不可变)
2. **二级分类层级** —— `parentId` 自引用,至多 2 层深度,子 type MUST 等于父
3. **共享 emoji 库** —— 单一常量文件 (`src/lib/constants/category-emojis.ts`),前后端 import 共享,覆盖 003 内置 22 + 018 扩充
4. **审计日志** —— 新增 `category_events` 表 (沿用 `transaction_events` 模式),永久保留

技术策略:**扩展现有 `categories` 表**(加 4 字段 + 改索引)+ **新增 `category_events` 表** + **扩展 `categoryRouter`** (+4 procedure) + **新建共享 emoji 常量**。最小改动面,最大复用,符合宪章原则六 (YAGNI)。

## Technical Context

| 维度 | 值 |
|---|---|
| **Language/Version** | TypeScript 5.x on Next.js 16 (App Router, standalone output) |
| **Primary Dependencies** | tRPC v11 + superjson / Drizzle ORM / Better-Auth / zod / shadcn/ui |
| **Storage** | PostgreSQL 16 — 扩展现有 `categories` 表 + 新增 `category_events` 表 |
| **Testing** | Vitest (unit + procedure via `createCaller`) + testcontainers (integration on real PG) |
| **Target Platform** | Docker (node:22-alpine, pnpm 11.9) |
| **Project Type** | Full-stack web service (Next.js 单仓单进程) |
| **Performance Goals** | P95 < 200ms (create/update,含审计),< 150ms (list 含层级) — FR-027 |
| **Constraints** | 200 个/家庭硬上限;二级深度上限;内置不可变;家庭隔离;子 type MUST 等于父 |
| **Scale/Scope** | 单家庭 < 100 active 分类 (22 内置 + 自定义);单家庭全生命周期 < 1000 audit 事件 |

无 NEEDS CLARIFICATION —— 5 个 clarify 问题已在 `/speckit-clarify` 全部锁定 (见 spec.md Clarifications Session 2026-07-09)。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

逐条核对宪章 v2.0.0 六原则:

| # | 原则 | 检查 | 状态 |
|---|---|---|---|
| 一 | MVP 范围 | 018 是 V1.5 增强 (spec Status 标注 `Draft (V1.5 enhancement over 003-category)`,Assumptions 显式声明 PRD 修订追溯)。**不属** V2+ 范围外的转账/预算/导入导出等;增强既有 MVP feature (003) 是合规增量。 | ✅ |
| 二 | Feature-Sliced Architecture | 扩展 003 的 `categoryRouter` (同一文件,新增 4 procedure,符合"每片 = 一个 router");新增 `category-events` schema/queries 沿用 002/004 模式。无横向分层抽象。 | ✅ |
| 三 | DDD | Family 是聚合根。自定义分类 MUST 持 `familyId`;内置分类 `familyId IS NULL` 共享只读。跨家庭访问 404 (不暴露存在性)。`category_events` 持 `actorMemberId` 与 004 一致。 | ✅ |
| 四 | Test-First | 计划覆盖:domain 纯函数 (整数间隔排序算法、case-insensitive trim 比较、type-match 校验);procedure via `createCaller` (含 409/403/404/400/401 全错误码);integration on real PG (含级联归档事务原子性、跨家庭隔离、200 上限并发);React 组件 (分类管理页 + drag-drop)。**禁止 mock Drizzle/PG**。 | ✅ |
| 五 | Performance & Fast Input | create/update P95 < 200ms,list P95 < 150ms (FR-027)。`categories` 表索引 `(family_id, type, parent_id, sort_order, created_at)` 覆盖层级查询。无 N+1 (hierarchical list 单次查询 + app 层组树)。 | ✅ |
| 六 | YAGNI | 沿用 003 现有 schema/router/queries;不引入 Repository/Service 抽象 (tRPC procedure → Drizzle 直查);emoji 单一共享常量 (避免两份漂移);不实现 purge/合并/上传图标/三级分类/AI 建议 (显式 defer)。 | ✅ |

**Gate 结论**: 全部 6 原则 PASS,无 violation,无需填 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/018-custom-category/
├── spec.md              # /speckit-specify + /speckit-clarify (done)
├── checklists/
│   └── requirements.md  # /speckit-specify (done, 12/12 pass)
├── plan.md              # This file
├── research.md          # Phase 0 (/speckit-plan)
├── data-model.md        # Phase 1 (/speckit-plan)
├── contracts/
│   └── category-procedures.md  # Phase 1 (/speckit-plan)
└── quickstart.md        # Phase 1 (/speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── constants/
│       └── category-emojis.ts                     # NEW: 共享 emoji 白名单 (~150 个)
├── server/
│   ├── api/
│   │   └── routers/
│   │       └── category.ts                        # EXTEND: + create/update/archive/unarchive (4 procedure)
│   ├── db/
│   │   ├── schema/
│   │   │   ├── category.ts                        # EXTEND: + familyId/parentId/archivedAt/updatedAt + 索引
│   │   │   ├── category-events.ts                 # NEW: 审计表 (参照 transaction-events.ts)
│   │   │   └── index.ts                           # UPDATE: re-export categoryEvent
│   │   ├── queries/
│   │   │   ├── category.ts                        # EXTEND: + create/update/archive/unarchive/list-with-tree
│   │   │   └── category-events.ts                 # NEW: writeCategoryEvent()
│   │   └── migrations/
│   │       └── 0006_category_v15_extensions.sql   # NEW: ALTER TABLE + CREATE TABLE + 索引
│   └── domain/
│       └── category/
│           ├── constants.ts                       # EXISTING (CATEGORY_DNS_NAMESPACE, 无改动)
│           └── rules.ts                           # NEW: 纯函数 (type-match, 2 层深度, sort-mid 计算)
└── tests/
    ├── procedure/
    │   └── category.test.ts                       # EXTEND: + 4 procedure × 全错误码
    ├── integration/
    │   └── category/
    │       ├── create.test.ts                     # NEW
    │       ├── update.test.ts                     # NEW
    │       ├── archive.test.ts                    # NEW (含级联)
    │       ├── list-hierarchical.test.ts          # NEW
    │       └── cross-family.test.ts               # NEW
    └── unit/
        └── domain/
            └── category-rules.test.ts             # NEW (纯函数,无 IO)
```

**Structure Decision**: 单仓单 Next.js 进程,沿用 003 的 feature-sliced 切片。新增文件 8 个,修改文件 5 个,**零删除**。Source code 改动面控制在 003 的 feature 切片内,不污染其他 feature。

## Complexity Tracking

> 无 Constitution Check 违规,本表为空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    | -          | -                                   |
