# Tasks: 手机端首页及相关页面重做

**Input**: Design documents from `/specs/027-mobile-home-revamp/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 宪章原则四(测试优先:红→绿→重构)强制 TDD。每个 story 含测试任务,先写测试观察失败,再实现转绿。测试运行器:Vitest(unit / procedure / integration 三 project)。

**Organization**: 按 User Story 分阶段(P0→P1→P2→P3),每阶段独立可测、可交付。US1(宪章修订)是硬前置,阻塞 US4/5/6。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行(不同文件,无未完成任务依赖)
- **[Story]**: 归属 User Story(US1..US6)
- 描述含精确文件路径
- **原则七提醒**:凡触及 `src/components/**/*.tsx`、`src/app/**/*.tsx` 的实现任务,执行前 MUST 先 `/heroui-react` skill 查询 HeroUI v3 API/variant/theming

## Path Conventions

单仓单工程(T3 stack):`src/`(前后端共栈)、`src/tests/`(三 project)、`specs/027-mobile-home-revamp/`(本 feature 文档)。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 确认无新依赖、宪章修订前置物就位。

- [X] T001 确认 `package.json` 无需新增依赖(027 零新依赖,research.md 开头已验证现有栈覆盖);运行 `pnpm install` 确认 lockfile 一致
- [X] T002 [P] 创建 feature 分支基准:确认当前在 `feat/dashboard-ui-refinement`,基于 `main` 切出 `027-mobile-home-revamp`(或继续在现分支,由 git 工作流决定)

**Checkpoint**: 环境就绪,可开始宪章修订。

---

## Phase 2: Foundational — 宪章修订 (US1, BLOCKING) 🎯 MVP 前置

**Purpose**: 解锁 MVP 外范围(转账/预算/资产/退款)。US4/5/6 在本阶段合并前不得产出代码。这是 spec 的 P0。

**⚠️ CRITICAL**: 本阶段未合并,US4/5/6 的代码审查会被宪章检查否决。

**Goal**: 宪章 v3.1.0 → v3.2.0 (MAJOR),原则一移除"转账、预算"禁止项,原则三允许 `Budget`/`Account.type`/`Transaction.toAccountId`。

**Independent Test**: `constitution.md` 头部版本号 = 3.2.0;原则一不再含"转账、预算"字样;原则三不再把 Budget 列为范围外;治理章节最后修订日期更新为 2026-07-14。

### Implementation for US1

- [X] T003 [US1] 修订 `.specify/memory/constitution.md` 原则一:把"未经 PRD 修订,禁止新增范围外功能 —— 转账、预算、AI、OCR、导入导出、投资、多币种等"改写为"未经 PRD 修订,禁止新增范围外功能 —— AI、OCR、导入导出、投资、多币种等。转账、预算、资产聚合、退款自 spec 027-mobile-home-revamp 解锁,纳入 MVP 范围。"
- [X] T004 [US1] 修订 `.specify/memory/constitution.md` 原则三:把"新表(`Asset`、`Debt`、`Budget`、`Investment`)在路线图解锁前属于范围外"改写为"`Budget` 自 027 解锁,作为 `Family` 聚合内实体(按月)。`Asset`/`Debt` 用现有 `Account` 表 + 新增 `type` 字段推导,不新增表。`Investment` 仍属范围外。"
- [X] T005 [US1] 在 `.specify/memory/constitution.md` 头部追加 v3.1.0 → v3.2.0 同步影响报告(MAJOR:原则一/三重定义),并更新治理章节"版本: 3.2.0 | 最后修订: 2026-07-14"。**FR-C002 合规**:本 PR 描述须附 plan.md §"现有代码迁移清单"(满足治理章节 MAJOR 修订"迁移计划"要求)
- [X] T006 [US1] 更新 `docs/AGENTS.md`:第 17 行 "shadcn/ui" → "HeroUI v3 (@heroui/react + @heroui/styles)"(顺带修 v3.0.0 遗留 staleness,见宪章 v3.1.0 遗留 TODO);并在开发原则中补"转账/预算/资产/退款自 027 解锁"

**Checkpoint**: 宪章 v3.2.0 就位。US2/US3(MVP 内 UI 重做)本就可做,现在 US4/5/6 的阻塞解除。建议此处提交一次 commit。

---

## Phase 3: User Story 2 - 首页布局与数据重做 (Priority: P1) 🎯 MVP

**Goal**: 按 spec FR-001..FR-009 + 设计文档§3.1-3.2 重做 `/dashboard`。主数字=本月支出(反转 026 的结余)、**顶部导航(账本名+年月箭头+滑动+消息占位,FR-002)**、Top4 分类(恢复 026 下架的 Top2)、趋势本月每日+上月同期、最近账单左滑删除+撤销、隐私补强(遮蔽 recharts 刻度)、底部导航 4 入口 + FAB。

**Independent Test**: 仅收支两类交易(US4 未落地)即可完整测首页布局/主数字语义/分类/趋势/最近账单左滑/导航 FAB;预算/资产区显示引导态,不阻塞。

### Tests for US2 (TDD — 先红)

- [ ] T007 [P] [US2] 单元测试 `computeExpenseTrendPercent` 扩展:本月 vs 上月对比在 `src/tests/unit/domain/dashboard/trend-comparison.test.ts`(断言 comparisonPercent 计算 + 上月无数据返回 null)
- [ ] T008 [P] [US2] 组件测试:隐私模式遮蔽 recharts YAxis 刻度在 `src/tests/unit/components/expense-trend-chart-privacy.test.tsx`(断言 privacy-on 时 tickFormatter 返回 `••`)
- [ ] T009 [P] [US2] 集成测试:dashboard.summary 返回 Top4 分类 + recentTransactions 长度 5 在 `src/tests/integration/dashboard/summary-top4.test.ts`

### Implementation for US2

- [ ] T010 [US2] 扩展 `src/server/db/queries/dashboard.ts` `getCategoryBreakdown`:slice 改为前 4(026 是前 2);确认 `getRecentTransactions` limit 改 5(026 是 4)
- [ ] T011 [US2] 重做 `src/components/dashboard/expense-trend-chart.tsx`:① YAxis `tickFormatter` 接收 isPrivacy prop,隐私态返回 `••`(research R3);② daily 视图改"本月每日"(非 026 的本周),接收 current + previous 两系列数据(research R6);③ **FR-005"点击数据点查看金额"= recharts Tooltip**(已挂 `data-amount`,隐私态自动遮蔽,research R6),无需独立弹层。**执行前 `/heroui-react` 查 recharts 集成与 HeroUI 主题 token**
- [ ] T012 [US2] 重做 `src/components/dashboard/summary-hero-card`(或新建 `src/components/dashboard/summary-hero-card.tsx`):主数字从 monthNet 改为 **monthExpense**(FR-001),收入/结余为辅。**执行前 `/heroui-react` 查 Card 组合式 API**
- [ ] T013 [US2] 新建 `src/components/dashboard/category-top-list.tsx`:Top4 分类横向进度条(替代下架的 Top2 卡),点击进 `/transactions?month=&type=expense&categoryId=`。**执行前 `/heroui-react`**
- [ ] T014 [US2] 扩展 `src/components/dashboard/recent-transactions.tsx`:加左滑删除(research R7;`/heroui-react` 查 Swipeable 组件,无则轻量自定义 translateX)+ sonner toast 撤销。**撤销语义(H3 收敛)**:删除是 hard delete(026 FR-013),撤销 = 用原 tx 全字段(type/accountId/categoryId/amount/remark/occurredAt)**重新 create** —— 会生成新 id(接受);前端 optimistic 回滚 + React Query 用新行替换旧 key;审计链断开(transaction_events 旧 transaction_id 失效,FK ON DELETE SET NULL 已保留旧审计)属可接受代价
- [ ] T015 [US2] 重做 `src/components/bottom-navigation.tsx`:5 入口含 Drawer → **4 入口 + 独立上凸圆形 FAB**(FR-007;FAB 直进 TransactionDrawer 默认支出,不弹二级层,research R8)。**执行前 `/heroui-react` 查 FAB/Button 绝对定位**
- [ ] T016 [US2] 更新 `src/app/(app)/dashboard/page.tsx`:装配 DashboardTopNav(T066)+ 新 SummaryHeroCard + CategoryTopList + 重做的 ExpenseTrendChart + RecentTransactions;DashboardBody 传入新数据形状
- [ ] T017 [US2] 更新 `src/app/globals.css`:若 recharts YAxis 用 CSS 兜底(非 tickFormatter 方案),补 `.privacy-on` 选择器(research R3 选 tickFormatter 方案则本任务可跳过)
- [ ] T018 [US2] 验证 320px 响应式:首页各模块无横向滚动/重叠/截断(SC-003);手动 + 视口测试

#### FR-002 顶部导航与月份切换(H1 补充,在 T016 装配前完成)

> spec FR-002 要求顶部导航含"账本名称 + 年月 + 上月/下月切换 + 消息入口",切换支持箭头点击与**左右滑动**。当前 026 用 `MonthSelect`(Calendar Drawer),与本 FR 的"箭头+滑动"形态不同,需改造或新建。

- [ ] T066 [US2] 重做首页顶部导航:新建 `src/components/dashboard/dashboard-top-nav.tsx`,含账本名称(取 family/默认"我的账本")+ 年月显示 + 上月/下月箭头按钮 + 左右滑动手势切月(FR-002)。评估:复用 `MonthSelect` 内部 state 还是新建 MonthNav —— 因 MonthSelect 是 Calendar Drawer 形态,与"箭头+滑动"不匹配,**新建 MonthNav**。**执行前 `/heroui-react` 查 Button/手势**
- [ ] T067 [US2] 月份切换未来月份限制:箭头/滑动到未来月时禁用(FR-002"未来月份不可选");边界 = 当前 UTC 月
- [ ] T068 [US2] 消息入口(FR-002):顶部导航右侧放 bell 图标占位按钮;**当前无通知系统后端**,本任务仅做 UI 占位(点击 toast"暂无消息"),功能留 V2。在 spec FR-002 注明"消息功能 V2"

**Checkpoint**: 首页 MVP 内重做完成,可独立交付(预算/资产区显示引导态)。

---

## Phase 4: User Story 3 - 配套页(明细/统计)对齐线稿 (Priority: P2)

**Goal**: 明细页加转账 tab(US4 后)+ 日分组组头小计;统计页加月/年 toggle + 日均/较上期对比 + 消费数据三宫格。

**Independent Test**: 明细页在转账(US4)未落地时用"全部/支出/收入"三 tab 测;统计页三宫格与对比卡纯前端聚合,独立测。

### Tests for US3 (TDD)

- [ ] T019 [P] [US3] 集成测试:明细页按日分组 + 组头小计在 `src/tests/integration/transactions/day-group.test.ts`
- [ ] T020 [P] [US3] 组件测试:统计页月/年 toggle 切换标签在 `src/tests/unit/components/stats-period-toggle.test.tsx`

### Implementation for US3

- [ ] T021 [US3] 扩展 `src/components/transactions/transaction-filters.tsx`:加"转账" tab(US4 落地后生效;US4 前隐藏或空态)。**执行前 `/heroui-react` 查 Tabs**
- [ ] T022 [US3] 新建 `src/components/transactions/transaction-day-group.tsx`:按日分组 + 组头显示当日支出/收入/(转账)小计
- [ ] T023 [US3] 更新 `src/app/(app)/transactions/page.tsx`:用 TransactionDayGroup 替换现有平铺列表
- [ ] T024 [US3] 新建 `src/components/reports/stats-period-toggle.tsx`:月/年 toggle。**执行前 `/heroui-react`**
- [ ] T025 [US3] 新建 `src/components/reports/stats-insights-grid.tsx`:最高支出日/最大单笔/支出次数三宫格(FR-011)
- [ ] T026 [US3] 更新 `src/app/(app)/reports/page.tsx`:集成 StatsPeriodToggle + StatsInsightsGrid + 峰值徽标;月/年切换时标签与聚合同步(月=本月支出/日均;年=全年支出/月均)

**Checkpoint**: 明细/统计页对齐线稿;首页下钻目标(点分类进明细、点趋势进统计)贯通。

---

## Phase 5: User Story 4 - 转账(transfer)交易类型 (Priority: P2)

**Goal**: 引入 transfer 类型 + toAccountId 列;聚合排除 transfer;记一笔表单支持转账模式。依赖 Phase 2(US1 宪章修订)。

**Independent Test**: tRPC `createCaller` + 集成测验证:插入 transfer,断言不进 monthIncome/monthExpense,且双账户余额正确变化。

### Tests for US4 (TDD)

- [ ] T027 [P] [US4] 单元测试 `applySign` 扩展 transfer(返回正)+ `validateTransfer` 同账户拒绝在 `src/tests/unit/domain/transaction/transfer-validate.test.ts`
- [ ] T028 [P] [US4] 集成测试:转账不进收支聚合 + 双账户余额变化在 `src/tests/integration/transaction/transfer.test.ts`(对应 contracts/transaction-create.md Test Scenarios 4-7)

### Implementation for US4

- [ ] T029 [US4] 生成 Drizzle migration:`transactions.type` 枚举增 `transfer` + 新增 `to_account_id` 列 + **seed 系统内置"转账"分类**(M3 决策,name="转账",所有 family 各一条或全局共享,由实现定;transfer 强制引用);验证 down 路径(DROP COLUMN + 删 seed 行;PG 枚举 REMOVE VALUE 需重建类型,见 data-model §1.1)
- [ ] T030 [US4] 更新 `src/server/db/schema/transaction.ts`:`transactionType` 加 `transfer`;新增 `toAccountId` 字段(FK → account,ON DELETE RESTRICT)
- [ ] T031 [US4] 扩展 `src/server/domain/transaction/validate.ts`:`applySign` 加 transfer 分支(返回 abs);新增 `validateTransfer(accountId, toAccountId)` 拒绝同账户(data-model §3.2-3.3)
- [ ] T032 [US4] 扩展 `src/server/api/routers/transaction.ts` `create`:input 改 `z.discriminatedUnion("type", [...])` 含 transfer 模式;transfer 时校验 toAccountId + validateTransfer + 写 to_account_id + **强制 categoryId = 内置"转账"分类 id**(M3,忽略客户端传入,contracts §Business Rule 6);expense 分支加 `isRefund` 标志(C2 退款决策)
- [ ] T033 [US4] 扩展 `src/server/db/queries/dashboard.ts` `getMonthSummary`:SQL 改 type-driven 聚合(`SUM(CASE WHEN type='income'...)` / `SUM(CASE WHEN type='expense' THEN ABS...)`),排除 transfer + 含退款(research R9)
- [ ] T034 [US4] 更新 `src/server/db/queries/transaction.ts` `serializeTransaction`:输出含 toAccountId/toAccountName JOIN
- [ ] T035 [US4] 扩展 `src/components/transaction/transaction-form.tsx`:加 transfer 模式(转出/转入账户选择,toAccountId);mode-row 三态。**执行前 `/heroui-react`**
- [ ] T036 [US4] 更新 `src/components/transactions/transaction-filters.tsx`:启用"转账" tab(Phase 4 T021 预留)
- [ ] T037 [US4] 更新 `docs/DOMAIN.md` + `docs/DATABASE.md`:transfer 语义 + to_account_id 列(宪章开发流程 3)

**Checkpoint**: 转账端到端可用;SC-006(转账隔离 100%)达成。

---

## Phase 6: User Story 5 - 预算进度 (Priority: P3)

**Goal**: budgets 表 + 四态(正常/接近超支 80%/已超支 100%/未设置)+ 首页预算区。依赖 Phase 2(US1)。

**Independent Test**: `createCaller` 测预算 CRUD;组件级测四态渲染(传不同 usage%)。

### Tests for US5 (TDD)

- [ ] T038 [P] [US5] 单元测试 `computeBudgetStatus` 四态边界(50/79.9/80/99.9/100/120/unset)在 `src/tests/unit/domain/dashboard/budget-status.test.ts`(对应 research R4)
- [ ] T039 [P] [US5] 集成测试:预算 upsert + 四态 + 跨家庭隔离在 `src/tests/integration/dashboard/budget.test.ts`(对应 contracts/dashboard-budget.md Test Scenarios)

### Implementation for US5

- [ ] T040 [US5] 生成 Drizzle migration:`budgets` 表 + UNIQUE(family_id, year, month) 索引(`drizzle-kit generate`);验证 down(DROP TABLE)
- [ ] T041 [US5] 新建 `src/server/db/schema/budget.ts`:`budget` pgTable(data-model §1.3);在 `src/server/db/schema/index.ts` re-export
- [ ] T042 [US5] 新建 `src/server/domain/dashboard/budget-status.ts`:`computeBudgetStatus(usedAmount, budgetAmount | null)` 纯函数(research R4,data-model §3.1)
- [ ] T043 [US5] 新建 `src/server/db/queries/budget.ts`:`getBudget(familyId, year, month)` / `upsertBudget` / `deleteBudget`
- [ ] T044 [US5] 扩展 `src/server/api/routers/dashboard.ts`:新增 `budget.get` / `budget.set` / `budget.delete` procedure(contracts/dashboard-budget.md);扩展 `summary` 内联调用 getBudget + computeBudgetStatus(research R2,`.catch(() => null)` 降级)
- [ ] T045 [US5] 新建 `src/components/dashboard/budget-progress.tsx`:四态进度条 + "设置预算"引导(FR-016..FR-019)。**执行前 `/heroui-react` 查 Progress/进度组件**
- [ ] T046 [US5] 更新 `src/app/(app)/dashboard/page.tsx`:装配 BudgetProgress(在收支卡与分类之间);新增预算设置入口(Modal 或轻量引导,`/heroui-react` 定)
- [ ] T047 [US5] 更新 `docs/DOMAIN.md` + `docs/DATABASE.md`:Budget 实体 + 四态规则(宪章开发流程 3)

**Checkpoint**: 预算端到端可用;SC-007(80%/100% 状态)达成。

---

## Phase 7: User Story 6 - 资产概览 (Priority: P3)

**Goal`: accounts.type(asset/debt)列 + 资产三项聚合 + 首页资产区 + 空引导。依赖 Phase 2(US1)。

