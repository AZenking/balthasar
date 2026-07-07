---

description: "Task list for 004-transaction (T3 Stack + Drizzle,交易 CRUD + 10s 热路径)"

---

# Tasks: 交易管理 (004-transaction)

**Input**: Design documents from `/specs/004-transaction/`

**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/README.md, research.md, quickstart.md

**Tests**: 包含。宪章四 (Test-First) 不可妥协。

**Organization**: 按 User Story 分阶段。4 个 US 全 P1 (create/get/list+update/delete)。

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: 可并行 (不同文件,无依赖)
- **[Story]**: 该任务属于哪个 US
- 所有路径相对仓库根;代码在 `src/`

## Path Conventions

复用 001/002/003 的 `src/` 工程。

---

## Phase 1: Setup

无新依赖 (复用 001/002/003 工程)。

---

## Phase 2: Foundational (跨 US 共享前置)

**Purpose**: Schema + 迁移 + Domain 纯函数 + 审计 helper

**⚠️ CRITICAL**: 此阶段未完成,US1-US4 均无法启动

### 数据层

- [X] T001 [P] Create transactions Drizzle schema in `src/server/db/schema/transaction.ts` per [data-model.md](./data-model.md) —— pgEnum `transaction_type` (income|expense) + signed bigint amount + 4 复合索引 (family_occurred / family_type / family_account / family_category)
- [X] T002 [P] Create transaction_events Drizzle schema in `src/server/db/schema/transaction-events.ts` per data-model.md —— pgEnum 3 值 (transaction_created/edited/deleted) + **FK `transaction_id` ON DELETE SET NULL** (F1 修复:删除交易时审计行保留,transaction_id 置 null,支持 transaction_deleted 追溯)
- [X] T003 Update `src/server/db/schema/index.ts` 追加 export `./transaction` + `./transaction-events`
- [X] T004 Generate Drizzle migration `src/server/db/migrations/0004_transactions.sql` via `pnpm db:generate` (CREATE 2 张表 + 4 + 1 索引)
- [X] T005 Update `src/server/db/migrations/meta/_journal.json` 追加 0004 entry

### Domain 纯函数

- [X] T006 [P] Create `src/server/domain/transaction/validate.ts` —— `applySign(type, amount) → signedAmount` (income → 正、expense → 负,research.md Q1) + `validateOccurredAt(date)` (≤ now + 1 day 容差) + `validateRemark(text)` (≤ 200 字符)

### 审计 helper

- [X] T007 [P] Create `src/server/db/queries/transaction-events.ts` —— `writeTransactionEvent(tx, { eventType, transactionId, actorMemberId, before, after })` **接受事务 client 作为首参** (research.md Q1+Q4),内含 `redactSensitiveKeys` 防御 (复用 002 account-events 模式)

**Checkpoint**: schema + 迁移 + domain + 审计 helper 就绪。可进入 US 实现。

---

## Phase 3: User Story 1 — 创建交易 (Priority: P1) 🎯 MVP

**Goal**: 已认证用户在家庭下创建交易 (type/account/category/amount/remark/occurredAt),后端按 type 加符号,审计同步写入

**Independent Test**: create 成功后 DB 新增 1 行 transactions (amount signed) + 1 行 transaction_events (transaction_created)

### Tests for User Story 1 ⚠️ TDD

- [X] T008 [P] [US1] Procedure 契约测试 `transaction.create` happy path 在 `src/tests/procedure/transaction.test.ts`
- [X] T009 [P] [US1] Procedure 契约测试 400 (type 非法 / amount ≤ 0 / amount 非整数 / remark > 200 / occurredAt 未来日期) 在 `src/tests/procedure/transaction.test.ts`
- [X] T010 [P] [US1] 单元测试 `applySign` (income→正、expense→负、零边界) + `validateOccurredAt` (过去/今天/未来±1d) + `validateRemark` (空/200/201) 在 `src/tests/unit/server/domain/transaction/validate.test.ts`
- [X] T011 [P] [US1] 集成测试: create 写入 signed amount (type=expense → DB amount < 0,type=income → > 0) 在 `src/tests/integration/transaction/create.test.ts`
- [X] T012 [P] [US1] 集成测试: type 与 categoryId 不匹配 → 400 (SC-008,FR-006)
- [X] T013 [P] [US1] 集成测试: 跨家庭 accountId → 400 (FR-015);已归档账户 → 400 (FR-005,SC-009)
- [X] T014 [P] [US1] 集成测试: transaction_created 审计同步写入 (FR-016,SC-007 jsonb 无敏感字段)

### Implementation for User Story 1

