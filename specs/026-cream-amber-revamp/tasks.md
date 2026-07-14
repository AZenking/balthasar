---

description: "Task list for 1.0.0 cream-amber full-site revamp (reconciled 2026-07-14, reflects 1.0.0-rc.1)"
---

# Tasks: 1.0.0 全站改版(Reconciled 2026-07-14)

**Input**: Design documents from `/specs/026-cream-amber-revamp/`(spec.md / plan.md / research.md / data-model.md / contracts/ / quickstart.md)

**Prerequisites**: ✅ plan.md / ✅ spec.md / ✅ data-model.md / ✅ contracts/ / ✅ research.md / ✅ quickstart.md

**Tests**: ✅ Include test tasks (spec FR-G004/G005 + 宪章四 Test-First 要求)

**Organization**: 按 8 个 User Story 分阶段;Spike PR = Phase 1,Switch PR = Phase 2-10,BALTHASAR 改造 = Phase 11。

> **Revision Note (2026-07-14)**: Phase 1-10 任务全部已完成(在 v1.0.0-rc.1 之前)。
> 实施期间决策变更见 spec.md Clarifications Q8-Q13(配色 / 暗色 / Drawer / recharts / 13 项 UI 改造 / shadcn 适配层保留)。
> Phase 11 为 1.0.0-rc.1 前后追加的 13 项 BALTHASAR 整体 UI 改造,全部已 commit。


## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可并行(不同文件,无依赖)
- **[US#]**: 所属 User Story
- 文件路径为相对仓库根

## Spike + Switch 双 PR 策略映射

- **Phase 1 (Setup)** → Spike PR(`feat/026-spike`):库 + 令牌 + 共享工具 + 单元测试,**UI 不切换**,所有页面继续用 shadcn
- **Phase 2-9 (Foundational + US1-US7)** → Switch PR(`feat/026-switch`):后端 procedure + 全站切换 + 新功能
- **Phase 10 (Polish)** → Switch PR 收尾:shadcn 清理 + 宪章修订 + Switch PR 合并 + 1.0.0 release

每个 US 在 Switch PR 内独立可测,但物理合并到同一 PR;按 commit 分页提交便于 review。

---

## Phase 1: Setup (Spike PR) — 共享基础设施

**Goal**: 安装 HeroUI v3 + 落地奶油琥珀令牌 + 共享工具 + 单元测试;所有页面继续用 shadcn,视觉无变化。

**Independent Test**: `pnpm test:unit` 全绿;`pnpm dev` 启动后所有现有页面视觉无变化;`/dev/heroui-test` 临时路由显示奶油琥珀色 HeroUI Button。

- [ ] T001 [P] 切 Spike 分支:从 main 拉最新后 `git checkout -b feat/026-spike`
- [ ] T002 [P] 安装 HeroUI v3 依赖到 `package.json`:`pnpm add @heroui/react @heroui/styles tailwind-variants`
- [ ] T003 修改 `src/app/globals.css`:在 `@import "tailwindcss"` 之后加 `@import "@heroui/styles"`,落地 9 个奶油琥珀 CSS 变量(`--background #F8F4EA` / `--surface #FFFDF8` / `--accent #C79032` / `--accent-hover #A97420` / `--foreground #292721` / `--muted #817B6D` / `--dark-surface #22211E` / `--income #3B9B74` / `--expense #D76555`)
- [ ] T004 [P] 落地 `src/lib/theme.ts`:导出 9 个令牌常量 + 类型 `ThemeToken`(供 JS 侧引用 + 单元测试断言一致性)
- [ ] T005 [P] 落地 `src/lib/privacy.ts`:localStorage key `balthasar.privacy.enabled` + `isPrivacyOn()` / `setPrivacy(bool)` / `togglePrivacy()` 工具
- [ ] T006 [P] 落地 `src/lib/date-ranges.ts`:4 个函数 `getUtcMonthRange(year, month)` / `getUtcWeeksInMonth(year, month)` / `padDailyBuckets(txs, start, end)` / `getLast24Months(now?)`(纯函数,无副作用)
- [ ] T007 修改 `src/app/layout.tsx`:在 `<head>` 注入 inline script,hydration 前读 localStorage 并给 `<html>` 加 `privacy-on` class(research.md R5 实现)
- [ ] T008 [P] 落地 `docs/THEME.md`:列出 9 个语义令牌、修改示例、oklch 色彩空间说明、暗色模式保留备注(spec FR-H003)
- [ ] T009 [P] 单元测试 `tests/unit/date-ranges.test.ts`:覆盖跨年 / 首尾不完整周 / 闰年 / 月长差异 / 日补零 / 24 月降序 / 空数据(每函数 ≥ 5 用例,详见 research.md R7)
- [ ] T010 [P] 单元测试 `tests/unit/privacy.test.ts`:覆盖默认值(false)/ 读写一致性 / 异常捕获(禁用 localStorage 时不抛)
- [ ] T011 [P] 单元测试 `tests/unit/theme.test.ts`:断言 `src/lib/theme.ts` 与 `src/app/globals.css` 令牌值完全一致(data-model.md §4 不变量 5)
- [ ] T012 创建临时验证路由 `src/app/dev/heroui-test/page.tsx`:渲染 HeroUI `<Button variant="primary">Test</Button>`,本地启动 `pnpm dev` 访问 `/dev/heroui-test` 确认样式生效(accent #C79032),验证后**删除该路由文件**
- [ ] T013 提交 Spike PR:`git push -u origin feat/026-spike` → `gh pr create --title "feat(026): Spike - HeroUI v3 + cream-amber theme + shared utils" --body "..."` → 等 CI 全绿 → `gh pr merge --squash --delete-branch`

**Checkpoint**: Spike PR 已合并到 main,HeroUI 与 shadcn 共存但只有 shadcn 在用,所有页面视觉无变化,共享工具 + 单元测试就位。

---

## Phase 2: Foundational (Switch PR 启动) — 后端 procedure 扩展

**Goal**: 完成 3 个后端 procedure 的扩展 / 新增(TDD:测试先行)。这是 US3/US4/US7 的硬依赖。

**⚠️ CRITICAL**: US3 / US4 / US7 的前端工作必须等本 phase 完成。

**Independent Test**: `pnpm test:integration` 全绿(27 个新集成测试用例);tRPC 类型自动派生,前端可调用 `trpc.dashboard.report.query(...)` 与 `trpc.auth.updateNickname.mutate(...)`。

### Tests for Foundational (TDD,先写测试)

- [ ] T014 [P] 切 Switch 分支:从 main(Spike 已合并)拉最新后 `git checkout -b feat/026-switch`
- [ ] T015 [P] 扩展 `tests/integration/dashboard/summary.test.ts`:新增 10 个用例(当前月默认 / 指定月 / 只传 year / 空数据 / 跨家庭隔离 / recentTransactions 跨月 / Top 2 顺序 / percentage 边界 / daily 当前周补零 / weekly 历史月首尾周),见 [contracts/dashboard-summary.md](./contracts/dashboard-summary.md)
- [ ] T016 [P] 新建 `tests/integration/dashboard/report.test.ts`:8 个用例(默认目标月 / 指定目标月 / 跨年 / 空数据目标月 / 混合数据 / 分类百分比 / 跨家庭隔离 / label 格式),见 [contracts/dashboard-report.md](./contracts/dashboard-report.md)
- [ ] T017 [P] 新建 `tests/integration/auth/update-nickname.test.ts`:9 个用例(正常更新 / 空字符串 / 纯空白 / 超长 / 边界 30 / 跨 member 隔离 / 跨 family 隔离 / 中文 emoji / DB 持久化),见 [contracts/auth-update-nickname.md](./contracts/auth-update-nickname.md)
- [ ] T018 运行 `pnpm test:integration`,确认 27 个新用例**全红**(procedure 未实现)

### Implementation for Foundational

- [ ] T019 [P] 扩展 `src/server/api/routers/dashboard.ts` 的 `summary` procedure:加 zod input parser `{ year?, month? }`,server 端缺省解析为当前 UTC 年月;扩展输出含 `queriedYearMonth` / `expenseTrend`(daily|weekly)/ `topExpenseCategories`(Top 2)/ `recentTransactions`(4 条);依赖 `src/lib/date-ranges.ts`(Phase 1 落地)
- [ ] T020 [P] 扩展 `src/server/db/queries/dashboard.ts`:新增 `getDailyTrend(familyId, weekStart, weekEnd)` 与 `getWeeklyTrend(familyId, monthStart, monthEnd)` helper,利用现有索引 `transactions_family_occurred_idx`
- [ ] T021 [P] 新增 `dashboard.report` procedure 到 `src/server/api/routers/dashboard.ts`:输入 `{ endYear?, endMonth? }`,内部并行 6 次 `getMonthSummary` + 1 次 `getCategoryBreakdown`;输出 `monthlyTrend[6]` + `targetMonthCategoryBreakdown`(详见 [contracts/dashboard-report.md](./contracts/dashboard-report.md))
- [ ] T022 [P] 新增 `auth.updateNickname` mutation 到 `src/server/api/routers/auth.ts`:输入 `{ displayName }`(zod trim + min 1 + max 30);server 端通过 `userId === ctx.session.user.id` 定位 member;UPDATE 并返回 `{ member: { id, displayName } }`(详见 [contracts/auth-update-nickname.md](./contracts/auth-update-nickname.md))
- [ ] T023 运行 `pnpm test:integration`,确认 27 个新用例**全绿**
- [ ] T024 [P] 性能验证:本地用 `pnpm test:integration` 跑 5 次,确认 `summary` p95 < 500ms / `report` p95 < 800ms / `updateNickname` p95 < 300ms

**Checkpoint**: 3 个 procedure 已实现 + 类型自动派生 + 集成测试全绿 + 性能达标。US3 / US4 / US7 前端可启动。

---

## Phase 3: User Story 1 - 奶油琥珀全站统一 UI (Priority: P1) 🎯 MVP

**Goal**: 把现有 8 个页面 / 14 个 shadcn 组件全部切换到 HeroUI v3,保持原有 IA 与功能,视觉刷新为奶油琥珀风格。

**Independent Test**: 在 375px 视口跑 MVP 完整流程(登录 → 新增账户 → 新增分类 → 新增交易 → 查看流水 → 编辑 → 删除 → 修改设置),功能 100% 等价,视觉为奶油琥珀,所有页面共享同一套设计令牌(spec US1 acceptance 1-5)。

### Implementation for User Story 1

**A. 通用组件迁移**(供各页面引用):
- [ ] T025 [P] [US1] 重写 `src/components/ui/button.tsx` 为 HeroUI Button 适配层(或删除,改用直接 import);variants 映射 primary/secondary/tertiary/danger/ghost;`onPress` 替代 `onClick`
- [ ] T026 [P] [US1] 重写 `src/components/ui/card.tsx` 为 HeroUI Card 组合式(`Card.Header/Title/Description/Content/Footer`)
- [ ] T027 [P] [US1] 重写 `src/components/ui/input.tsx` 为 HeroUI TextField(内置 label/description/errorMessage)
- [ ] T028 [P] [US1] 重写 `src/components/ui/select.tsx` 为 HeroUI Select + SelectItem
- [ ] T029 [P] [US1] 重写 `src/components/ui/checkbox.tsx` / `radio-group.tsx` 为 HeroUI Checkbox / RadioGroup
- [ ] T030 [P] [US1] 重写 `src/components/ui/dialog.tsx` / `alert-dialog.tsx` 为 HeroUI Modal / AlertDialog
- [ ] T031 [P] [US1] 重写 `src/components/ui/popover.tsx` / `tooltip.tsx` 为 HeroUI Popover / Tooltip
- [ ] T032 [P] [US1] 重写 `src/components/ui/tabs.tsx` 为 HeroUI Tabs + TabList + Tab + TabPanel
- [ ] T033 [P] [US1] 重写 `src/components/ui/skeleton.tsx` 为 HeroUI Skeleton
- [ ] T034 [P] [US1] 调研 `src/components/ui/command.tsx`(cmdk)实际调用面:`grep -rn "components/ui/command" src/`;若仅用于"可搜索下拉" → 用 HeroUI Autocomplete 替代;若是真正命令面板 → 暂时保留 cmdk + TODO 注释(research.md R3)

**B. 页面切换**(每页一 commit,便于 review):
- [ ] T035 [P] [US1] 重写 `src/app/(auth)/login/page.tsx`:shadcn → HeroUI(TextField + Button),保持登录逻辑不变
- [ ] T036 [P] [US1] 重写 `src/app/(auth)/register/page.tsx`:同上
- [ ] T037 [P] [US1] 重写 `src/app/(app)/transaction/new/page.tsx`:HeroUI TextField + Select + 金额预览,**金额输入不挂 `data-attribute`**(clarify Q1 = A)
- [ ] T038 [P] [US1] 重写 `src/app/(app)/transaction/[id]/edit/page.tsx`:同 new,保持编辑逻辑
- [ ] T039 [P] [US1] 重写 `src/app/(app)/accounts/page.tsx`:HeroUI Card + List + Modal(新增/编辑账户)
- [ ] T040 [P] [US1] 重写 `src/app/(app)/settings/page.tsx` 骨架:HeroUI Tabs + Card,**此阶段仅做 UI 切换,不做"我的"重组(留给 US7)**;昵称、API Key 等模块保留原位置
- [ ] T041 [US1] 重写 `src/components/transaction/transaction-form.tsx`:HeroUI TextField + Select + Checkbox,保持表单校验反馈(FR-A008)
- [ ] T042 [US1] 重写 `src/components/settings/category-form.tsx` 与 `category-manager.tsx`:HeroUI Modal + TextField + 列表;**dnd-kit 保留**(research.md R7 / spec Assumptions)
- [ ] T043 [US1] 重写 `src/components/settings/emoji-picker.tsx`:HeroUI Popover + 网格
- [ ] T044 [US1] 重写 `src/components/transactions/transaction-filters.tsx`:HeroUI Select + Tabs
- [ ] T045 [US1] 重写 `src/components/dashboard/recent-transactions.tsx` 与 `summary-cards.tsx`:HeroUI Card + Skeleton + 文本格式化;金额字段加 `data-amount` 属性(供隐私态 CSS 隐藏)
- [ ] T046 [US1] 重写 `src/app/(app)/dashboard/page.tsx` 骨架:HeroUI 组件,**此阶段保持原"当前月"逻辑**(月份 Select 留给 US4,隐私按钮留给 US5,Top 2 下钻留给 US6)

**Checkpoint**: 所有页面切换完成,跑 MVP 流程功能等价,视觉为奶油琥珀;`grep -r "@/components/ui/" src/` 命中 shadcn 残留 = 0(适配层不算)。

---

## Phase 4: User Story 2 - 底部 5 入口导航 (Priority: P1)

**Goal**: 在 `(app)` layout 加底部 5 入口导航(首页 / 账单 / 记一笔 / 报表 / 我的),当前路由活动态高亮,"记一笔"凸起主按钮。

**Independent Test**: 在任意非模态页面点击底部入口,正确切换路由 + 活动态;`/reports` 入口存在(即使页面内容待 US3 实现);刷新深链后活动态正确(spec US2 acceptance 1-5)。

### Implementation for User Story 2

- [ ] T047 [P] [US2] 新建 `src/components/bottom-navigation.tsx`:固定底部 5 入口;每项含图标 + 文案 + `usePathname()` 判断活动态;"记一笔"用凸起样式(variant primary,圆形或圆角)
- [ ] T048 [US2] 修改 `src/app/(app)/layout.tsx`:引入 `<BottomNavigation />` + 主内容区 padding-bottom 避开导航
- [ ] T049 [P] [US2] 新建 `src/app/(app)/reports/page.tsx` 占位:仅显示"报表页建设中"文案,确保 `/reports` 路由存在(US3 填充内容)
- [ ] T050 [US2] 缓存失效逻辑:在 `src/components/transaction/transaction-form.tsx` 的 mutation onSuccess 加 `utils.dashboard.summary.invalidate()` + `utils.dashboard.report.invalidate()` + `utils.transactions.list.invalidate()`(spec FR-B003 / clarify Q5)

**Checkpoint**: 底部 5 入口可点击切换,`/reports` 占位可访问,记账后跨页缓存失效。

---

## Phase 5: User Story 3 - 报表页 (Priority: P2)

**Goal**: 实现 `/reports` 完整内容:6 个月趋势 SVG 图 + 目标月分类分析 + 趋势月份点击切换 + 分类块下钻账单。

**Independent Test**: 进入 `/reports`,默认看当前月结尾的 6 月趋势 + 当前月分类分析;点击趋势某月,分类分析切换;点击分类块,跳账单 `/transactions?month=...&type=expense&categoryId=...`(spec US3 acceptance 1-5)。

### Implementation for User Story 3

- [ ] T051 [P] [US3] 新建 `src/components/reports/monthly-trend-chart.tsx`:自建 SVG/CSS 柱状图(research.md R4),显示 6 月收入/支出/结余三系列;每柱 `onClick` 触发 `onMonthClick(year, month)` 回调;含 `<title>` + `aria-label` 文本后备
- [ ] T052 [P] [US3] 新建 `src/components/reports/category-donut.tsx`:SVG `<circle>` + `stroke-dasharray` 环形图;每块 `onClick` 触发 `onCategoryClick(categoryId)`;含文本后备
- [ ] T053 [P] [US3] 新建 `src/components/reports/category-breakdown-card.tsx`:HeroUI Card + 列表,显示分类名 + 金额(带 `data-amount`) + 百分比;onClick 下钻
- [ ] T054 [US3] 重写 `src/app/(app)/reports/page.tsx`:用 `trpc.dashboard.report.query({ endYear, endMonth })` 拉数据;状态管理"目标月"(默认当前月);布局:顶部目标月 Select + 趋势图 + 分类分析卡列表
- [ ] T055 [US3] 接入路由下钻:`onMonthClick` → `setEndYearMonth({year, month})`(重新 query);`onCategoryClick` → `router.push('/transactions?month=...&type=expense&categoryId=...')`
- [ ] T056 [US3] 隐私态适配:报表页所有金额字段加 `data-amount` 属性;`.privacy-on [data-amount]` CSS 规则已在 Spike 期落地(FR-D005)

**Checkpoint**: `/reports` 完整可用,趋势图 + 分类分析 + 点击交互闭环。

---

## Phase 6: User Story 4 - 首页历史月份选择 (Priority: P2)

**Goal**: 重做首页顶部:加月份 Select(24 月)+ 历史月数据驱动主卡 / Top 2 / 周维度趋势;最近流水保持最新 4 条。

**Independent Test**: 切换月份,主卡(收入/支出/结余)+ Top 2 分类 + 周维度 SVG 随之变化;当前月显示 daily 趋势(本周补零),历史月显示 weekly 趋势;最近 4 条流水不受月份影响(spec US4 acceptance 1-5)。

### Implementation for User Story 4

- [ ] T057 [P] [US4] 新建 `src/components/dashboard/month-picker.tsx`:HeroUI Select + `getLast24Months()` 生成选项;`onValueChange` 回调
- [ ] T058 [P] [US4] 新建 `src/components/dashboard/expense-trend-chart.tsx`:自建 SVG/CSS 趋势图;根据 `expenseTrend.granularity` 渲染 daily(7 柱,周一至周日)或 weekly(N 段,首尾不完整周);每柱含文本后备
- [ ] T059 [P] [US4] 新建 `src/components/dashboard/top-category-card.tsx`:HeroUI Card,显示 Top 2 分类图标 + 名称 + 金额(带 `data-amount`)+ 百分比;`onClick` 触发下钻回调(留给 US6 接线)
- [ ] T060 [US4] 重写 `src/app/(app)/dashboard/page.tsx`:状态管理"选中月"(默认当前月);`trpc.dashboard.summary.query({ year, month })` 拉数据;布局:顶部 MonthPicker + 主卡(收入/支出/本月结余)+ ExpenseTrendChart + Top 2 分类卡(双卡)+ 最近 4 条流水
- [ ] T061 [US4] 主卡文案明确"本月结余"(spec FR-C005):用 HeroUI Card.Title 显示"本月结余",副标题显示月份
- [ ] T062 [US4] 动态问候:根据 `new Date().getUTCHours()` 返回 早(6-12)/ 午(12-18)/ 晚(其它);显示在顶部"轻记" + 昵称(`trpc.auth.me.query()` 拿 `member.displayName`)旁

**Checkpoint**: 首页月份切换闭环,主卡/Top 2/趋势图正确响应,最近流水固定最新 4 条。

---

## Phase 7: User Story 5 - 金额隐私模式 (Priority: P2)

**Goal**: 首页 + 报表页 + 账单页加隐私按钮,点击切换金额隐藏 / 显示;localStorage 持久化;无金额闪现。

**Independent Test**: 点击隐私按钮,展示页金额立即变 `***`;刷新后保持;报表页 / 账单页同步隐藏;"记一笔"页输入不受影响(spec US5 acceptance 1-6)。

### Implementation for User Story 5

- [ ] T063 [P] [US5] 新建 `src/components/privacy-toggle.tsx`:HeroUI IconButton(图标用眼睛/划线眼睛);`onClick` 调用 `src/lib/privacy.ts` 的 `togglePrivacy()`(已落地 Phase 1)
- [ ] T064 [US5] 在 `src/app/(app)/layout.tsx` 或 dashboard/reports/transactions 页顶部放置 `<PrivacyToggle />`(选其中一个固定位置,推荐 layout 顶部)
- [ ] T065 [US5] 验证 CSS 规则:在 `src/app/globals.css` 加 `.privacy-on [data-amount] { color: transparent; } .privacy-on [data-amount]::after { content: '***'; }`(若 Spike 期未落地则补);验证"记一笔"页金额输入**未**加 `data-amount`(clarify Q1 = A)
- [ ] T066 [US5] 慢速网络闪现检测:Chrome DevTools Slow 3G + CPU throttle 6x,刷新 dashboard,Performance 面板录制;断言 0 次真实金额 paint 帧(spec SC-008)

**Checkpoint**: 隐私按钮可切换,所有展示页金额同步隐藏 / 恢复,刷新保持,无闪现。

---

## Phase 8: User Story 6 - 首页分类卡下钻 (Priority: P3)

**Goal**: 首页 Top 2 分类卡可点击,跳转账单页带 `month/type=expense/categoryId` 三参数。

**Independent Test**: 在首页点 Top 2 任一卡,跳转 `/transactions?month=2026-07&type=expense&categoryId=<id>`;账单页正确筛选;编辑返回保留参数(spec US6 acceptance 1-4)。

### Implementation for User Story 6

- [ ] T067 [US6] 在 `src/components/dashboard/top-category-card.tsx` 接线 onClick:`router.push(`/transactions?month=${year}-${month}&type=expense&categoryId=${categoryId}`)`(依赖 US4 的 `year/month` 状态)
- [ ] T068 [US6] 修改 `src/app/(app)/transactions/page.tsx`:从 `useSearchParams()` 读 `month/type/categoryId`;无权限或无效的 `categoryId` 安全忽略(spec FR-C006 acceptance 3)
- [ ] T069 [US6] 修改 `src/app/(app)/transaction/[id]/edit/page.tsx`:编辑完成后 `router.back()` 或 `router.push(returnTo)`,保留原 URL 查询参数(spec FR-B004)

**Checkpoint**: 首页下钻闭环,账单筛选正确,编辑返回保留参数。

---

## Phase 9: User Story 7 - "我的"页面 + 昵称 mutation (Priority: P3)

**Goal**: 重做 `/settings` 为"我的"(路由保留):个人信息(昵称)+ 账户 + 分类 + API Key + 退出;昵称可编辑保存。

**Independent Test**: 进入 `/settings`,文案显示"我的";编辑昵称 → trim → 保存 → 首页问候语同步;跨 member 隔离(spec US7 acceptance 1-5)。

### Implementation for User Story 7

- [ ] T070 [P] [US7] 新建 `src/components/settings/nickname-editor.tsx`:HeroUI Modal + TextField + 验证(trim 后 1-30 字符);`trpc.auth.updateNickname.mutate()`;onSuccess 调用 `utils.auth.me.invalidate()`
- [ ] T071 [US7] 重组 `src/app/(app)/settings/page.tsx`:页面标题改"我的";整合个人信息(昵称 + 邮箱)+ 账户管理 + 分类管理 + API Key + 退出登录;使用 HeroUI Tabs 或 Card 列表
- [ ] T072 [US7] 修改 `src/app/(app)/dashboard/page.tsx`(若 US4 未集成):订阅 `trpc.auth.me.query()`,顶部问候显示 `member.displayName`;昵称更新后自动 rerender(invalidate 生效)
- [ ] T073 [US7] 退出登录:HeroUI AlertDialog 确认 → 调用 `signOut()` → 重定向 `/login`

**Checkpoint**: `/settings` 重组完成,昵称 mutation 闭环,跨 member 隔离有效。

---

## Phase 10: Polish & Cross-Cutting Concerns (Switch PR 收尾 + 1.0.0 Release)

**Goal**: 删除 shadcn 残留 + 修订宪章 + 同步历史 spec + 完整 QA + Switch PR 合并 + 1.0.0 release。

- [ ] T074 [P] 删除 shadcn 拷贝件:`git rm src/components/ui/{alert-dialog,button,card,checkbox,command,dialog,input,label,popover,radio-group,select,skeleton,tabs,tooltip}.tsx`(若已重写为 HeroUI 适配层,改为 `git rm` 残留并保留必要适配层文件)
- [ ] T075 [P] 删除 `components.json`:`git rm components.json`
- [ ] T076 [P] 移除旧依赖:`pnpm remove @radix-ui/react-alert-dialog @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-radio-group @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-tooltip cmdk class-variance-authority tw-animate-css`(若 cmdk 仍被 T034 保留则跳过)
- [ ] T077 验证依赖树干净:`grep -r "@radix-ui" src/ package.json` 命中 = 0;`grep -r "components/ui" src/` 命中 = 0 或仅 HeroUI 适配层;`pnpm install --frozen-lockfile` 通过
- [ ] T078 [P] 修订 `.specify/memory/constitution.md`:版本 v2.0.0 → v3.0.0;§技术栈 "UI 组件 | shadcn/ui | Radix + Tailwind (保留)" → "HeroUI v3 | @heroui/react + @heroui/styles";同步影响报告标记 MAJOR(理由:UI 视觉变更 + 公共组件 API 变更 + 依赖树变更 + IA 重构 + 新增报表页)
- [ ] T079 [P] 同步历史 spec:更新 `specs/{008-transaction-ui,009-transactions-list-ui,010-settings-ui,023-category-ui,024-ui-consistency,025-legacy-shadcn-migration}/spec.md` 中"今后使用 shadcn"指示语句 → "HeroUI";标题保留作为历史记录(spec FR-H004)
- [ ] T080 [P] 单元测试补充:确认 `tests/unit/` 覆盖 lib/{theme,privacy,date-ranges}.ts 所有边界;`pnpm test:unit` 全绿
- [ ] T081 跨尺寸人工 QA(spec FR-G002):375px / 430px / 桌面端三种尺寸跑 MVP + 报表 + 隐私 + 昵称完整流程,P0/P1 bug = 0(详见 [quickstart.md 场景 3.1](./quickstart.md))
- [ ] T082 [P] Lighthouse 可访问性审计(spec FR-G003 + SC-004):Chrome DevTools → Lighthouse → Accessibility;审计 4 个关键页面(/dashboard /transactions /reports /settings),得分 ≥ 90;键盘导航 + 焦点样式 + 颜色对比 + ARIA 标签完整
- [ ] T083 Switch PR 合并:`git push -u origin feat/026-switch` → `gh pr create --title "feat(026): Switch - HeroUI migration + reports + dashboard revamp + my page" --body "..."` → 等 CI 全绿 → 本地 staging 部署验证 → `gh pr merge --squash --delete-branch`
- [ ] T084 1.0.0 release:在 main 上修改 `package.json` version `0.2.0` → `1.0.0`;`git commit -am "chore(release): v1.0.0"`;`git tag -a v1.0.0 -m "Release v1.0.0 ..."`;`git push origin main && git push origin v1.0.0`;`gh release create v1.0.0 --generate-notes --latest`
- [ ] T085 [P] 30 天回顾(spec SC-005):1.0.0 发布后 30 天内跟踪 UI 相关回归 bug,目标 ≤ 2 个 P2 及以下,0 个 P0/P1(后续 task,可在 PR 合并后挂起)

**Checkpoint**: shadcn 完全清理,宪章 v3.0.0 落地,1.0.0 已发布。

---

## Phase 11: BALTHASAR 整体 UI 改造(2026-07-14 新增)

**Goal**: 用户在 1.0.0-rc.1 前后追加的 13 项 UI 改造,响应式 / 三主题 / 品牌精修。

**Spec reference**: 见 spec.md §I 系列 FR(FR-I001 ~ FR-I013)与 Clarifications Q12。

### 第一期(已 commit 710dab9 + 98fb45a):
- [x] T086 [P] 新建 `src/components/layout/app-shell.tsx`(mobile 底栏 / md+ 侧栏,max-w-1120 居中,safe-area-inset-bottom)
- [x] T087 [P] 新建 `src/components/layout/sidebar.tsx`(240px 左侧栏 + BALTHASAR 品牌)
- [x] T086b [P] 新建 `src/components/layout/page-header.tsx`(`{title, description, actions}`)
- [x] T088 [P] 新建 `src/components/theme/theme-provider.tsx`(三选 system/light/dark,localStorage `balthasar.theme`,matchMedia 监听,mounted 防 FOUC)
- [x] T089 [P] 新建 `src/components/theme/theme-toggle.tsx`(HeroUI Tabs 三选 UI)
- [x] T090 全仓 grep 硬编码颜色 → `var(--danger)` / `var(--success)` / `var(--accent)` / `var(--muted)` 替换
- [x] T091 [P] 新建 `src/components/shared/month-select.tsx`(替代 MonthPicker + 删除 DatePicker 隐藏 day hack;接口 `{value, onChange, months?, ariaLabel?}`)
- [x] T092 `globals.css` 隐私规则改 position: relative + ::after absolute 居中(消除位移)
- [x] T093 流水/账户/分类按钮 ghost/danger + ≥44px 热区 + Tooltip + aria-label
- [x] T094 图表 dot onClick + MonthButtonRow 主入口 + 同色 PALETTE 标记

### 第二期(已 commit 8591154):
- [x] T095 [P] 新建 `src/components/layout/brand-header.tsx`(登录/注册 + 中文价值说明 "10 秒记账,每天坚持")
- [x] T096 `settings/page.tsx` 底部署名 BALTHASAR + version(从 `package.json` 读);sidebar 同步
- [x] T097 `globals.css` @layer utilities 5 级字体规范(text-display/heading/body/caption/amount/chart)+ tabular-nums
- [x] T098 Skeleton 尺寸统一对齐真实内容
- [x] T099 [P] 新建 `src/components/feedback/empty-state.tsx`(icon/title/description/action)+ 替换 6 处
- [x] T100 视觉细节复核(圆角/阴影/间距走 HeroUI 默认)

### review 修复(已 commit 9475831):
- [x] T101 `globals.css` 未定义令牌修复(`--muted-foreground` → `--muted`)
- [x] T102 3 charts Tooltip `data-amount` 精准挂金额 span(避免子 span text-foreground 泄漏)
- [x] T103 `bottom-navigation` 安全区 calc 高度(home indicator 不压住)
- [x] T104 图表坐标 `var(--border)` 网格 + `var(--muted)` tick 替换 12 处 oklch(适配 light/dark)
- [x] T105 `cn()` 替代模板字符串 4 处
- [x] T106 `ThemeContext` useMemo + mounted(避免首帧选中态闪烁 + 重渲染优化)
- [x] T107 `settings/categories` max-w-[720px](桌面端居中)
- [x] T108 sidebar/bottom-nav 嵌套路由前缀匹配(子路由也高亮父入口)
- [x] T109 sidebar 版本号从 `package.json` 读(与 settings 一致)
- [x] T110 theme-toggle `!mounted` 骨架避免首帧错位

**Checkpoint**: 13 项改造全部完成,1.0.0-rc.1 已发布(d675230)。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup / Spike)**:无依赖,立即开始;**必须先 squash 合并**才能启动 Phase 2
- **Phase 2 (Foundational / 后端 procedure)**:依赖 Phase 1(共用 `src/lib/date-ranges.ts`);**必须先完成**才能启动 Phase 5 / 6 / 9(US3 / US4 / US7 前端)
- **Phase 3 (US1 全站切换)**:依赖 Phase 1;可与 Phase 2 并行启动
- **Phase 4 (US2 底部导航)**:依赖 Phase 1;可与 Phase 2/3 并行
- **Phase 5 (US3 报表页)**:依赖 Phase 2(`dashboard.report`)+ Phase 3(`/reports` 占位样式)
- **Phase 6 (US4 首页月份)**:依赖 Phase 2(`dashboard.summary` 扩展)+ Phase 3(首页骨架已切换 HeroUI)
- **Phase 7 (US5 隐私)**:依赖 Phase 1(`src/lib/privacy.ts`)+ Phase 3(展示页已切换)
- **Phase 8 (US6 下钻)**:依赖 Phase 6(月份状态)+ Phase 3(首页 Top 2 卡)
- **Phase 9 (US7 昵称)**:依赖 Phase 2(`auth.updateNickname`)+ Phase 3(settings 页骨架)
- **Phase 10 (Polish)**:依赖所有 US 完成;含 Switch PR 合并 + 1.0.0 release
- **Phase 11 (BALTHASAR 改造)**:依赖 Phase 1-10 已合并(1.0.0-rc.1 基础);3 个 commit 覆盖第一期/第二期/review 修复

### Within Switch PR (Phase 2-9)

物理上所有 phase 合并到 `feat/026-switch` 单一分支,但按 commit 分页提交:
1. commit 1-3:Phase 2 后端 procedure(测试 + 实现)
2. commit 4-13:Phase 3 通用组件 + 页面切换(每页一 commit)
3. commit 14-17:Phase 4-9 各 US 一个 commit
4. commit 18-25:Phase 10 清理 + 文档 + QA

### Parallel Opportunities

**Spike PR(Phase 1)**:
- T002-T012 多数带 `[P]`,可并行(不同文件)
- 注意 T007(layout.tsx inline script)依赖 T005(privacy.ts),顺序执行

**Switch PR(Phase 2-9)**:
- Phase 2 三个 procedure 测试 + 实现完全并行(不同文件)
- Phase 3 通用组件迁移全部可并行(T025-T034)
- Phase 3 页面切换全部可并行(T035-T046)
- Phase 5-9 各 US 内任务多可并行
- 单人维护建议按 commit 顺序串行执行,降低 review 负担

---

## Parallel Example: Phase 1 Spike

```bash
# 4 个独立文件可并行(不同人不同分支或单人串行):
Task: "落地 src/lib/theme.ts(T004)"
Task: "落地 src/lib/privacy.ts(T005)"
Task: "落地 src/lib/date-ranges.ts(T006)"
Task: "落地 docs/THEME.md(T008)"

# 3 个单元测试可并行:
Task: "tests/unit/date-ranges.test.ts(T009)"
Task: "tests/unit/privacy.test.ts(T010)"
Task: "tests/unit/theme.test.ts(T011)"
```

---

## Parallel Example: Phase 2 Foundational TDD

```bash
# 3 个集成测试可并行(测试先行):
Task: "扩展 tests/integration/dashboard/summary.test.ts(T015)"
Task: "新建 tests/integration/dashboard/report.test.ts(T016)"
Task: "新建 tests/integration/auth/update-nickname.test.ts(T017)"

# 跑 T018 确认全红后,3 个 procedure 实现可并行:
Task: "扩展 dashboard.summary(T019)"
Task: "新增 dashboard.report(T021)"
Task: "新增 auth.updateNickname(T022)"
```

---

## Implementation Strategy

### MVP First (Phase 1-3)

1. **Phase 1 (Spike PR)**:HeroUI 安装 + 奶油琥珀 + 共享工具 + 单元测试 → **squash 合并到 main**
2. **Phase 2 (Foundational)**:3 个后端 procedure TDD → 集成测试全绿
3. **Phase 3 (US1)**:8 个页面 HeroUI 切换 + 功能等价 → **STOP & VALIDATE**:跑 MVP 完整流程,视觉统一,功能等价

完成 Phase 1-3 即达"奶油琥珀全站统一 UI"的最小可发布状态(可发 1.0.0-rc1,但不推荐 — 等 Phase 4-9 完整再发 1.0.0)。

### Incremental Delivery

1. Phase 1 → Spike PR 合并(可独立 ship,视觉无变化)
2. Phase 2-3 → 起步切换(可发 rc1,但底部导航与新功能未就位)
3. Phase 4-9 → 增量叠加(每 US 独立可测)
4. Phase 10 → shadcn 清理 + 宪章 + 1.0.0 release(完整发布)

### Spike + Switch 单人维护建议

- **Spike 期(Week 1)**:专注 Phase 1,尽快合并,解锁 Phase 2
- **Switch 期(Week 2)**:按 Phase 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 顺序串行;每 Phase 完成立即本地 QA
- **Switch PR 合并前**:必须本地 staging 完整跑 quickstart 阶段 3 所有场景
- **1.0.0 release 后**:30 天 SC-005 回顾

---

## Notes

- 所有 task 含明确文件路径,LLM 可直接执行无需额外上下文
- TDD 强制:Phase 2 三个 procedure 必须先 T015-T017 测试 + T018 全红,再 T019-T023 实现
- Spike PR 是 Switch PR 的硬前置,Spike 未合并则 Switch 不能启动
- Switch PR 体积大,必须按 commit 分页提交,降低 review 难度
- 宪章修订 v2.0.0 → v3.0.0 与 Switch PR 同 PR 完成,不允许 spec 与宪章矛盾超过一个发布周期
- dnd-kit(`@dnd-kit/*`)不在迁移范围,继续保留(spec Assumptions)
