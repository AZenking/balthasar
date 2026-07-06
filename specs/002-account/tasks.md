---

description: "Task list for 002-account (T3 Stack + Drizzle,家庭记账账户管理)"

---

# Tasks: 账户管理 (002-account)

**Input**: Design documents from `/specs/002-account/`

**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/README.md, research.md, quickstart.md

**Tests**: 包含。宪章四 (Test-First) 不可妥协 —— 每个用例按"测试先行"组织。

**Organization**: 按 User Story 分阶段。每 US 可独立实现+测试+部署。

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: 可并行 (不同文件,无依赖)
- **[Story]**: 该任务属于哪个 US
- 所有路径相对仓库根;代码在 `src/`

## Path Conventions

复用 001 的 `src/` 工程:
- 后端 router: `src/server/api/routers/`
- Schema: `src/server/db/schema/`
- Query 模块: `src/server/db/queries/`
- Domain 纯函数: `src/server/domain/account/`
- 测试: `src/tests/{unit,procedure,integration}/`

---

## Phase 1: Setup

无新依赖,跳过 (复用 001 的 T3 Stack 工程)。

---

## Phase 2: Foundational (跨 US 共享前置)

**Purpose**: Schema + 迁移 + Domain 纯函数

**⚠️ CRITICAL**: 此阶段未完成,US1-US4 均无法启动

### 数据层

- [X] T001 [P] Create accounts Drizzle schema in `src/server/db/schema/account.ts` per [data-model.md](./data-model.md) §`accounts` —— 含 partial index `WHERE archived_at IS NULL` (research.md Q2)
- [X] T002 [P] Create account_events Drizzle schema in `src/server/db/schema/account-events.ts` per data-model.md §`account_events` —— `pgEnum` 4 值 (account_created/edited/archived/unarchived) + 索引 `(account_id, occurred_at DESC)`
- [X] T003 Update `src/server/db/schema/index.ts` 追加 export `./account` + `./account-events`
- [X] T004 Generate Drizzle migration `src/server/db/migrations/0002_accounts.sql` via `pnpm db:generate` (覆盖 2 张新表 + 索引)

### Domain 纯函数

- [X] T005 [P] Create `src/server/domain/account/currency.ts` —— `SUPPORTED_CURRENCIES` 常量 (CNY/USD/EUR/JPY/HKD/GBP/AUD/CAD/SGD)、`CURRENCY_MINOR_UNITS` 映射、`isSupportedCurrency(code)` 类型守卫 (research.md Q7)
- [X] T006 [P] Create `src/server/domain/account/validate.ts` —— `validateAccountName(name)` (1-50 字符,UTF-16 code unit 计)、`validateInitialBalance(n)` (整数 + JS safe number 范围 + 允许负数)

### Query 模块

- [X] T007 [P] Create `src/server/db/queries/account.ts` —— 暴露 `loadFamilyIdByUserId(userId)` **便捷包装**: 复用 001 的 `loadFamilyAndMemberByUserId(userId)` (来自 `src/server/db/queries/family-member.ts`),仅取 `family.id` 字段返回,**不重复查询逻辑**;若 family 不存在抛 `INTERNAL_SERVER_ERROR`

**Checkpoint**: schema + 迁移 + domain 就绪。可进入 US 实现。

---

## Phase 3: User Story 1 — 创建账户 (Priority: P1) 🎯 MVP

**Goal**: 已认证用户在默认家庭下创建账户,服务端派生 familyId,审计同步写入 `account_events`

**Independent Test**: create procedure 成功后,accounts 表新增 1 行 + account_events 表新增 1 条 `account_created` 事件,familyId = 当前 session 用户的家庭 ID

### Tests for User Story 1 ⚠️ TDD