- [X] T015 [P] [US1] Create `src/server/db/queries/transaction.ts` —— `createTransaction(tx, input)` (insert transaction row with signed amount) + `validateAccountAndCategory(tx, { accountId, categoryId, familyId, type })` (短路校验链: account 属于家庭+未归档 → category 存在+type 匹配,research.md Q2+Q6)
- [X] T016 [US1] Create transaction router with `create` procedure in `src/server/api/routers/transaction.ts` —— protectedProcedure,zod input (type/accountId/categoryId/amount/remark?/occurredAt?),调用 `loadFamilyAndMemberIdsByUserId` + `validateAccountAndCategory` + `applySign` + `db.transaction` 同事务写 transaction + writeTransactionEvent
- [X] T017 [US1] Wire `transactionRouter` into `appRouter` in `src/server/api/root.ts` —— 显式并列 `router({ auth, account, category, transaction })`

**Checkpoint**: US1 独立可测 —— create 返回交易 + JOIN 字段,DB amount signed,审计写入。

---

## Phase 4: User Story 2 — 查询交易 (get + list) (Priority: P1)

**Goal**: 已认证用户用 ID 查交易详情 (含 JOIN accountName/categoryName/icon) + 列表查询 (cursor 分页)

**Independent Test**: get 返回完整字段 + JOIN;list 默认 50 条按 occurredAt DESC;跨家庭 get → 404

### Tests for User Story 2 ⚠️ TDD

- [X] T018 [P] [US2] Procedure 契约测试 `transaction.get` happy + 404 + 401 在 `src/tests/procedure/transaction.test.ts`
- [X] T019 [P] [US2] Procedure 契约测试 `transaction.list` 无参 (默认 limit=50) + cursor 分页 + 401 在 `src/tests/procedure/transaction.test.ts`
- [X] T020 [P] [US2] 集成测试: get 返回 JOIN 字段 (accountName, categoryName, categoryIcon) 在 `src/tests/integration/transaction/get.test.ts`
- [X] T021 [P] [US2] 集成测试: 跨家庭 get → 404 (FR-014,SC-004)
- [X] T022 [P] [US2] 集成测试: list cursor 分页 —— 第一页 nextCursor 非空,第二页用 cursor 取后续 在 `src/tests/integration/transaction/list.test.ts`
- [X] T023 [P] [US2] 集成测试: list 按 occurredAt DESC 排序

### Implementation for User Story 2

- [X] T024 [P] [US2] Add `getTransactionById(tx, { id, familyId })` + `listTransactions({ familyId, limit, cursor })` 到 `src/server/db/queries/transaction.ts` —— get 用 Drizzle leftJoin account + category (research.md Q3);list 用 cursor 分页 (`limit + 1` 检测 hasMore,research.md Q5)
- [X] T025 [US2] Add `get` + `list` procedures 到 `src/server/api/routers/transaction.ts` —— get: `{ id: uuid }`,NOT_FOUND if missing/跨家庭;list: `{ limit?: 1-100 default 50, cursor?: ISO datetime }.optional()`

**Checkpoint**: US2 独立可测 —— get 返回 JOIN + 404,list cursor 分页 + DESC 排序。

---

## Phase 5: User Story 3 — 编辑交易 (Priority: P1)

**Goal**: 用户编辑交易可变字段,LWW,改 type 时同步校验 categoryId

**Independent Test**: 编辑后 updatedAt 更新 (SC-005);改 type 不换 categoryId → 400;跨家庭 → 404

### Tests for User Story 3 ⚠️ TDD

- [X] T026 [P] [US3] Procedure 契约测试 `transaction.update` happy (改 remark / amount / occurredAt) 在 `src/tests/procedure/transaction.test.ts`
- [X] T027 [P] [US3] Procedure 契约测试 update 改 type 但 categoryId 不匹配 → 400 (FR-012)
- [X] T028 [P] [US3] 集成测试: SC-005 updatedAt > 原 createdAt (Drizzle $onUpdate) 在 `src/tests/integration/transaction/update.test.ts`
- [X] T029 [P] [US3] 集成测试: 跨家庭 update → 404 (SC-004)
- [X] T030 [P] [US3] 集成测试: transaction_edited 审计写入 (before/after 仅可变字段,SC-007)

### Implementation for User Story 3

- [X] T031 [US3] Add `update` procedure 到 `src/server/api/routers/transaction.ts` —— protectedProcedure,input `{ id, type?, accountId?, categoryId?, amount?, remark?, occurredAt? }` + refine (至少一个字段),单查询 WHERE id AND family_id (SC-004),若改 type 或 categoryId 重新校验匹配,db.transaction 同事务 update + writeTransactionEvent(transaction_edited, before/after)

