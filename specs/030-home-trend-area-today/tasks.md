---

description: "Task list for feature 030-home-trend-area-today"
---

# Tasks: 首页趋势图改面积平滑 + 本日支出

**Input**: Design documents from `/specs/030-home-trend-area-today/`

**Prerequisites**: [plan.md](./plan.md)(required), [spec.md](./spec.md)(required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/dashboard-summary.md](./contracts/dashboard-summary.md), [quickstart.md](./quickstart.md)

**Tests**: ✅ **包含测试任务**。宪章原则四(测试优先)强制 red→green→refactor;spec/contract 已给出具体 test scenarios(12-17)。每 US 先写红测试、观察失败、再实现转绿。

**Organization**: 按 User Story 分 phase(spec 优先级 P1→P2→P3),每 phase 含 Tests(先)→ Implementation(后),可独立交付。US1(本日支出)与 US2(本周窗口)共享一个 foundational helper(`getCurrentUtcWeekRange`),放 Phase 2。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行(不同文件、无未完成依赖)
- **[Story]**: 所属 user story(US1/US2/US3)
- 所有路径相对仓库根;测试路径用既有约定(`src/tests/{unit,procedure,integration}/`)

## Path Conventions

- 源码:`src/`(feature-sliced;`dashboard` feature:router + queries + components + page)
- 单元测试:`src/tests/unit/{lib,components,server/domain}/`
- 契约测试:`src/tests/procedure/`(createCaller + mocked queries)
- 集成测试:`src/tests/integration/<feature>/`(testcontainers 真实 PG)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 无新依赖、无 schema、无 migration——本 feature 复用既有 recharts/date-ranges/getDailyTrend。Setup 仅确认 baseline 与分支就绪。

- [X] T001 确认工作分支 `030-home-trend-area-today` 已基于最新 `main`(含 027-mobile-home-revamp 落地)创建;`git status` 干净
- [X] T002 [P] 跑既有 dashboard 相关测试建立绿色 baseline:`pnpm vitest run src/tests/procedure/dashboard.test.ts src/tests/unit/lib/date-ranges.test.ts src/tests/unit/components/expense-trend-chart-privacy.test.ts src/tests/integration/dashboard/`(确认全绿,作为后续 red 测试的对照基线)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: US1(dayExpense 1 天窗口)与 US2(本周 7 天窗口)都依赖的共享纯函数 helper——必须在两 US 之前落地。

**⚠️ CRITICAL**: US1 与 US2 的实现均依赖此 helper,Phase 2 完成前不要开始 US1/US2 实现。

- [X] T003 [P] 写红测试:`getCurrentUtcWeekRange(now)` 纯函数单元测试 in `src/tests/unit/lib/date-ranges.test.ts`。覆盖:周一输入→start=当天;周三输入→start=2 天前周一;周日输入→start=6 天前周一;跨月边界(如 `now` = 某月 1 日且为周三→start 落上月);跨年边界(如 `now` = 2027-01-01 周五→start = 2026-12-28);`end` = `start + 7d` 且为 exclusive(下周一 00:00 UTC);默认参数 `now = new Date()` 不抛错。断言用既有 `expectUtc(date, "YYYY-MM-DDTHH:MM:SSZ")` helper。**先确认测试 FAIL(函数未导出/不存在)。**
- [X] T004 实现 `getCurrentUtcWeekRange(now: Date = new Date()): { start: Date; end: Date }` in `src/lib/date-ranges.ts`。镜像 `getUtcWeeksInMonth`(`:80-118`)的 Monday 锚点逻辑(模块私有 `isoWeekday` `:24-26` + dayMs 减法):`start = Date.UTC(now.y, now.m, now.d) - isoWeekday(now.getUTCDay()) * dayMs`;`end = start + 7*dayMs`。`end` exclusive = 下周一 00:00 UTC(对齐 `getUtcMonthRange` 契约,完美对接 `getDailyTrend` 入参)。导出新函数(供 router import)。**T003 转 GREEN。**
- [X] T005 跑 `pnpm vitest run src/tests/unit/lib/date-ranges.test.ts` 确认 T003/T004 绿;既有 date-ranges 用例不回归。

**Checkpoint**: foundational helper 就绪,US1 与 US2 可并行开始(若有人手)。

---

## Phase 3: User Story 1 - 本日支出并入 hero 卡 (Priority: P1) 🎯 MVP