**Independent Test**: `createCaller` 测资产聚合;组件级测空/有态。

### Tests for US6 (TDD)

- [ ] T048 [P] [US6] 集成测试:资产 type 分组 + transfer 双向余额 + 排除归档在 `src/tests/integration/dashboard/assets.test.ts`(对应 contracts/dashboard-assets.md Test Scenarios)
- [ ] T049 [P] [US6] 集成测试:account.create 含 type + migration 向后兼容(存量 account 全 asset)在 `src/tests/integration/account/create-type.test.ts`

### Implementation for US6

- [ ] T050 [US6] 生成 Drizzle migration:`accounts` 新增 `type` 列(account_type 枚举,NOT NULL DEFAULT 'asset';`drizzle-kit generate`);验证 down(DROP COLUMN + DROP TYPE)
- [ ] T051 [US6] 更新 `src/server/db/schema/account.ts`:新增 `accountType` pgEnum + `type` 字段(data-model §1.2)
- [ ] T052 [US6] 新建 `src/server/db/queries/assets.ts`:`getAssets(familyId)` 单次 CTE 聚合(research R5,含 transfer 双向余额);返回 `{ totalAssets, totalLiabilities, netAssets, accountCount }`
- [ ] T053 [US6] 扩展 `src/server/api/routers/dashboard.ts`:新增 `assets` query procedure(contracts/dashboard-assets.md);扩展 `summary` 内联调用(`.catch(() => null)` 降级)
- [ ] T054 [US6] 扩展 `src/server/api/routers/account.ts` `create`/`update`:input 加 `type`(默认 asset);输出含 type(contracts/account-create.md)
- [ ] T055 [US6] 扩展 `src/components/settings/account-form.tsx`:加 type 选择(asset/debt)。**执行前 `/heroui-react`**
- [ ] T056 [US6] 新建 `src/components/dashboard/asset-overview.tsx`:净资产/总资产/总负债 + accountCount + 空引导(FR-020/FR-021)。**执行前 `/heroui-react`**
- [ ] T057 [US6] 更新 `src/app/(app)/dashboard/page.tsx`:装配 AssetOverview(下滑区底部)
- [ ] T058 [US6] 更新 `docs/DOMAIN.md` + `docs/DATABASE.md`:Account.type + 资产聚合规则(宪章开发流程 3)