- [X] T008 [P] [US1] Procedure 契约测试 `account.create` happy path 在 `src/tests/procedure/account.test.ts` —— createCaller 调用,mock db queries,断言返回 user/family/account 形状
- [X] T009 [P] [US1] Procedure 契约测试 400 (空名称 / 名称 > 50 / 币种非白名单 / initialBalance 非整数) 在 `src/tests/procedure/account.test.ts`
- [X] T010 [P] [US1] 单元测试 currency (9 个有效代码 + RMB/abc 无效) 在 `src/tests/unit/server/domain/account/currency.test.ts`
- [X] T011 [P] [US1] 单元测试 validate (名称边界 0/1/50/51、Unicode 计数、initialBalance 负数 / 浮点 / 超 Number.MAX_SAFE_INTEGER) 在 `src/tests/unit/server/domain/account/validate.test.ts`
- [X] T012 [P] [US1] 集成测试: create 写入 accounts 行 (archivedAt=null,familyId 服务端派生) 在 `src/tests/integration/account/create.test.ts`
- [X] T013 [P] [US1] 集成测试: familyId 服务端派生 (FR-006) —— 请求 body 不含 familyId,DB 行 familyId 仍等于当前用户家庭
- [X] T014 [P] [US1] 集成测试: account_created 审计同步写入 (FR-015 + SC-004 jsonb 无敏感字段)

### Implementation for User Story 1

- [X] T015 [P] [US1] Create `src/server/db/queries/account-events.ts` —— `writeAccountEvent(tx, { eventType, accountId, actorMemberId, before, after })` **接受事务 client 作为首参** (research.md Q6 要求审计与业务同事务);内含 `redactSensitiveKeys` 防御 (复用 001 audit.ts 模式),严禁 password/token/session/ip/ua
- [X] T016 [US1] Create account router with `create` procedure in `src/server/api/routers/account.ts` —— zod input (name/currency/initialBalance,不含 familyId)、调用 `loadFamilyIdByUserId` 派生 familyId、`db.transaction(async (tx) => { ... })` 同事务内:先 `tx.insert(account)`,再 `writeAccountEvent(tx, {...})`
- [X] T017 [US1] Wire `accountRouter` into `appRouter` in `src/server/api/root.ts` —— 显式并列: `appRouter = router({ auth: authRouter, account: accountRouter })` (不使用 mergeRouters,保持现有 authRouter 不动)

**Checkpoint**: US1 独立可测 —— `pnpm dev` 后调 `/api/trpc/account.create` 返回 200,DB 中 1 行 account + 1 条 account_created 审计。

---

## Phase 4: User Story 2 — 查看账户列表 (Priority: P1)

**Goal**: 已认证用户能看到自己家庭下的所有账户 (默认排除归档),按 createdAt 倒序;支持 includeArchived=true

**Independent Test**: 创建 N 个账户 (含归档的),list 返回正确数量与排序,跨家庭隔离

### Tests for User Story 2 ⚠️ TDD

- [ ] T018 [P] [US2] Procedure 契约测试 `account.list` 默认排除归档 在 `src/tests/procedure/account.test.ts`
- [ ] T019 [P] [US2] Procedure 契约测试 `account.list` `includeArchived=true` 返回全部
- [ ] T020 [P] [US2] Procedure 契约测试 排序按 createdAt DESC
- [ ] T021 [P] [US2] 集成测试: 跨家庭隔离 (SC-003) —— 用户 A 创建账户,用户 B list 不见 在 `src/tests/integration/account/list.test.ts`
- [ ] T022 [P] [US2] 性能测试: 100 账户规模 P95 < 200ms (SC-002) 在 `src/tests/integration/account/list.test.ts`

### Implementation for User Story 2

- [ ] T023 [US2] Add `list` procedure 在 `src/server/api/routers/account.ts` —— protectedProcedure,input `{ includeArchived?: boolean }`,WHERE `family_id = $currentFamilyId`,默认额外 `AND archived_at IS NULL` (利用 partial index),ORDER BY `created_at DESC`

**Checkpoint**: US2 独立可测 —— list 返回当前家庭账户,跨家庭不可见,P95 < 200ms。

---