**Goal**: hero 卡"本月支出"右侧并排新增"本日支出"次级数字(主从层级);新增 `dashboard.summary.dayExpense: number | null` 字段,复用 `getDailyTrend` 1 天窗口 + `.catch(()=>null)` 降级。

**Independent Test**: 今日有一笔 -¥50 餐饮支出时,hero 卡本月支出(主大数字)= ¥1,xxx.xx(含今日),本日支出(右侧次级)= ¥50.00;今日无交易 → ¥0.00;查询失败 → `¥--.--`。删除今日交易后本日支出变 ¥0.00,本月支出仍含历史。切隐私模式两者均显示 `***`。

### Tests for User Story 1 ⚠️ 写在实现前,先观察 FAIL

- [X] T006 [P] [US1] 写红测试:契约测试 `dashboard.summary.dayExpense` in `src/tests/procedure/dashboard.test.ts`。用 createCaller + 既有 mocked queries。覆盖:(a) `getDailyTrend` 今日窗口 mock 返回 `[{date, amount: 5000}]` → `dayExpense === 5000`;(b) 今日窗口 mock 返回 `[{date, amount: 0}]`(无交易)→ `dayExpense === 0`(**非** null);(c) `getDailyTrend` 第二次调用(今日窗口)mock 抛错 → `dayExpense === null`,且 `monthExpense`/`expenseTrend` 等其它字段仍正常返回(降级不连坐,FR-003)。注意:`getDailyTrend` 在 summary 内被调用两次(本周 + 今日),mock 需按调用次数/入参区分(`mockImplementation` 检查 `weekStart`/`weekEnd` 区间宽度:7 天 = 本周,1 天 = 今日)。**先确认 FAIL(dayExpense 字段不存在)。**
- [X] T007 [P] [US1] 写红测试:组件测试 `SummaryHeroCard` 渲染 dayExpense in `src/tests/unit/components/summary-hero-card.test.tsx`(新建文件)。覆盖:(a) `dayExpense={5000}` → 右侧次级数字显示 `¥50.00`,且本月支出仍为主大数字(`text-2xl`/`text-3xl`);(b) `dayExpense={0}` → 显示 `¥0.00`(非空态);(c) `dayExpense={null}` → 显示 `¥--.--` 降态;(d) dayExpense 节点挂 `data-amount` 属性(FR-008 隐私遮蔽前提)。**先确认 FAIL(prop 不存在)。**

### Implementation for User Story 1

- [X] T008 [US1] 扩展 `dashboard.summary` 返回 `dayExpense: number | null` in `src/server/api/routers/dashboard.ts`。在 procedure 内(`now` 已定义于 `:48`)计算今日 UTC 窗口:`const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); const todayEnd = new Date(todayStart.getTime() + 24*60*60*1000);`。用 try/catch 包 `getDailyTrend({familyId, weekStart: todayStart, weekEnd: todayEnd})`(镜像 budget `:76-82` / assets `:107-112` 的降级模式),取 `[0]?.amount ?? 0`,失败 → `null`。在 return 对象(`:114-124`)加 `dayExpense` 字段。**T006 转 GREEN。** 注意:此任务与 T011(US2 改 trend 窗口)都改 `dashboard.ts`,按 phase 顺序串行(先 US1 后 US2),避免同文件冲突。
- [X] T009 [P] [US1] 扩展 `SummaryHeroCard` 加 `dayExpense: number | null` prop 与右侧次级数字 in `src/components/dashboard/summary-hero-card.tsx`。将现有"本月支出 label + monthExpense 大数字"(`:32-38`)包进 flex 行(`flex items-baseline gap-2`),右侧加次级:小 label(如 `text-xs text-muted` "今日")+ dayExpense 数字(次级字号如 `text-sm font-semibold`,颜色 `text-[var(--danger)]` 与本月支出一致)。`dayExpense === null` → 显示 `¥--.--`;否则 `formatCents(dayExpense)`。新数字 `<span>` 挂 `data-amount`(自动走 `.privacy-on [data-amount]`,`globals.css:43-55`)。移动端窄屏不溢出(用 `flex-wrap` 或 `gap` 控制)。**T007 转 GREEN。**
- [X] T010 [US1] 接线 `dayExpense` 从 page 传到 hero in `src/app/(app)/dashboard/page.tsx`。`summaryQuery.data.dayExpense` 传入 `<DashboardBody>`(`:117-129`)→ `<SummaryHeroCard>`(`:246-250`)。补 `DashboardBody` props 类型(`dayExpense: number | null`)。