**Checkpoint**: 资产端到端可用;SC-005(空态引导)+ 资产三项达成。全部 US 完成。

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 跨 US 的收尾。

- [ ] T059 [P] 实现已收敛的退款决策(非"待定"):expense 分支加 `isRefund: boolean`(默认 false);procedure 对 `isRefund=true` 跳过 applySign、直接存 +abs(amount);applySign 函数不改。补集成测试:某分类 -¥100 expense + ¥30 退款(isRefund=true)→ getCategoryBreakdown 该分类 = ¥70(research R9 + contracts/transaction-create.md §Business Rule 3 + data-model §3.2)
- [ ] T060 [P] 更新 `src/components/dashboard/recent-transactions.tsx` 的 Transaction 接口:加 toAccountId/toAccountName(供 transfer 展示)
- [ ] T061 [P] 验证全应用隐私覆盖:grep `[data-amount]` 覆盖所有金额节点 + recharts 刻度 + 点击 Tooltip(SC-004)
- [ ] T062 运行 `quickstart.md` 全部 6 个端到端场景(A-F)手动验证
- [ ] T063 [P] 运行全部测试套件:`pnpm test:unit && pnpm test:procedure && pnpm test:integration`,全绿
- [ ] T064 性能验证:dashboard.summary p95 < 500ms(6 并行 task)、transaction.create(transfer)p95 < 300ms(宪章五)
- [ ] T065 更新 `specs/027-mobile-home-revamp/plan.md` Constitution Check post-design 标注的实现完成状态(若需)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,立即开始
- **Foundational — 宪章修订 (Phase 2 / US1)**: ⚠️ **BLOCKS US4/US5/US6**。US2/US3(MVP 内)不依赖宪章修订,可与此并行或先做
- **US2 (Phase 3 / P1)**: MVP 内 UI 重做,不依赖宪章修订;建议作为第一个可交付增量
- **US3 (Phase 4 / P2)**: 不依赖宪章修订(转账 tab 在 US4 后生效);依赖 US2 的首页下钻目标
- **US4 (Phase 5 / P2)**: ⚠️ 依赖 Phase 2(US1 宪章修订)合并
- **US5 (Phase 6 / P3)**: ⚠️ 依赖 Phase 2(US1)+ Phase 3(US2 首页装配位)
- **US6 (Phase 7 / P3)**: ⚠️ 依赖 Phase 2(US1)+ Phase 3(US2 首页装配位)
- **Polish (Phase 8)**: 依赖全部所需 US 完成

