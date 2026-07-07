---

description: "Task list for 005-transactions-list (筛选 + summary, 无新表)"

---

# Tasks: 流水列表与筛选 (005-transactions-list)

**Input**: Design documents from `/specs/005-transactions-list/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/README.md, research.md, quickstart.md

**Tests**: 包含。宪章四 (Test-First)。

**Organization**: 2 US,均扩展 004 的 `transaction.list`。

## Format: `- [ ] [ID] [P?] [Story?] Description`

## Path Conventions

不新增文件。修改 004 的:
- `src/server/db/queries/transaction.ts` — 扩展 `listTransactions` + 新增 `getTransactionSummary`
- `src/server/api/routers/transaction.ts` — 扩展 `list` procedure input + response
- `src/tests/integration/transaction/list.test.ts` — 追加筛选 + summary 测试

---

## Phase 1: Setup

无新依赖。

---

## Phase 2: Foundational (查询层扩展)

**Purpose**: 扩展 query module 支持筛选 + summary

- [X] T001 扩展 `listTransactions` in `src/server/db/queries/transaction.ts` —— input 增加可选 `type/accountId/categoryId/startDate/endDate/keyword` 参数,动态构建 WHERE 条件数组 (AND 逻辑),keyword 用 Drizzle `ilike()` + trim + 截断 200 (research.md Q2)
- [X] T002 [P] 新增 `getTransactionSummary` in `src/server/db/queries/transaction.ts` —— 接受相同筛选条件 (不含 cursor),用 `SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)` + `SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END)` 聚合 (research.md Q1),返回 `{ income, expense, net }`

**Checkpoint**: 查询层支持 6 维筛选 + summary 聚合。

---

## Phase 3: User Story 1 — 多维度筛选 (Priority: P1)

**Goal**: `transaction.list` 支持 type/accountId/categoryId/startDate/endDate/keyword 筛选

**Independent Test**: 创建 5 笔不同类型/分类的交易,各筛选条件独立 + 组合使用

### Tests for User Story 1 ⚠️ TDD

- [X] T003 [P] [US1] 集成测试: type=expense 仅返支出 在 `src/tests/integration/transaction/list.test.ts`
- [X] T004 [P] [US1] 集成测试: accountId 筛选仅返该账户交易
- [X] T005 [P] [US1] 集成测试: categoryId 筛选仅返该分类交易
- [X] T006 [P] [US1] 集成测试: startDate/endDate 日期范围闭区间
- [X] T007 [P] [US1] 集成测试: keyword ILIKE 模糊匹配 (中文 + 英文不区分大小写)
- [X] T008 [P] [US1] 集成测试: 多条件 AND 组合
- [X] T009 [P] [US1] 集成测试: 跨家庭 accountId → 空列表 (SC-005)
- [X] T010 [P] [US1] 集成测试: startDate > endDate → 空列表 (SC-006)
- [X] T011 [P] [US1] 集成测试: cursor + 筛选组合 (第 2 页用 cursor + 相同筛选,结果连续,SC-007)

### Implementation for User Story 1

- [X] T012 [US1] 扩展 `list` procedure input schema in `src/server/api/routers/transaction.ts` —— zod 加 `type/accountId/categoryId/startDate/endDate/keyword` 可选字段 + `includeSummary: boolean.default(false)`,传递给 `listTransactions`

**Checkpoint**: US1 独立可测 —— 6 维筛选 + cursor 组合。

---

## Phase 4: User Story 2 — 筛选结果小计 (Priority: P1)

**Goal**: `includeSummary=true` 时返回 `{ income, expense, net }` 全量聚合

**Independent Test**: 创建 3 支出 (16000) + 2 收入 (25000),summary net=9000

### Tests for User Story 2 ⚠️ TDD

- [X] T013 [P] [US2] 集成测试: includeSummary=true 返回 income/expense/net (SC-003 准确率)
- [X] T014 [P] [US2] 集成测试: summary 汇总全量 (非仅当前页) —— 创建 100 笔 + limit=10,summary 应反映 100 笔
- [X] T015 [P] [US2] 集成测试: type=expense + includeSummary → income=0, expense>0
- [X] T016 [P] [US2] 集成测试: 无交易 + includeSummary → summary 全为 0
- [X] T017 [P] [US2] 性能测试: 1000 笔 + 3 筛选条件 + summary P95 < 500ms (SC-002)

### Implementation for User Story 2

- [X] T018 [US2] 扩展 `list` procedure response in `src/server/api/routers/transaction.ts` —— 当 `includeSummary=true` 时调 `getTransactionSummary` (T002),response 追加 `summary` 字段;默认 false 时不执行 summary 查询 (零开销)

**Checkpoint**: US2 独立可测 —— summary 准确 + 全量 + 性能达标。

---

## Phase 5: Polish

- [X] T019 [P] Run all test suites: `pnpm test` 全绿
- [X] T020 [P] Run [quickstart.md](./quickstart.md) end-to-end validation; tick all 7 SC items
- [X] T021 [P] Performance: 1000 笔 + 筛选 + summary 端到端 P95 < 500ms (SC-002)
- [X] T022 Final code review against Constitution v2.0.0

---

## Dependencies & Execution Order

- Phase 2 (T001-T002) 阻塞所有 US
- US1 (T003-T012) 依赖 Phase 2
- US2 (T013-T018) 依赖 Phase 2 + 数据依赖 US1 (需要筛选能工作才能测 summary)
- Polish 依赖所有 US

## MVP 范围

US1 + US2 一起交付 (筛选 + 小计是流水页的完整体验)。

## Notes

- [P] 任务 = 不同文件,可并行 (本 feature T001/T002 同文件,仅 T002 [P] 因可独立新增函数)
- 不新增表/迁移/schema
- keyword ILIKE 防 SQL 注入: Drizzle 参数化查询
- summary 单独查询: `includeSummary=false` 时零开销