**Checkpoint**: US1 完成。`pnpm vitest run src/tests/procedure/dashboard.test.ts src/tests/unit/components/summary-hero-card.test.tsx` 全绿;手动走 quickstart 场景 1 + 场景 5(降级)。可独立 demo:hero 卡显示本日 + 本月支出。

---

## Phase 4: User Story 2 - 趋势图窗口改为本周 (Priority: P2)

**Goal**: `dashboard.summary.expenseTrend` 从"本月每日"改为"本周 7 桶"(Mon..Sun UTC),与 `year`/`month` 输入解耦;今日之后的本周未来日补零。顺带移除"较上月"环比徽标(FR-009,删除客户端第二次 summary 查询 + 修 precedence bug)。

**Independent Test**: 切换到上月后,趋势图 X 轴仍显示本周周一..周日 7 桶(与当前月完全一致),不随月份变;今日之后的本周未来日桶 = 0;趋势卡无"较上月"徽标。

### Tests for User Story 2 ⚠️ 写在实现前,先观察 FAIL

- [X] T011 [P] [US2] 写红测试:契约测试 `expenseTrend` 恒为本周 7 桶 in `src/tests/procedure/dashboard.test.ts`。覆盖:(a) mock `getDailyTrend`(本周窗口)返回 7 元素数组 → `expenseTrend.buckets.length === 7` 且 `granularity === "daily"`;(b) 分别以 `{month: 当前月}` 与 `{month: 上月}` 调用 summary,断言两次 `expenseTrend.buckets` **完全相同**(窗口与 month 输入无关,contract test scenario 12);(c) 断言调用 `getDailyTrend` 时传入的 `weekStart`/`weekEnd` 跨度 = 7 天且锚点为周一(`weekStart.getUTCDay() === 1`),而非 monthStart/monthEnd。**先确认 FAIL(trend 仍用 monthStart/monthEnd,buckets 长度 = 月天数)。**
- [X] T012 [P] [US2] 写红测试:集成测试本周未来日补零 in `src/tests/integration/dashboard/summary.test.ts`。用 testcontainers 真实 PG。注入固定 `now`(如本周周三),今日插一笔 expense,周四..周日不插。断言 `expenseTrend.buckets.length === 7`,今日(周三)桶 > 0,周四..周日桶 === 0(contract test scenario 16)。**先确认 FAIL(trend 仍按月,不是本周)。**

### Implementation for User Story 2

- [X] T013 [US2] 改 `dashboard.summary` trend 用本周窗口 in `src/server/api/routers/dashboard.ts`。在 `:54` 附近(`now` 已定义于 `:48`)加 `const { start: weekStart, end: weekEnd } = getCurrentUtcWeekRange(now);`。把 `:63` 的 `getDailyTrend({ familyId, weekStart: monthStart, weekEnd: monthEnd })` 改为 `getDailyTrend({ familyId, weekStart, weekEnd })`(T004 新 helper)。**不要动** `getMonthSummary`(`:60`)/`getCategoryBreakdown`(`:62`)的 monthStart/monthEnd(月维度不变)。注释更新:`:57` 的"本月每日"改为"本周 Mon..Sun UTC,与 month 输入解耦(spec 030 Clarification Q2)"。**T011/T012 转 GREEN。** 同时更新 026/027 既有 4 个 obsolete 测试(T011/T012/T019/T020 integration)以反映新语义:T011 改断 7 桶;T012 改断历史月 trend 全 0(数据不在本周);T019 改为本周 7 桶零填;T020(历史月 weekly 首尾周)语义已不成立,删除并加注释。
- [X] T014 [US2] 移除"较上月"环比徽标 + 删第二次 summary 查询 + 修 precedence bug in `src/app/(app)/dashboard/page.tsx`。删除:`prevYm`(`:75-78`)、`prevSummaryQuery`(`:79-82`,**此为每次加载触发的第二次完整 summary tRPC 查询**)、`comparisonPercent`(`:83-90`,含 `:86` 的 `?? 0 - prev` operator-precedence bug)。删除 prop drilling:`comparisonPercent={comparisonPercent}` 传 `<DashboardBody>`(`:126`)+ `DashboardBody` props 类型(`:228`/`:240`)+ 传 `<TrendSection>`(`:257`)。删除 `TrendSection` 内徽标:props(`:141`/`:145`)+ `<Card.Header>` 内的 `comparisonPercent !== null && <span>较上月 ...</span>` JSX(`:152-167`)。`Card.Header` 只保留标题。
- [X] T015 [P] [US2] 趋势卡标题文案改为"本周支出趋势" in `src/app/(app)/dashboard/page.tsx` `TrendSection` 的 `<Card.Title>`(`:152`,原"支出趋势")。明确窗口语义(避免与所选月份混淆,research R10)。

