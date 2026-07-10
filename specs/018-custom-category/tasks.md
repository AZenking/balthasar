# Tasks: 自定义分类 (018-custom-category)

**Input**: Design documents from `/specs/018-custom-category/` (spec.md + plan.md + research.md + data-model.md + contracts/ + quickstart.md)

**Prerequisites**: plan.md ✅ / spec.md ✅ / research.md ✅ / data-model.md ✅ / contracts/category-procedures.md ✅ / quickstart.md ✅

**Tests**: ✅ Included per Constitution Principle 4 (Test-First). Write test → 观察红 → 实现 → 转绿。Vitest + testcontainers (real PG, 禁止 mock Drizzle)。

**Organization**: Tasks grouped by user story (US1-US5 per spec.md priority order)。每个 US 独立可测,可按优先级递增交付。

## Format: `[ID] [P?] [Story?] Description (file path)`

- **[P]**: 可并行 (不同文件,无未完成依赖)
- **[Story]**: US1-US5 (Setup/Foundational/Polish 阶段无此 label)
- 所有 task 含**精确文件路径**
- 实现遵循 Constitution v2.0.0 (Feature-Sliced + tRPC + Drizzle + Family 聚合根)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 项目级常量、纯函数、单元测试基础设施。**不**触碰 DB schema 或 router,可独立完成。