### User Story Dependencies

- **US1 (P0)**: 硬前置,最先做;阻塞 US4/5/6
- **US2 (P1)**: 无 story 间依赖;MVP 首增量
- **US3 (P2)**: 依赖 US2(下钻目标);转账 tab 依赖 US4
- **US4 (P2)**: 依赖 US1(宪章)+ 受 US2 FAB 弹层约束
- **US5 (P3)**: 依赖 US1 + US2(首页装配位)
- **US6 (P3)**: 依赖 US1 + US2(首页装配位)

### Within Each User Story

- 测试先写、观察失败(红)
- schema/领域函数 → procedure → UI
- UI 任务执行前 `/heroui-react` skill(原则七)
- 单 story 完成即可独立验证

### Parallel Opportunities

- Phase 1: T001/T002 不同文件可并行
- Phase 2(US1): T003/T004 改同一文件串行;T006(docs/AGENTS.md)可与 T003-T005 并行
- Phase 3(US2): 测试 T007/T008/T009 不同文件可并行;UI 任务因多触及 dashboard/page.tsx 多数串行,但 T013(新组件)/T015(导航)可并行
- Phase 5(US4): 测试 T027/T028 并行;schema T029/T030 串行;T035(表单)/T036(筛选)可与后端任务并行
- Phase 6(US5)/Phase 7(US6): US5 与 US6 依赖 US1+US2 但互不依赖,**可完全并行**(不同 schema/procedure/组件)
- Phase 8: T059/T060/T061 不同文件并行