**Checkpoint**: US2 完成。`pnpm vitest run src/tests/procedure/dashboard.test.ts src/tests/integration/dashboard/` 全绿;手动走 quickstart 场景 2(窗口不随月)+ 场景 4(徽标已移除)。可独立 demo:趋势图固定本周、无环比徽标。

---

## Phase 5: User Story 3 - 平滑折线 + 渐变面积填充 (Priority: P3)

**Goal**: `ExpenseTrendChart` 从 `LineChart`+`Line` 改为 `AreaChart`+`Area` + `<linearGradient>` 垂直渐变;曲线沿用 `monotone`(平滑且不跌破 0);动画关闭(CLS=0)。

**Independent Test**: 本周有 ≥2 个非零数据点时,折线相邻点为平滑曲线(无折角)、下方有顶部 `--danger` 不透明→底部透明的垂直渐变面积;全 0 周折线贴轴、面积退化但不破坏骨架;隐私模式形状保留。

### Tests for User Story 3 ⚠️ 写在实现前,先观察 FAIL

- [X] T016 [P] [US3] 写红测试:组件测试 `ExpenseTrendChart` 渲染 Area + 渐变 in `src/tests/unit/components/expense-trend-chart-structure.test.ts`(新建;既有 `expense-trend-chart-privacy.test.ts` 只测隐私,本文件测结构)。采用纯值断言(导出 `chartConfig` 常量,与本仓库 component 测试约定一致——jsdom 下 SVG 渲染不可靠,提取可测常量)。断言 chartType='area' / curveType='monotone' / gradientId 非空 / gradientStops 顶不透明→底透明垂直渐变 / strokeColor='--danger' / animationDisabled=true。**先确认 FAIL(chartConfig 不存在)。**
- [X] T017 [US3] 改 `DailyView` 为 AreaChart + Area + 渐变 in `src/components/dashboard/expense-trend-chart.tsx`(`DailyView`)。改 imports:`Line, LineChart` → `Area, AreaChart`。新增导出 `chartConfig` 常量(集中 chartType/curveType/strokeColor/gradientStops 等决策)。`<AreaChart>` 内加 `<defs><linearGradient id={chartConfig.gradientIdDaily} x1=0 y1=0 x2=0 y2=1>…</linearGradient></defs>`(由 gradientStops map)。把 `<Line>` 换成 `<Area type={chartConfig.curveType} … fill="url(#expenseTrendAreaDaily)" isAnimationActive={!chartConfig.animationDisabled} />`。aria-label 改"本周每日支出趋势"。**T016 转 GREEN。**
- [X] T018 [P] [US3] 同步改 `WeeklyView` 为 AreaChart + Area + 渐变(独立渐变 id)in `src/components/dashboard/expense-trend-chart.tsx`(`WeeklyView`)。用独立 `<linearGradient id={chartConfig.gradientIdWeekly}>`(避免同 DOM 内 id 冲突,research R1)。结构镜像 DailyView。
- [X] T019 [US3] 跑既有隐私测试确认不回归:`pnpm vitest run src/tests/unit/components/expense-trend-chart-privacy.test.ts`。该文件测 `tickFormatter` 隐私遮蔽(YAxis `••`),与 Area/Line 无关,保持绿色(4/4)。

**Checkpoint**: US3 完成。`pnpm vitest run src/tests/unit/components/` 全绿;手动走 quickstart 场景 3(平滑+渐变)+ 场景 4(隐私形状保留)。可独立 demo:趋势图为平滑面积图。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 跨 US 收尾、文档同步、端到端验证。

