---

description: "Task list for 003-category (T3 Stack + Drizzle,read-only 内置分类字典)"

---

# Tasks: 分类管理 (003-category)

**Input**: Design documents from `/specs/003-category/`

**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/README.md, research.md, quickstart.md

**Tests**: 包含。宪章四 (Test-First) 不可妥协。

**Organization**: 按 User Story 分阶段。本 feature 仅 2 个 US (read-only)。

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: 可并行 (不同文件,无依赖)
- **[Story]**: 该任务属于哪个 US
- 所有路径相对仓库根;代码在 `src/`

## Path Conventions

复用 001/002 的 `src/` 工程:
- Router: `src/server/api/routers/`
- Schema: `src/server/db/schema/`
- Query: `src/server/db/queries/`
- Domain: `src/server/domain/category/`
- 测试: `src/tests/{unit,procedure,integration}/`

---

## Phase 1: Setup

无新依赖 (UUID v5 用 `uuid` npm 包,与 `uuidv7` 同家族)。

---

## Phase 2: Foundational (跨 US 共享前置)

**Purpose**: Schema + 迁移 + 种子数据 + Domain 纯函数

**⚠️ CRITICAL**: 此阶段未完成,US1-US2 均无法启动

### 数据层 + 种子

- [X] T001 [P] Create categories Drizzle schema in `src/server/db/schema/category.ts` per [data-model.md](./data-model.md) —— pgEnum `category_type` (`income` | `expense`) + 索引 `(type, sort_order, name)` + 唯一索引 `(name, type)`
- [X] T002 Update `src/server/db/schema/index.ts` 追加 export `./category`
- [X] T003 [P] Add `uuid` package to dependencies in `package.json` (UUID v5 用于确定性 ID 生成,research.md Q2)
- [X] T004 Generate Drizzle migration `src/server/db/migrations/0003_categories.sql` via `pnpm db:generate` (CREATE TABLE + CREATE INDEX,不含 seed)
- [X] T005 Generate 22 seed INSERT statements —— 编写一次性 Node 脚本 (临时文件,不入仓) 用 `uuid.v5('expense:餐饮', DNS_NAMESPACE)` 生成 ID,产出 SQL `INSERT ... ON CONFLICT (id) DO NOTHING` 列表 (research.md Q1+Q2)
- [X] T006 Append 22 条 INSERT 到 `src/server/db/migrations/0003_categories.sql` 末尾 (CREATE TABLE 之后),使用 T005 生成的 UUID v5 IDs + 12 expense + 8 income 数据集 (research.md Q3)
- [X] T007 Update `src/server/db/migrations/meta/_journal.json` 追加 0003 entry

### Domain 纯函数

- [X] T008 [P] Create `src/server/domain/category/constants.ts` —— 仅暴露 `CATEGORY_DNS_NAMESPACE` 常量 (固定 RFC 4122 DNS namespace UUID `6ba7b810-9dad-11d1-80b4-00c04fd430c8`),供 T005 生成 UUID v5 用;**不**创建 `formatCategoryForDisplay` (前端 inline 拼 `${icon} ${name}`,YAGNI)

**Checkpoint**: schema + 迁移 + 22 条种子 + format helper 就绪。可进入 US 实现。

---

## Phase 3: User Story 1 — 查询分类列表 (Priority: P1) 🎯 MVP

**Goal**: 已认证用户调 `category.list` (含可选 type 过滤),返回内置分类数组,按 sortOrder ASC, name ASC

**Independent Test**: 注册成功后 list 返回 ≥ 20 条;type=expense 返 ≥ 12;type=income 返 ≥ 5;跨家庭一致

### Tests for User Story 1 ⚠️ TDD