---

## Parallel Example: US5 与 US6 并行

```bash
# US5(预算)与 US6(资产)依赖相同(US1+US2)但互不依赖,可并行:
# Developer A — US5:
Task T040: budgets migration
Task T041: schema/budget.ts
Task T042: domain/dashboard/budget-status.ts
Task T043: queries/budget.ts
Task T044: dashboard.ts budget procedures
Task T045: budget-progress.tsx

# Developer B — US6(同时):
Task T050: accounts.type migration
Task T051: schema/account.ts type 字段
Task T052: queries/assets.ts
Task T053: dashboard.ts assets procedure
Task T054: account router type
Task T056: asset-overview.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1: Setup
2. Phase 2: US1 宪章修订(解锁后续)
3. Phase 3: US2 首页 MVP 内重做(主数字支出/Top4/趋势/左滑/导航/隐私)
4. **STOP and VALIDATE**: 首页可独立交付(预算/资产显示引导态);SC-001/003/004/005 达成
5. 可部署/demo

### Incremental Delivery

1. Setup + US1 → 宪章解锁
2. + US2 → 首页 MVP(可交付)
3. + US3 → 明细/统计对齐(下钻贯通)
4. + US4 → 转账(SC-006)
5. + US5 → 预算(SC-007)
6. + US6 → 资产(全部 SC 达成)
7. Polish → quickstart 验证 + 性能 + 文档

### Parallel Team Strategy

- 单人维护(宪章背景):建议严格 P0→P1→P2→P3 顺序
- US5/US6 是唯一可并行对(依赖相同、文件不冲突)

---

## Notes

- [P] 任务 = 不同文件、无未完成任务依赖
- [Story] 标签映射到 spec.md 的 US1..US6
- 每个 US 独立可完成、可测试
- 宪章原则四:测试先红再绿
- 宪章原则七:每个触及 tsx 的任务执行前 `/heroui-react` skill
- 宪章开发流程:每完成一功能同步迁移/tRPC/文档/测试四项
- 每个 task 或逻辑组后 commit
- 在 checkpoint 处可暂停验证单 story