- [X] T020 [P] 更新 `docs/DOMAIN.md`(若 dayExpense / 本周趋势属于领域语义变更需要记录):无 schema 变更,但 `dashboard.summary` 输出契约扩展(dayExpense、expenseTrend 改本周)建议在 DOMAIN.md 或 027 contract 处加一句指向 030 扩展。若 DOMAIN.md 不涉及 dashboard 输出语义则跳过(避免无谓改动,YAGNI)。**结果**:DOMAIN.md 不含 dashboard 输出语义,跳过(YAGNI);改在 027 contract 加注记(T023)。
- [X] T021 [P] 跑全量测试套件确认无回归:`pnpm vitest run`(单元 + 契约 + 组件)+ `pnpm test:integration`(testcontainers)。重点关注 dashboard / date-ranges / components 三处既有用例不回归。**结果**:unit 220/220 ✓;procedure 65/65 ✓;integration dashboard/ 45/45 ✓(含 2 新 [030-T012])。集成套件其它文件(account/auth/transaction/category)有 7 处 `user_pkey` duplicate-key 失败,经 git 验证与本次改动零交集(失败文件全部未被我触及,失败点在 `seedUser` 的 `db.insert(user)`,属 testcontainers 并发种子 ID 碰撞的既有基础设施 flakiness,非本 feature 回归)。
- [X] T022 [P] 跑 `pnpm lint` + `pnpm typecheck`(tsc --noEmit)确认无类型/lint 错误。tRPC 类型由 TS 自动派生,`dayExpense` 字段类型变更会自动传播到 `page.tsx` 消费端——若有类型错误说明消费端未更新。**结果**:typecheck clean;lint 0 errors。我引入的 2 处 unused-var 警告(expense-trend-chart 的 weekdayLabel 死代码、dashboard.ts 的 isCurrentMonth 死代码)已顺带清理;剩余 54 警告全在未触及的文件(既有)。
- [X] T023 [P] 更新 `specs/027-mobile-home-revamp/contracts/dashboard-summary.md`:027 的 expenseTrend 契约(daily current/previous/comparisonPercent)本就与实际 router 不符(030 调研发现的 latent 不一致)。在 027 contract 顶部加一行注记:"expenseTrend / dayExpense 语义自 030 改为本周窗口,见 `specs/030-home-trend-area-today/contracts/dashboard-summary.md`"。不重写 027 contract(它是 027 的历史快照)。**结果**:已在 027 contract 顶部加 📌 [030 更新] 注记,指向 030 契约为当前真相源。
- [ ] T024 跑 quickstart.md 全部 5 个场景手动验证(`pnpm dev` → `/dashboard`):场景 1(本日支出主从)、场景 2(窗口不随月)、场景 3(平滑+渐变)、场景 4(徽标移除+隐私)、场景 5(降级)。对照 quickstart.md 的"验收对照"表逐项打勾。**状态:待用户手动验证**(需浏览器交互;自动测试已覆盖各场景的核心不变量:US1 dayExpense 契约+组件、US2 本周 7 桶+未来日补零+徽标移除、US3 chartConfig 结构)。
- [X] T025 [P] 宪章合规复审:逐条核对 plan.md Constitution Check 表的 7 项原则,确认实现未引入违反(如:无新表/无新 procedure/无新依赖/复用既有隐私机制/无 N+1)。若有偏离,在 plan.md Complexity Tracking 表补正当理由(本 feature 预期无偏离)。**结果**:全 7 项原则保持绿灯——无新表/无新 procedure(原则一、二)、无手写契约(原则二)、无新依赖(原则六)、复用既有 `.privacy-on [data-amount]` 隐私机制 + 既有 `getDailyTrend`/`padDailyBuckets`(原则六)、净减少查询(原则五)。Complexity Tracking 表仍为空,无偏离。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,立即开始。T001 → T002。
- **Foundational (Phase 2)**: 依赖 Phase 1。T003(红)→ T004(实现)→ T005(绿)。**BLOCKS US1/US2**(两 US 都用 `getCurrentUtcWeekRange`)。
- **US1 (Phase 3)**: 依赖 Phase 2(`getCurrentUtcWeekRange`)。T006/T007(红,并行)→ T008(router)→ T009(hero,可与 T010 并行)→ T010(接线)。T008 与 T013(US2)都改 `dashboard.ts`,**串行**(先 US1 后 US2,避免同文件冲突)。
- **US2 (Phase 4)**: 依赖 Phase 2 + US1 完成(dashboard.ts 已被 US1 改动,需基于 US1 后状态继续)。T011/T012(红,并行)→ T013(router)→ T014(删徽标)→ T015(标题,可与 T014 并行)。
- **US3 (Phase 5)**: 依赖 Phase 2(本周 7 桶数据,否则 chart 测试数据不符)。与 US1/US2 在文件上独立(`expense-trend-chart.tsx`),可并行但建议在 US2 后(US3 的 chart 消费 US2 的本周数据)。T016(红)→ T017(DailyView)→ T018(WeeklyView,并行)→ T019(隐私回归)。
- **Polish (Phase 6)**: 依赖所有 US 完成。T020-T025 多为 [P] 可并行。