## Phase 5: User Story 3 — 编辑账户 (Priority: P1)

**Goal**: 用户改名称/币种,初始余额不可改 (SC-007),已归档账户不可编辑 (FR-011)

**Independent Test**: update 成功后 updatedAt 更新,initialBalance 不变;归档后 update 失败;跨家庭 update → NOT_FOUND

### Tests for User Story 3 ⚠️ TDD

- [ ] T024 [P] [US3] Procedure 契约测试 `account.update` happy path (name + currency 各改一次) 在 `src/tests/procedure/account.test.ts` —— **断言 `response.updatedAt > 创建时 createdAt`** (SC-006 显式验证 Drizzle `$onUpdate` 钩子生效)
- [ ] T025 [P] [US3] Procedure 契约测试 `account.update` 拒绝 `initialBalance` 字段 (SC-007) —— input schema 不含此字段,DB 不变
- [ ] T026 [P] [US3] 集成测试: 已归档账户 update → CONFLICT (FR-011) 在 `src/tests/integration/account/update.test.ts`
- [ ] T027 [P] [US3] 集成测试: 跨家庭 update → NOT_FOUND (SC-003,不暴露存在性)
- [ ] T028 [P] [US3] 集成测试: account_edited 审计写入 (FR-015),before/after jsonb 仅含可变字段 (name/currency),无敏感字段

### Implementation for User Story 3

- [ ] T029 [US3] Add `update` procedure 在 `src/server/api/routers/account.ts` —— protectedProcedure,input `{ id, name?, currency? }` (注意无 initialBalance),WHERE `id AND family_id` 单查询取行,若 archivedAt IS NOT NULL 抛 CONFLICT,`db.transaction` 同事务更新 + 写 account_event (`account_edited`,before/after = 编辑前后可变字段)

**Checkpoint**: US3 独立可测。SC-003 / SC-006 / SC-007 通过。

---

## Phase 6: User Story 4 — 归档/取消归档 (Priority: P2)

**Goal**: 软删除账户 + 可恢复,操作幂等 (SC-004),审计同步写入

**Independent Test**: 归档后默认 list 不可见,includeArchived=true 可见;取消归档后回到默认 list;重复操作不报错

### Tests for User Story 4 ⚠️ TDD

- [ ] T030 [P] [US4] Procedure 契约测试 `account.archive` happy path 在 `src/tests/procedure/account.test.ts`
- [ ] T031 [P] [US4] Procedure 契约测试 `account.unarchive` happy path
- [ ] T032 [P] [US4] 集成测试: 归档幂等 (SC-004) —— 已归档再归档不报错,archivedAt 保持原值 在 `src/tests/integration/account/archive.test.ts`
- [ ] T033 [P] [US4] 集成测试: 取消归档幂等 —— 未归档直接 unarchive 不报错,archivedAt=null
- [ ] T034 [P] [US4] 集成测试: account_archived / account_unarchived 审计写入 (FR-015)
- [ ] T035 [P] [US4] 集成测试: 跨家庭 archive/unarchive → NOT_FOUND (SC-003)

### Implementation for User Story 4

- [ ] T036 [US4] Add `archive` procedure 在 `src/server/api/routers/account.ts` —— protectedProcedure,WHERE `id AND family_id`,若已 archivedAt IS NOT NULL 直接返回当前行 (幂等);否则 SET archivedAt=now() + 写 account_event
- [ ] T037 [US4] Add `unarchive` procedure 在 `src/server/api/routers/account.ts` —— **顺序执行** (与 T036 修改同一文件,移除 [P]);类似 archive,反向逻辑;若 archivedAt IS NULL 直接返回 (幂等);否则 SET archivedAt=NULL + 写 account_event

**Checkpoint**: US4 独立可测。SC-004 通过。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全 story 共享的最终质量门