- [X] T009 [P] [US1] Procedure 契约测试 `category.list` happy path (无参 → 返全部) 在 `src/tests/procedure/category.test.ts`
- [X] T010 [P] [US1] Procedure 契约测试 `category.list({ type: 'expense' })` 仅返 expense 在 `src/tests/procedure/category.test.ts`
- [X] T011 [P] [US1] Procedure 契约测试 `category.list({ type: 'income' })` 仅返 income 在 `src/tests/procedure/category.test.ts`
- [X] T012 [P] [US1] Procedure 契约测试未登录 → 401 在 `src/tests/procedure/category.test.ts`
- [X] T013 [P] [US1] 集成测试: seed 注入 ≥ 20 条 (SC-001) + expense ≥ 12 (SC-002) + income ≥ 5 (SC-003) + **遍历所有 seed 行断言 `name.length ∈ [1,30]` (SC-006) + `icon.length ≤ 4` UTF-16 code units (SC-008)** 在 `src/tests/integration/category/list.test.ts`
- [X] T014 [P] [US1] 集成测试: 排序 `sortOrder ASC, name ASC` (FR-003) 在 `src/tests/integration/category/list.test.ts`
- [X] T015 [P] [US1] 集成测试: 跨家庭一致 (FR-007) —— 用户 A 与用户 B list 结果完全相同 在 `src/tests/integration/category/list.test.ts`
- [X] T016 [P] [US1] 集成测试: seed 幂等 —— 重跑迁移行数不变 (SC-005/FR-009) 在 `src/tests/integration/category/list.test.ts`
- [X] T017 [P] [US1] 性能测试: list P95 < 100ms (SC-004,FR-012) 在 `src/tests/integration/category/list.test.ts`

### Implementation for User Story 1

- [X] T018 [P] [US1] Create `src/server/db/queries/category.ts` —— `findAllCategories({ type?: CategoryType })` 用 Drizzle 查询,`WHERE type = $type` (可选) + `ORDER BY sort_order ASC, name ASC`
- [X] T019 [US1] Create category router with `list` procedure in `src/server/api/routers/category.ts` —— protectedProcedure,input `{ type?: 'income' | 'expense' }.optional()`,调用 `findAllCategories`
- [X] T020 [US1] Wire `categoryRouter` into `appRouter` in `src/server/api/root.ts` —— 显式并列 `router({ auth, account, category })`

**Checkpoint**: US1 独立可测 —— list 返回 ≥ 20 条,跨家庭一致,P95 < 100ms。

---

## Phase 4: User Story 2 — 查询单个分类 (Priority: P2)

**Goal**: 已认证用户用 ID 查询单个分类详情,不存在返回 404

**Independent Test**: list 拿到的 ID 调 get 返回完整数据;不存在 ID → NOT_FOUND

### Tests for User Story 2 ⚠️ TDD

- [X] T021 [P] [US2] Procedure 契约测试 `category.get` happy path 在 `src/tests/procedure/category.test.ts`
- [X] T022 [P] [US2] Procedure 契约测试 `category.get` 不存在 ID → NOT_FOUND (FR-005) 在 `src/tests/procedure/category.test.ts`
- [X] T023 [P] [US2] Procedure 契约测试 `category.get` 未登录 → 401 在 `src/tests/procedure/category.test.ts`
- [X] T024 [P] [US2] 集成测试: get 返回完整 Category 字段 (id/name/type/icon/sortOrder/isBuiltIn/createdAt) 在 `src/tests/integration/category/get.test.ts`
- [X] T025 [P] [US2] 集成测试: UUID v5 ID 稳定性 (SC-005) —— `uuid.version === 5` + 重启后 ID 不变 在 `src/tests/integration/category/get.test.ts`

### Implementation for User Story 2

- [X] T026 [P] [US2] Add `findCategoryById(id)` 到 `src/server/db/queries/category.ts`
- [X] T027 [US2] Add `get` procedure 到 `src/server/api/routers/category.ts` —— protectedProcedure,input `{ id: uuid }`,调 `findCategoryById`,无结果抛 NOT_FOUND

**Checkpoint**: US2 独立可测 —— get 返回详情 + 404 + UUID v5 验证。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 全 story 共享的最终质量门