### User Story Dependencies

- **US1 (P1)**: 依赖 Foundational。与 US2 共享 `dashboard.ts` 文件(串行),但功能独立。
- **US2 (P2)**: 依赖 Foundational + US1(dashboard.ts 接续)。功能独立可测(窗口变更与徽标移除)。
- **US3 (P3)**: 依赖 Foundational(数据形状)。文件独立(`expense-trend-chart.tsx`),与 US1/US2 无功能耦合,仅消费 US2 的本周数据。

### Within Each User Story

- Tests 先写、观察 FAIL、再实现转 GREEN(宪章原则四)
- router(数据)→ 组件(展示)→ page(接线)顺序
- 每 checkpoint 跑该 US 相关测试 + 手动验证

### Parallel Opportunities

- Phase 2:T003 单测独立(但 Phase 2 内只有一条实现线)。
- Phase 3:T006(契约测试)与 T007(组件测试)不同文件 → **并行**;T009(hero 组件)与 T010(page 接线)→ T009 完成后 T010 可并行验证。
- Phase 4:T011(契约测试)与 T012(集成测试)不同文件 → **并行**;T014(删徽标)与 T015(改标题)同文件但相邻区域 → 串行(T014 先)。
- Phase 5:T018(WeeklyView)与 T017(DailyView)同文件不同函数 → 串行(T017 先,建立模式);T019 回归独立。
- Phase 6:T020/T021/T022/T023/T025 多为 [P] 不同关注点 → **并行**;T024(手动)在最后。

---

## Parallel Example: User Story 1

```bash
# 红测试并行(不同文件):
Task: "T006 契约测试 dayExpense in src/tests/procedure/dashboard.test.ts"
Task: "T007 组件测试 SummaryHeroCard in src/tests/unit/components/summary-hero-card.test.tsx"

# 实现阶段(串行,因同文件 dashboard.ts):
Task: "T008 扩展 dashboard.summary 返回 dayExpense in src/server/api/routers/dashboard.ts"
# 然后(不同文件,可并行验证):
Task: "T009 扩展 SummaryHeroCard in src/components/dashboard/summary-hero-card.tsx"
Task: "T010 接线 dayExpense in src/app/(app)/dashboard/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1:Setup(确认 baseline 绿)
2. Phase 2:Foundational(`getCurrentUtcWeekRange` + 单测)
3. Phase 3:US1(本日支出并入 hero 卡)
4. **STOP & VALIDATE**:走 quickstart 场景 1 + 5,独立 demo hero 卡本日+本月支出
5. 可选:至此已交付用户核心诉求("每天花多少一眼看见")

### Incremental Delivery

1. Setup + Foundational → helper 就绪
2. + US1 → 本日支出可见(MVP!)→ Demo
3. + US2 → 趋势图改本周 + 移除环比徽标 → Demo
4. + US3 → 平滑面积图视觉强化 → Demo
5. + Polish → 全量回归 + 文档 + 宪章复审

### Sequential Team Strategy(单人/串行)

本 feature 改动面集中在 `dashboard` feature 切片,文件冲突点多(`dashboard.ts` / `page.tsx` 被多 US 触及),**建议单人按 P1→P2→P3 串行**,而非并行。并行仅在同 phase 的不同文件测试任务上展开。

---

## Notes

- [P] 任务 = 不同文件、无未完成依赖
- [Story] 标签把任务映射到 user story,便于追溯
- 每 US 独立可完成、可测试、可 demo
- **测试先 FAIL 再 GREEN**(宪章原则四,不可妥协)
- 每 task 或逻辑组后 commit;每 checkpoint 验证该 US 独立工作
- 避免:模糊任务、同文件并行冲突、破坏 US 独立性的跨 story 依赖
- **特别提示**:`dashboard.ts` 与 `page.tsx` 被多 US 触及(US1/US2 改 dashboard.ts;US2 改 page.tsx),按 phase 顺序串行处理,不要跨 phase 并行同文件
- **顺带收益**:US2 的 T014(删环比徽标)顺带删除每次首页加载的第二次完整 summary tRPC 查询 + 修复 `page.tsx:86` 的 operator-precedence bug——p95 净收益,无需单独任务