- [X] T001 [P] Create emoji library constant in `src/lib/constants/category-emojis.ts` — ~150 个 emoji 数组 (含 003 内置 22 + 018 扩充),导出 `CATEGORY_EMOJIS` (as const array) + `CategoryEmoji` (type) + `CATEGORY_EMOJI_SET` (Set,用于 O(1) 校验)。覆盖食物/交通/购物/医疗/教育/人情/宠物 等 ~10 大类。详见 [research.md D3](./research.md#d3-emoji-库--单一共享常量文件-srcenabledts)。
- [X] T002 [P] Create domain pure functions in `src/server/domain/category/rules.ts` — 实现 4 个纯函数 (无 IO):(a) `computeSortOrder(prev, next) → number | NaN` (整数间隔算法, NaN 表示触发重排);(b) `renumberSortOrders(count) → number[]` (返回 `[10, 20, ..., count*10]`);(c) `buildCategoryTree(flatList) → TreeNode[]` (按 parentId 组树,顶级在前,子嵌套为 children);(d) `isCategoryEmoji(value) → boolean` (基于 CATEGORY_EMOJI_SET)。详见 [research.md D4 + D8](./research.md)。
- [X] T003 [P] Write unit tests for domain rules in `src/tests/unit/domain/category-rules.test.ts` — 覆盖 computeSortOrder (中位 + 间隔耗尽 NaN)、renumberSortOrders (1/10/100 边界)、buildCategoryTree (空数组 / 全顶级 / 二级嵌套 / 孤儿 parentId 指向不存在)、isCategoryEmoji (合法 + 非法 + 空串)。Vitest only,无 DB。

**Checkpoint**: 纯函数 + 单元测试全绿 (`pnpm test -- unit/domain/category-rules`),可进入 Phase 2。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema 扩展、迁移、审计 queries —— **所有 US 都依赖**这些底层。

**⚠️ CRITICAL**: 本阶段未完成,US1-US5 任一均无法开工。

- [X] T004 Extend `categories` schema in `src/server/db/schema/category.ts` — 新增 4 字段 (`familyId` uuid nullable REFERENCES families(id) ON DELETE RESTRICT / `parentId` uuid nullable self-ref / `archivedAt` timestamptz nullable / `updatedAt` timestamptz NOT NULL DEFAULT now())。新增 2 索引:`categories_family_type_parent_sort_idx` (层级 list 主索引) + `categories_family_type_parent_name_unique_idx` (COALESCE NULL→sentinel + LOWER(name) 唯一性)。**保留** 003 既有字段与索引 (`categories_type_sort_name_idx` / `categories_name_type_unique_idx`)。详见 [data-model.md](./data-model.md)。
- [X] T005 [P] Create category-events schema in `src/server/db/schema/category-events.ts` — 沿用 `transaction_events` 模式。`categoryEventType` pgEnum (`category_created` / `category_edited` / `category_archived` / `category_unarchived`)。字段:id (uuid v7 PK) / eventType / categoryId (FK ON DELETE SET NULL) / actorMemberId (FK ON DELETE CASCADE) / before jsonb / after jsonb / occurredAt。Index `(categoryId, occurredAt)`。
- [X] T006 Update schema barrel export in `src/server/db/schema/index.ts` — re-export `categoryEvent` + `categoryEventType` + 类型 `CategoryEvent` / `CategoryEventType`。
- [X] T007 Create migration `src/server/db/migrations/0006_category_v15_extensions.sql` — 5 步:(1) ALTER TABLE categories ADD COLUMN × 4 + 自引用 FK;(2) CREATE INDEX 层级主索引;(3) CREATE UNIQUE INDEX family-scoped 唯一性 (含 COALESCE + LOWER 表达式);(4) CREATE TYPE category_event_type + CREATE TABLE category_events + 索引;(5) UPDATE categories SET updated_at = created_at (回填 003 既有 22 个内置分类)。**Idempotent** (可重跑)。详见 [data-model.md 迁移 SQL](./data-model.md#迁移-sql-0006)。
- [X] T008 Run migration + verify 003 backward compat — `pnpm db:migrate` + 写自动检查:22 个内置分类 `family_id IS NULL AND parent_id IS NULL AND archived_at IS NULL AND is_built_in = true AND updated_at = created_at`。003 既有测试 (`src/tests/procedure/category.test.ts`) 全绿。
- [X] T009 [P] Create category-events query writer in `src/server/db/queries/category-events.ts` — 导出 `writeCategoryEvent({ eventType, categoryId, actorMemberId, before?, after? })` 单条 INSERT。导出 `writeCategoryEventsBatch(events[])` 批量 INSERT (用于级联归档/反归档)。**仅写**,无读接口 (FR-026 不要求读审计)。`server-only` 标记。
- [X] T010 Extend `findAllCategories` in `src/server/db/queries/category.ts` — **Foundation 基础版** (US4 T026 才加层级 + 过滤):仅加 family_id 过滤 + active 过滤 → `WHERE (family_id IS NULL OR family_id = $currentFamilyId) AND archived_at IS NULL`,ORDER BY `(parentId NULLS FIRST, sortOrder ASC, createdAt ASC)`。**返回平铺数组,无 children 嵌套,无 type/parentId/includeArchived 过滤参数** (US4 T026 在此基础上扩展)。新增 `findAllCategoriesByParent(parentId)` 和 `countCustomCategoriesByFamily(familyId)` 辅助查询。**不动** `findCategoryById` (US5 处理)。
- [X] T011 [P] Write integration test for migration backward compat in `src/tests/integration/category/migration-backward-compat.test.ts` — Vitest + testcontainers (real PG)。Setup: 跑 0001-0006 全套迁移 + seed 003 内置 22。断言:categories 表存在新 4 字段;22 内置 family_id/parent_id/archived_at 均 NULL;updated_at = created_at;003 既有 `category.list` 行为不变 (返回 22 个,字段含旧 + 新);`category_events` 表存在,空。

**Checkpoint**: Foundation ready。Schema 扩展完成,003 向后兼容验证通过,审计 writer 可用。**US1-US5 可并行开工**(若团队容量允许)或按优先级递增。

---

## Phase 3: User Story 1 — 新增自定义分类 (Priority: P1) 🎯 MVP

**Goal**: 已登录用户在家庭范围内创建一个自定义分类 (顶级或二级),立即可用于交易。

**Independent Test**: 创建 `{type: "expense", name: "宠物用品", icon: "🐾"}` → 调 `category.list({type:"expense"})` 含该项 → 用该 categoryId 创建一笔 `transaction.create` 成功。

### Tests for User Story 1 (TDD — 先写测试,观察红)

- [X] T012 [P] [US1] Write procedure test for `category.create` in `src/tests/procedure/category-create.test.ts` — 覆盖 spec US1 全部 11 个 Acceptance Scenarios (success 顶级/收入/二级 + 409 同名 + 400 空名/超长/无效 type/非白名单 emoji/三级 parentId/跨家庭 parentId + 401 未登录)。使用 `createCaller` + 真 DB (testcontainers)。**先**写,确保失败。
- [X] T013 [P] [US1] Write integration test for create + DB constraints in `src/tests/integration/category/create.test.ts` — 验证:(a) 唯一性索引 `categories_family_type_parent_name_unique_idx` 在 case-insensitive ("Foo" vs "foo") + trim ("foo " vs "foo") 场景下生效;(b) FK family_id ON DELETE RESTRICT;(c) advisory lock 在 200 上限边界 (199/200/201 并发) 的 race-safety;(d) `category_events` 自动写入 `category_created` 事件,after jsonb 含全可变字段快照。

### Implementation for User Story 1

- [X] T014 [US1] Implement `createCategory` query in `src/server/db/queries/category.ts` — 单事务内:(1) `pg_advisory_xact_lock(hashtext(family_id))` 防并发;(2) `countCustomCategoriesByFamily` 检查 < 200 (含归档);(3) parentId 校验 (存在 + 同家庭 + 顶级 + type 一致) → 400;(4) INSERT categories (id=uuidv7, familyId=current, isBuiltIn=false, archivedAt=null);(5) `writeCategoryEvent({ eventType: "category_created", after: snapshot })`。错误码:400 (上限/校验) / 409 (重名)。详见 [research.md D7 + contracts](./research.md#d7-200-上限的并发安全--事务内-select-count-for-update)。
- [X] T015 [US1] Implement `category.create` procedure in `src/server/api/routers/category.ts` — zod input schema:`{ type: categoryTypeEnum, name: z.string().trim().min(1).max(30), icon: z.string().refine(isCategoryEmoji), parentId: z.string().uuid().optional(), sortOrder: z.number().int().optional() }`。`.strict()` 拒绝 familyId/isBuiltIn 客户端传入。`protectedProcedure` 鉴权 (401)。调用 `createCategory`,返回完整 Category 对象 (含新字段)。详见 [contracts/category-procedures.md#create](./contracts/category-procedures.md#categorycreate-018-新增)。
- [X] T016 [US1] Verify US1 tests green — `pnpm test -- category/create` + `pnpm test -- procedure/category-create` 全绿;003 既有 `category.test.ts` 仍绿 (向后兼容);type-check 无错。

**Checkpoint**: US1 完成,可独立交付 (MVP)。用户可在 `category.create` 后用该分类记账,行为与内置一致 (FR-025)。

---

## Phase 4: User Story 2 — 编辑自定义分类 (Priority: P1)

**Goal**: 用户修改自家自定义分类的 name/icon/sortOrder/parentId (受限于 FR-008..FR-014 全部约束)。内置分类 403。

**Independent Test**: 创建 → 改名 "宠物食品" → DB updatedAt 更新 → 尝试编辑内置 → 403 → 尝试切换已被引用分类的 type → 400。

### Tests for User Story 2 (TDD)

- [X] T017 [P] [US2] Write procedure test for `category.update` AND `category.reorder` in `src/tests/procedure/category-update.test.ts` — 覆盖 spec US2 全部 9 个 Acceptance Scenarios (改名/改 icon/改 parentId/改 sortOrder + 403 内置 + 409 重名 + 400 已有子分类设 parent + 400 循环自引用 + 400 type 已被引用/有子/已归档 + 404 跨家庭 + 401)。**额外覆盖 reorder**:合法批量重排 (3-5 项同级) + 跨家庭 id 拒绝 (404) + 含内置 id 拒绝 (403) + 跨级 (不同 parentId) id 拒绝 (400) + 数组内 sortOrder 不唯一拒绝 (400) + 事务原子性 (故意中间步失败 → 全回滚,验证 0 行更新)。

### Implementation for User Story 2

- [X] T018 [US2] Implement `updateCategory` query in `src/server/db/queries/category.ts` — 单事务内:(1) SELECT 当前 row FOR UPDATE;(2) 若 isBuiltIn → 调用方负责抛 403 (query 返 null 或特殊标记);(3) 若 archivedAt ≠ null 且试图改 type/parentId → 抛 400;(4) 若改 type 且 (有 transactions 引用 OR 有子分类) → 抛 400;(5) 若改 parentId 且当前分类有子分类 → 抛 400;(6) 若改 parentId → 校验新 parent (存在/同家庭/顶级/type 一致/非自引用);(7) 唯一性校验 (排除自身);(8) UPDATE + `writeCategoryEvent({ eventType: "category_edited", before: 原快照, after: 新快照 })`。
- [X] T019 [US2] Implement `category.update` procedure in `src/server/api/routers/category.ts` — zod input:`{ id: uuid, name?, icon?, sortOrder?, parentId?: uuid | null, type? }`。`protectedProcedure`。先 SELECT 校验存在 + family + isBuiltIn=false (否则 403/404),再调用 `updateCategory`。LWW (Last-Write-Wins,无版本号,与 004 一致)。详见 [contracts/category-procedures.md#update](./contracts/category-procedures.md#categoryupdate-018-新增)。
- [X] T019b [US2] Implement `category.reorder` batch procedure in `src/server/api/routers/category.ts` + `src/server/db/queries/category.ts` — **满足 FR-031(d) 原子性**(analyze F1 fix)。zod input:`{ items: Array<{ id: uuid, sortOrder: z.number().int().min(0) }> }`,数组长度 1-200。`reorderCategory` query 单事务内:(1) SELECT FOR UPDATE 所有 id;(2) 校验全 isBuiltIn=false (否则 403) + 全 family_id=current (否则 404) + 全同 parentId (否则 400 "reorder 仅支持同级") + items 内 sortOrder 唯一 (否则 400);(3) UPDATE × N + `writeCategoryEventsBatch` N 条 `category_edited` (before/after 仅含 sortOrder 字段);(4) 任一失败 → 整事务回滚。Procedure 返回 `{ success: true, updated: string[] }`。详见 [contracts/category-procedures.md#reorder](./contracts/category-procedures.md#categoryreorder-018-新增--批量重排满足-fr-031d-原子性)。
- [X] T020 [US2] Verify US2 tests green — `pnpm test -- category/update` + `pnpm test -- procedure/category-update` 全绿 (含 reorder 测试)。

**Checkpoint**: US1 + US2 均独立可用。用户可创建 + 编辑自定义分类。

---

## Phase 5: User Story 3 — 归档与反归档 (Priority: P1)

**Goal**: 用户归档不再使用的自定义分类 (级联子),反归档时强制级联复活所有子 (含此前独立归档的)。历史交易 JOIN 仍能取 categoryName。

**Independent Test**: 创建父 + 2 子 → 独立归档子 A → 归档父 (级联子 B) → list 默认不含三者 → 反归档父 → 三者均复活 (含 A) → transaction.get 仍 JOIN 出 categoryName。

### Tests for User Story 3 (TDD)

- [X] T021 [P] [US3] Write procedure test for `category.archive` + `category.unarchive` in `src/tests/procedure/category-archive.test.ts` — 覆盖 spec US3 全部 10 个 Acceptance Scenarios (单归档 + 级联子 + 反归档强制复活 + 反归档级联复活独立归档过的子 + 403 内置 + 404 跨家庭 + 401 + 历史交易 JOIN 不破)。**特别**:验证 Clarify Q2 强制复活语义 —— 反归档父时,所有子 (无论 prior archived state) 统一 archivedAt = null。

### Implementation for User Story 3

- [X] T022 [US3] Implement `archiveCategory` + `unarchiveCategory` queries in `src/server/db/queries/category.ts` — 单事务内:
  - **archive**:(1) `SELECT parent FOR UPDATE WHERE id = $1 AND family_id = $current`;(2) 若 isBuiltIn → 403;(3) `UPDATE categories SET archived_at = now() WHERE id = $1`;(4) `UPDATE categories SET archived_at = now() WHERE parent_id = $1 AND archived_at IS NULL` (仅级联未归档的子);(5) `writeCategoryEventsBatch` 写 1 + N 条 `category_archived` 事件。
  - **unarchive**:(1) 同 SELECT FOR UPDATE;(2) `UPDATE categories SET archived_at = NULL WHERE id = $1`;(3) `UPDATE categories SET archived_at = NULL WHERE parent_id = $1` (**强制级联复活所有子**,无 `AND archived_at IS NULL` 过滤);(4) `writeCategoryEventsBatch` 写 1 + N 条 `category_unarchived` 事件。详见 [research.md D5](./research.md#d5-反归档父级联语义--强制级联复活-clarify-q2)。
- [X] T023 [US3] Implement `category.archive` + `category.unarchive` procedures in `src/server/api/routers/category.ts` — input `{ id: uuid }`。`protectedProcedure`。返回 `{ success: true, archivedChildren: string[] }` / `{ success: true, unarchivedChildren: string[] }`。详见 [contracts/category-procedures.md#archive + #unarchive](./contracts/category-procedures.md)。
- [X] T024 [US3] Verify US3 tests green — `pnpm test -- category/archive` + 含级联复活语义的 5 个场景全绿。

**Checkpoint**: US1 + US2 + US3 均独立可用。P1 写操作 (create/edit/archive) 完整闭环。

---

## Phase 6: User Story 4 — 查询分类列表 (含层级) (Priority: P2)

**Goal**: `category.list` 返回内置 + 当前家庭自定义的所有可见分类,层级展开 (顶级数组 + children 嵌套),支持 type/parentId/includeArchived 过滤。003 旧调用零破坏。

**Independent Test**: 新增若干自定义分类 (顶级 + 二级) → `category.list({type:"expense"})` 返回内置 expense + 自定义 expense,二级挂在父的 children 数组 → 003 旧调用 `category.list()` 仍返回 22 内置 (字段超集,无破坏)。

### Tests for User Story 4 (TDD)

- [X] T025 [P] [US4] Write procedure test for `category.list` (extended) in `src/tests/procedure/category-list.test.ts` — 覆盖 spec US4 全部 7 个 Acceptance Scenarios (无参默认 + 二级嵌套 children + type 过滤 + includeArchived + 跨家庭隔离 + parentId 级联查询 + 401)。**额外**:003 既有测试 (`src/tests/procedure/category.test.ts` 的 list 部分) 全绿 (向后兼容)。

### Implementation for User Story 4

- [X] T026 [US4] Extend `findAllCategories` (built in T010) with **hierarchical output + 3 new filters** in `src/server/db/queries/category.ts` — 在 T010 的 family_id + active 过滤基础上加:(a) `type?` 过滤参数;(b) `includeArchived?` 参数 (默认 false,设 true 时 WHERE 改为 `(family_id IS NULL OR = $current)` 不加 archivedAt 过滤);(c) `parentId?` 参数 (指定后:`SELECT WHERE parent_id = $parentId` 返回平铺无嵌套,用于级联场景)。无 parentId 模式:用 `buildCategoryTree` (T002) 在应用层组树成 parent + children 嵌套,O(N)。**保留** T010 的基础行为作为默认。详见 [research.md D8](./research.md#d8-层级-list-查询--单次-select--应用层组树)。
- [X] T027 [US4] Update `category.list` procedure in `src/server/api/routers/category.ts` — 扩展 zod input:`{ type?: categoryTypeEnum, parentId?: uuid, includeArchived?: boolean }`。调用扩展后的 `findAllCategories`,返回嵌套或平铺结构。003 旧调用 (无参或 `{type}`) 行为不变 (字段超集,无破坏)。详见 [contracts/category-procedures.md#list](./contracts/category-procedures.md#categorylist-扩展-003)。
- [X] T028 [US4] Verify US4 tests green + 003 list backward compat — `pnpm test -- category/list` 全绿;003 既有测试 (`pnpm test -- procedure/category.test.ts`) 全绿。

**Checkpoint**: P1 + US4 (P2 查询) 完整。分类管理页 UI 可基于此 API 渲染。

---

## Phase 7: User Story 5 — 查询单个分类 (Priority: P3)

**Goal**: `category.get` 返回完整字段 (含 familyId/isBuiltIn/parentId/archivedAt 等扩展字段)。跨家庭 404。内置对所有人可见。

**Independent Test**: 用 list 拿到某自定义 ID → `category.get` 返回全字段 → 跨家庭 get → 404 → 不存在 ID → 404 → 内置 ID → 返回 isBuiltIn=true, familyId=null。

### Tests for User Story 5 (TDD)

- [X] T029 [P] [US5] Write procedure test for `category.get` (extended) in `src/tests/procedure/category-get.test.ts` — 覆盖 spec US5 全部 5 个 Acceptance Scenarios (自家自定义 + 跨家庭 404 + 不存在 404 + 内置可见 + 401)。验证返回字段含 familyId/isBuiltIn/parentId/archivedAt/updatedAt (018 新增)。

### Implementation for User Story 5

- [X] T030 [US5] Extend `findCategoryById` + `category.get` procedure for cross-family isolation in `src/server/db/queries/category.ts` + `src/server/api/routers/category.ts` — query 层不变 (按 id 单查);procedure 层加校验:if `!row.isBuiltIn && row.familyId !== currentFamilyId` → 404 (不暴露存在性)。内置 (isBuiltIn=true) 任意家庭可读。返回字段含所有 018 新增。
- [X] T031 [US5] Verify US5 tests green — `pnpm test -- category/get` + `pnpm test -- procedure/category-get` 全绿。

**Checkpoint**: 全部 5 个 US 完整可用。功能闭环。

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 文档同步、端到端验证、UI (可选/defer)、最终质量门。

- [ ] T032 [P] Update `docs/DOMAIN.md` — Category 实体新增字段 (familyId/parentId/archivedAt/updatedAt),Family 聚合内 Category 的两种形态 (内置 familyId=null + 自定义 familyId=非空),二级深度上限,type 一致性约束,归档 vs 删除决策。
- [ ] T033 [P] Update `docs/DATABASE.md` — `categories` 表 schema (扩展后) + `category_events` 表 schema + 新索引 + 迁移 0006 说明。
- [ ] T034 Run quickstart.md 9 个验证场景手动跑通 — 见 [quickstart.md](./quickstart.md)。覆盖:003 向后兼容 + golden path + 二级 type-match + 级联归档/复活 + 跨家庭隔离 + 内置不可写 + sortOrder 拖拽 + 200 上限 + 审计完整性。每场景截图或日志归档到 PR 描述。
- [ ] T035 Final quality gate — `pnpm tsc --noEmit` 0 错;`pnpm test` 全套绿 (含 002/003/004 既有测试无回归);`pnpm lint` 非阻塞 (FR-007 of 015,允许 continue-on-error)。审查 p95 性能基线 (create < 200ms / list < 150ms,可写性能测试或人工 sampling)。
- [ ] T036 [P] (Optional / TBD) Category management UI page — 若 018 含 UI,新建 `/settings/categories/page.tsx` + components/category-manager.tsx + emoji-picker.tsx + drag-drop-list.tsx。若拆为独立 feature (018-ui),此 task 移出本批。**决策建议**: V1.5 backend-only,UI 单独开 feature,沿用 008-transaction-ui / 009-transactions-list-ui 的拆分模式。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,3 个 [P] 任务可全部并行
- **Foundational (Phase 2)**: 依赖 Phase 1 (T001 emoji / T002 rules 可被 T014 / T015 使用);**BLOCKS** 所有 US
- **US1-US5 (Phase 3-7)**: 均依赖 Phase 2 完成;彼此**无硬依赖** (US2/3/4/5 内部假设 US1 的 create 已可用,但 query 层解耦,实际可并行)
- **Polish (Phase 8)**: 依赖所有要交付的 US 完成

### User Story Dependencies

| Story | 优先级 | 依赖 | 可并行? |
|---|---|---|---|
| US1 Create | P1 🎯 MVP | Foundation | 是 (基线) |
| US2 Update | P1 | Foundation + (US1 create 用于测试 setup) | 是 |
| US3 Archive | P1 | Foundation + (US1 create 用于 setup) | 是 |
| US4 List hierarchical | P2 | Foundation | 是 (与 US1/2/3 并行) |
| US5 Get extended | P3 | Foundation | 是 (与 US1-4 并行) |

> **注**:US 之间在 spec 层独立可测,但实现时测试 setup 通常需要先 create 才能 update/archive。这不阻塞 query/procedure 实现 (它们各自独立),只影响测试 fixture 编写顺序。

### Within Each User Story

1. **Tests first** (TDD) — 写测试,观察红 (`pnpm test -- ...` 失败)
2. **Query 层** — `src/server/db/queries/category.ts` 新增函数
3. **Procedure 层** — `src/server/api/routers/category.ts` 新增 procedure + zod schema
4. **Verify** — 跑测试转绿 + 邻近 feature 测试无回归

### Parallel Opportunities

- **Phase 1**:T001 + T002 + T003 完全并行 (3 个不同文件)
- **Phase 2**:T005 (新 schema) + T009 (新 queries) + T011 (新测试) 可并行 (不依赖 T004/T010 完成)
- **Phase 3-7**:5 个 US 可由 5 个开发者并行 (前提 Foundation 完成);每个 US 内部 test/query/procedure 顺序串行
- **Phase 8**:T032 + T033 + T036 文档/UI 完全并行;T034/T035 串行 (依赖前面)

---

## Parallel Example: User Story 1

```bash
# 并行起 3 个 test/setup 任务:
Task: "T012 procedure test category-create.test.ts"
Task: "T013 integration test create.test.ts"

# 等测试红后,串行实现:
Task: "T014 createCategory query"
Task: "T015 category.create procedure"

# 最后:
Task: "T016 verify tests green"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1 Setup (3 任务,~1 小时)
2. Phase 2 Foundation (8 任务,~1 天,含迁移 + 验证)
3. Phase 3 US1 Create (5 任务,~半天)
4. **STOP & VALIDATE**: `pnpm test -- category` 全绿;跑 quickstart 场景 1 (003 兼容) + 场景 2 (golden path)
5. **可选**: 直接合并到 main,deploy 验证环境

### Incremental Delivery

1. Foundation → 003 不破坏,22 内置仍工作 ✅
2. + US1 → 用户可创建自定义分类 (P1 写) ✅
3. + US2 → 用户可编辑 (P1 写完整) ✅
4. + US3 → 用户可归档 (P1 写闭环) ✅
5. + US4 → 用户可查询层级 (P2 读完整) ✅
6. + US5 → 单查 + 跨家庭 404 (P3) ✅
7. Polish → 文档 + 端到端验证 + UI 决策

### Suggested Commit Cadence

- Phase 1: 1 commit ("chore(018): emoji library + domain rules")
- Phase 2: 1 commit ("feat(018): schema extension + migration 0006")
- 每个 US: 1 commit (e.g. "feat(018): US1 create custom category")
- Phase 8: 1 commit ("docs(018): DOMAIN/DATABASE update + quickstart validation")

---

## Notes

- 所有 task 严格遵循 `[ID] [P?] [Story?] Description (file path)` 格式
- [P] 标记的任务在不同文件,无未完成依赖 → 可并行
- 每个 US 内 test → query → procedure → verify 是 TDD 闭环
- 003 向后兼容是硬约束,任何阶段 003 既有测试 (`src/tests/procedure/category.test.ts`) 必须全绿
- 禁止 mock Drizzle/PG (宪章原则四);所有 integration/procedure 测试用 testcontainers + 真实 PG 16
- UI 决策 (T036) 建议拆为独立 feature 018-ui,与 008/009 模式一致
- 性能 SLA (P95 < 200ms / 150ms) 在 T035 最终验证,不在每 US 内单独跑 (避免噪声)
