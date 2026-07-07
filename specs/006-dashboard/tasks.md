---

description: "Task list for 006-dashboard (当月统计 + 最近交易 + 分类占比)"

---

# Tasks: 首页统计 (006-dashboard)

**Input**: Design documents from `/specs/006-dashboard/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/README.md, research.md, quickstart.md

**Tests**: 包含。宪章四 (Test-First)。

**Organization**: 1 US (单 summary 端点),不新增表。

## Format: `- [ ] [ID] [P?] [Story?] Description`

---

## Phase 1: Setup

无新依赖。

---

## Phase 2: Foundational (查询层 + 域纯函数)

- [X] T001 [P] Create `src/server/domain/dashboard/month-range.ts` —— `getUTCMonthRange(date?)` 纯函数返回 `{ start, end }` 半开区间 (research.md Q3),单元可测
- [X] T002 [P] Create `src/server/db/queries/dashboard.ts` —— 3 个聚合查询: `getMonthSummary({ familyId, monthStart, monthEnd })` (SUM CASE WHEN), `getRecentTransactions({ familyId, limit })` (LEFT JOIN + ORDER BY occurredAt DESC LIMIT 5), `getCategoryBreakdown({ familyId, monthStart, monthEnd })` (GROUP BY category_id + SUM ABS amount)

**Checkpoint**: 纯函数 + 3 个查询就绪。

---

## Phase 3: User Story 1 — 首页统计 (Priority: P1) 🎯 MVP

**Goal**: `dashboard.summary` 单端点返回当月收支 + 最近 5 笔 + 分类占比

**Independent Test**: 创建 4 笔交易后调 summary,income=20000, expense=10000, net=10000, recentTransactions=4, topExpenseCategories=2

### Tests for User Story 1 ⚠️ TDD

- [X] T003 [P] [US1] 单元测试 `getUTCMonthRange` —— 验证各月边界 (1月/2月/12月/闰年) 在 `src/tests/unit/server/domain/dashboard/month-range.test.ts`
- [X] T004 [P] [US1] Procedure 契约测试 `dashboard.summary` happy + 401 在 `src/tests/procedure/dashboard.test.ts`
- [X] T005 [P] [US1] 集成测试: 当月收支汇总准确 (SC-003) —— income/expense/net 与手动 SUM 一致 在 `src/tests/integration/dashboard/summary.test.ts`
- [X] T006 [P] [US1] 集成测试: recentTransactions ≤ 5 笔 (SC-007) + 含 JOIN 字段
- [X] T007 [P] [US1] 集成测试: topExpenseCategories 按 amount DESC + percentage 准确 (SC-004)
- [X] T008 [P] [US1] 集成测试: 当月无交易 → 全零 + 空数组 (SC-006)
- [X] T009 [P] [US1] 集成测试: 跨家庭隔离 (SC-005) —— 用户 A 的 summary 不含用户 B 数据
- [X] T010 [P] [US1] 集成测试: 上月交易不计入当月 (FR-007 UTC 月边界)

### Implementation for User Story 1

- [X] T011 [US1] Create dashboard router with `summary` procedure in `src/server/api/routers/dashboard.ts` —— protectedProcedure 无 input,调 `getUTCMonthRange()` 算月范围,`Promise.all` 并行调 3 个查询 (research.md Q1),percentage 应用层算 `Math.round(amount / monthExpense * 100 * 10) / 10` (research.md Q2),response 合并
- [X] T012 [US1] Wire `dashboardRouter` into `appRouter` in `src/server/api/root.ts`

**Checkpoint**: US1 独立可测 —— summary 返回完整首页数据,3 个查询并行。

---

## Phase 4: Polish

- [X] T013 [P] Run all test suites: `pnpm test`
- [X] T014 [P] Run [quickstart.md](./quickstart.md) end-to-end validation; tick all 7 SC items
- [X] T015 [P] Performance: 1000 笔交易 summary P95 < 500ms (SC-002)
- [X] T016 Final code review against Constitution v2.0.0

---

## Dependencies

- Phase 2 (T001-T002) 阻塞 US1
- US1 (T003-T012) 依赖 Phase 2
- Polish 依赖 US1

## MVP 范围

US1 = 整个 feature (单端点)。一次交付。

## Notes

- 不新增表/迁移/schema
- 3 个查询 Promise.all 并行,research.md Q1
- percentage 应用层算,research.md Q2
- UTC 月边界半开区间,research.md Q3
- recentTransactions 不限当月 (首页展示历史最近 5 笔)