- [X] T028 [P] Run all test suites: `pnpm test:coverage` (domain > 90%, procedure > 80%, integration > 70%)
- [X] T029 [P] Run [quickstart.md](./quickstart.md) end-to-end validation; tick all 8 SC items
- [X] T030 [P] Performance: 100 次 list 请求 P95 < 100ms 端到端验证 (SC-004,可用 autocannon 或 vitest 计时)
- [X] T031 [P] ~~Unit tests for `formatCategoryForDisplay`~~ (F3 修复:T008 已删除该函数,本任务一并删除) —— 改为 **SC-006/SC-008 数据集完整性 unit test** 在 `src/tests/unit/server/domain/category/seed-data.test.ts`:遍历 22 条内置分类,断言 `name.length ∈ [1,30]` + `icon.length ≤ 4` + `type ∈ {income, expense}` + `sortOrder > 0`;T013 集成测试已覆盖一遍,本单元测试在 testcontainers 之外快速验证 (常量数组 import)
- [X] T032 Update `docs/DATABASE.md` 加入 categories 表 + 22 条种子 + pgEnum category_type
- [X] T033 Update `docs/DOMAIN.md` 加入 Category 实体 (与 Family 并列的独立聚合,无 family_id)
- [X] T034 Final code review against Constitution v2.0.0 —— 验证无 Principle 违反 (尤其 Principle II Feature-Sliced + Principle IV no-DB-mocks + Principle VI YAGNI read-only)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 跳过 (复用 001/002 工程)
- **Foundational (Phase 2)**: T001-T008,**阻塞所有 US**
- **US1 (Phase 3)**: 依赖 Phase 2
- **US2 (Phase 4)**: 依赖 Phase 2 + 数据依赖 US1 (集成测试用 list 验证 ID)
- **Polish (Phase 5)**: 依赖所有 US 完成

### User Story 独立性

- **US1 list**: 完全独立,Foundational 后即可启动
- **US2 get**: 数据依赖 US1 (集成测试用 list 拿 ID);代码层独立

### Story 内部顺序

- 测试 FIRST (TDD, 宪章四),观察失败
- Schema → Query → Procedure → appRouter 挂载
- 每个 US 末尾必须可独立 demo

### 并行机会

- Phase 2 内 T001 (schema) + T003 (uuid 包) + T008 (format helper) 三个不同文件,全部 [P]
- Phase 3 内 T009-T012 (4 个 procedure 契约) 全部 [P]
- Phase 3 内 T013-T017 (5 个集成测试) 全部 [P]
- Phase 4 内 T021-T025 (5 个测试) 全部 [P]

---

## Parallel Example

```bash
# Phase 2 Foundational — 3 路并行
Task T001: "Create categories Drizzle schema in src/server/db/schema/category.ts"
Task T003: "Add uuid package to package.json"
Task T008: "Create format helper in src/server/domain/category/format.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 Phase 2: Foundational
2. 完成 Phase 3: US1 list
3. **STOP and VALIDATE**: SC-001/002/003/004/005 通过
4. 此时用户能查到所有分类 —— 但 004-transaction 创建交易时单查一个分类的需求暂缺

### 推荐最小可发布切片: US1 + US2

list + get 都做完,API 完整。实施成本约 002-account 的 1/3 (无 CRUD、无审计、无家庭隔离)。

### 增量交付

1. Foundational → 基础就绪 (含 22 条种子)
2. + US1 → list 可用 (前端能拉分类)
3. + US2 → get 可用 (API 完整)
4. Polish → 准备发布

---

## Notes

- [P] 任务 = 不同文件,无依赖,可并行
- [Story] 标签把任务映射到 spec.md 的 User Story
- 每个 US 末尾的 Checkpoint 必须可独立 demo
- 测试任务先于实现任务 (宪章四)
- 每完成一个 US,运行 `pnpm test` 必须全绿
- 本 feature **不**写 category_events 审计表 (read-only,与 002-account 决策不同)
- 本 feature **不**加 family_id 字段 (内置共享,FR-007)
- 任务粒度: 每个 Schema / Query / Procedure / 测试文件为独立任务