- [ ] T038 [P] Run all test suites green: `pnpm test` with coverage (domain > 90%, procedure > 80%, integration > 70%)
- [ ] T039 [P] Run [quickstart.md](./quickstart.md) end-to-end manual validation; tick all 7 SC items
- [ ] T040 [P] Security review: grep `password` / `token` / `session` across `account_events.before` / `.after` jsonb —— must be 0 hits (SC-004 同源约束)
- [ ] T041 Performance: 100 账户规模 list P95 < 200ms 端到端验证 (SC-002,可用 autocannon)
- [ ] T042 Update `docs/DATABASE.md` 加入 `accounts` + `account_events` 表
- [ ] T043 Update `docs/DOMAIN.md` 加入 Account 实体 (Family 聚合下的实体,跨聚合引用 `account.familyId`)
- [ ] T044 Final code review against Constitution v2.0.0 —— 验证无 Principle 违反 (尤其 Principle II Feature-Sliced + Principle IV no-DB-mocks + Principle III DDD Family 聚合)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 跳过 (复用 001)
- **Foundational (Phase 2)**: T001-T007,**阻塞所有 US**
- **US1 (Phase 3)**: 依赖 Phase 2
- **US2 (Phase 4)**: 依赖 Phase 2 + 数据依赖 US1 (需有账户才能 list)
- **US3 (Phase 5)**: 依赖 Phase 2 + 数据依赖 US1 (需有账户才能 update)
- **US4 (Phase 6)**: 依赖 Phase 2 + 数据依赖 US1 (需有账户才能 archive)
- **Polish (Phase 7)**: 依赖所有 US 完成

### User Story 独立性

- **US1 创建**: 完全独立,Foundational 后即可启动
- **US2 列表**: 数据依赖 US1 (集成测试用 US1 流程准备账户)
- **US3 编辑**: 数据依赖 US1
- **US4 归档**: 数据依赖 US1

### Story 内部顺序

- 测试 FIRST (TDD, 宪章四),观察失败
- Schema → Query module → Domain 纯函数 → Router procedure → appRouter 挂载
- 每个 US 末尾必须可独立 demo

### 并行机会

- Phase 2 内 T001/T002 (2 schema 文件) 全部 [P]
- Phase 2 内 T005/T006/T007 (3 个独立模块) 全部 [P]
- 每个 US 内的 procedure 契约测试 [P],可并行编写

---

## Parallel Example

```bash
# Phase 2 Foundational — 4 路并行写 schema + domain + query
Task T001: "Create accounts Drizzle schema in src/server/db/schema/account.ts"
Task T002: "Create account_events Drizzle schema in src/server/db/schema/account-events.ts"
Task T005: "Create currency domain in src/server/domain/account/currency.ts"
Task T006: "Create validate domain in src/server/domain/account/validate.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 Phase 2: Foundational
2. 完成 Phase 3: US1 创建账户
3. **STOP and VALIDATE**: SC-001 / SC-003 / SC-005 通过
4. 此时用户可"创建账户"但看不到列表 (US2 未做) —— 实用性低,建议至少完成 US1+US2

### 推荐最小可发布切片: US1 + US2

创建 + 列表 = 账户管理基础闭环。US3 (编辑) + US4 (归档) 作为快速跟进。

### 增量交付

1. Foundational → 基础就绪
2. + US1 → 创建账户 (Demo!)
3. + US2 → 列表可见 (实用闭环)
4. + US3 → 可改名 (纠错)
5. + US4 → 可归档 (卫生)
6. Polish → 准备发布

---

## Notes

- [P] 任务 = 不同文件,无依赖,可并行
- [Story] 标签把任务映射到 spec.md 的 User Story
- 每个 US 末尾的 Checkpoint 必须可独立 demo
- 测试任务先于实现任务 (宪章四)
- 每完成一个 US,运行 `pnpm test` 必须全绿
- 完成所有任务后,运行 quickstart.md 的 7 项 SC 验证
- 任务粒度: 每个 Schema / Domain / Query / Procedure / Hook 为独立任务
- 本 feature 不动 001 的 8 张表 schema,只追加 `accounts` + `account_events`