**Checkpoint**: US3 独立可测。SC-004/005/007 通过。

---

## Phase 6: User Story 4 — 删除交易 (Priority: P1)

**Goal**: 硬删除交易,重复删除 → 404,审计 before-only

**Independent Test**: 删除后 DB 行消失;重复 delete → 404;审计 transaction_deleted before=快照 after=null

### Tests for User Story 4 ⚠️ TDD

- [X] T032 [P] [US4] Procedure 契约测试 `transaction.delete` happy + 404 + 401 在 `src/tests/procedure/transaction.test.ts`
- [X] T033 [P] [US4] 集成测试: 硬删除后 DB 行消失 (SC-006) 在 `src/tests/integration/transaction/delete.test.ts`
- [X] T034 [P] [US4] 集成测试: 重复删除 → 404 (非 500,SC-006)
- [X] T035 [P] [US4] 集成测试: 跨家庭 delete → 404 (SC-004)
- [X] T036 [P] [US4] 集成测试: transaction_deleted 审计 before=被删行快照 after=null (Q4) —— **审计行在删除后仍保留** (F1 修复: FK ON DELETE SET NULL,transaction_id 变 null 但审计本身留存),验证: 删除后 SELECT transaction_events WHERE event_type='transaction_deleted' 仍能查到

### Implementation for User Story 4

- [X] T037 [US4] Add `delete` procedure 到 `src/server/api/routers/transaction.ts` —— protectedProcedure,单查询 WHERE id AND family_id 取行,若不存在 NOT_FOUND;db.transaction 同事务: 先 writeTransactionEvent(transaction_deleted, before=row 快照, after=null) 再 tx.delete(transaction) (顺序无关紧要,因为 FK ON DELETE SET NULL —— 审计行不会被删除,transaction_id 会变 null)

**Checkpoint**: US4 独立可测。SC-006 通过。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全 story 共享的最终质量门

- [X] T038 [P] Run all test suites: `pnpm test:coverage` (domain > 90%, procedure > 80%, integration > 70%)
- [X] T039 [P] Run [quickstart.md](./quickstart.md) end-to-end validation; tick all 10 SC items
- [X] T040 [P] Performance: create P95 < 300ms (SC-002) + get P95 < 100ms (SC-003) 端到端验证
- [X] T041 [P] Security review: grep `password` / `token` across `transaction_events.before` / `.after` jsonb —— must be 0 hits (SC-007)
- [X] T042 Update `docs/DATABASE.md` 加入 transactions + transaction_events 表 + signed amount 说明
- [X] T043 Update `docs/DOMAIN.md` 加入 Transaction 实体 (Family 聚合下,signed amount,LWW,硬删除)
- [X] T044 Final code review against Constitution v2.0.0

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 跳过
- **Foundational (Phase 2)**: T001-T007,**阻塞所有 US**
- **US1 create (Phase 3)**: 依赖 Phase 2
- **US2 get+list (Phase 4)**: 依赖 Phase 2 + 数据依赖 US1
- **US3 update (Phase 5)**: 依赖 Phase 2 + 数据依赖 US1
- **US4 delete (Phase 6)**: 依赖 Phase 2 + 数据依赖 US1
- **Polish (Phase 7)**: 依赖所有 US

### 并行机会

- Phase 2 内 T001/T002 (2 schema) + T006/T007 (domain + audit helper) 全部 [P]
- 每 US 内契约测试 [P] 并行编写
- 每 US 内集成测试 [P] 并行编写

---

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 Phase 2: Foundational
2. 完成 Phase 3: US1 create
3. **STOP**: SC-001/002/008/009 验证
4. 此时用户能"记账"但看不到流水 (US2 未做) —— 建议 US1+US2 一起

### 推荐最小可发布切片: US1 + US2

create + list/get = 记账 + 查看,完整闭环。US3 (编辑) + US4 (删除) 作为快速跟进。

### 增量交付

1. Foundational → 基础就绪
2. + US1 → 记账 (Demo!)
3. + US2 → 查看 (实用闭环)
4. + US3 → 改错
5. + US4 → 删除
6. Polish → 发布

---

## Notes

- [P] 任务 = 不同文件,无依赖,可并行
- [Story] 标签把任务映射到 spec.md 的 User Story
- 每个 US 末尾必须可独立 demo
- 测试任务先于实现任务 (宪章四)
- amount signed (Clarification Q1): domain 层 `applySign` 转换,响应 `Math.abs()`
- 审计写入与业务写入同事务 (research.md Q1+Q6 短路校验链)
- 硬删除 (FR-013): 与 002-account 归档不同,交易允许真删
- 删除审计顺序: 先写 audit 再 delete row (CASCADE 语义)
