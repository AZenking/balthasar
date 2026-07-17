---

description: "Task list for 029-mobile-keyboard-layout — 移动端键盘弹起布局稳定性"
---

# Tasks: 029 移动端键盘弹起布局稳定性

**Input**: Design documents from `/specs/029-mobile-keyboard-layout/`

**Prerequisites**: [plan.md](./plan.md)(required), [spec.md](./spec.md)(required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/visual-equivalence.md](./contracts/visual-equivalence.md), [quickstart.md](./quickstart.md)

**Tests**: 宪章原则四"测试优先"硬性要求;每个 hook/关键组件改动先写测试,失败后再实现转绿。

**Organization**: 按 spec.md 三档优先级(P1 Drawer / P2 全屏页 / P3 次要表单)纵切,Phase 2 共享 hooks 作为 Foundational。每个 Phase 是独立可测增量,对齐 incremental delivery。

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可并行(不同文件,无依赖)
- **[Story]**: 用户故事标签(US1 / US2 / US3),映射 spec.md
- **路径**: src/lib/hooks/ 共享,src/components/<feature>/ 各 feature slice

---

## Phase 1: Setup

**Purpose**: 验证分支干净 + 捕获修复前 baseline 截图(对齐 025 模式)。

- [ ] T001 验证当前分支 `029-mobile-keyboard-layout` 已含 commit 96d470f(`layout.tsx` viewport-fit=cover + `bottom-navigation.tsx` safe-area),`pnpm install` 通过
- [ ] T002 [P] 创建 `specs/029-mobile-keyboard-layout/baseline.md`,记录修复前在 iPhone 12 / Pixel 7 DevTools 模拟下"打开 Drawer → 聚焦金额 → 切换备注 → 收起键盘"四帧截图与 CLS 数字(SC-003 分母)

---

## Phase 2: Foundational — 共享 hooks(Blocking Prerequisites)

**Purpose**: 实现 `useVisualViewport` 与 `useScrollIntoViewOnFocus`,作为所有 US 共享基础设施。

**⚠️ CRITICAL**: Phase 3+ 全部依赖本 Phase 完成 —— 没有 hook 就无法在 Drawer / 全屏页 / P3 入口接入键盘感知。

### Tests for Foundational(test-first,宪章原则四)

- [ ] T003 [P] 写 `useVisualViewport` hook 单元测试 `src/lib/hooks/__tests__/use-visual-viewport.test.ts`:mock `window.visualViewport` 不同 `height`/`offsetTop` 输入,断言返回 `keyboardHeight` 与 `isKeyboardOpen`(>150px 阈值)正确;断言桌面环境(`innerHeight === visualViewport.height`)永远 `isKeyboardOpen=false`
- [ ] T004 [P] 写 `useScrollIntoViewOnFocus` hook 单元测试 `src/lib/hooks/__tests__/use-scroll-into-view-on-focus.test.ts`:mock `focusin` 事件,断言 `scrollIntoView` 在 rAF + 300ms setTimeout 后被调用,`block: "center"` 参数正确

### Implementation for Foundational

- [ ] T005 实现 `src/lib/hooks/use-visual-viewport.ts`:订阅 `resize` + `scroll` 双事件,返回 `{ height, offsetTop, keyboardHeight, isKeyboardOpen }`(`keyboardHeight = max(0, innerHeight - vv.height)`,`isKeyboardOpen = keyboardHeight > 150`);无 `visualViewport` 时返回 identity(桌面端优雅降级,R5)
- [ ] T006 实现 `src/lib/hooks/use-scroll-into-view-on-focus.ts`:返回 ref callback,绑 `focusin` 事件,`requestAnimationFrame(() => setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 300))`(R2)
- [ ] T007 跑 `pnpm test:unit src/lib/hooks/__tests__/` 确认 T003 + T004 全绿(测试转绿,宪章红 → 绿)
- [ ] T008 把 Phase 2 产出(2 hooks + 2 单元测试 + baseline.md)作为 **PR-1** 提交(`feat(mobile): useVisualViewport + useScrollIntoViewOnFocus hooks`)

**Checkpoint**: 共享 hooks 已落地;Phase 3+ 可开始接入。

---

## Phase 3: User Story 1 — 记一笔 Drawer 内的键盘无障碍 (Priority: P1) 🎯 MVP

**Goal**: TransactionDrawer 内键盘弹起时聚焦字段 300ms 内可见、保存按钮始终可达、CLS ≤ 0.05。

**Independent Test**: 在 iPhone 12 Safari + Pixel 7 Chrome 上,从 `/dashboard` 点 FAB 打开 Drawer,完整跑 acceptance scenarios 1–5(spec.md US1)。

### Tests for US1(test-first)

- [ ] T009 [P] [US1] 写 TransactionDrawer 组件测试 `src/components/transaction/__tests__/transaction-drawer.test.tsx`:mock `useVisualViewport` 返回 `{ keyboardHeight: 300, isKeyboardOpen: true }`,断言 `Drawer.Footer` 容器 `paddingBottom` 等于 `max(env(safe-area-inset-bottom), 300px)`;mock `focusin` 事件触发 TextArea,断言 `scrollIntoView` 被调用

### Implementation for US1

- [ ] T010 [US1] 修改 `src/components/transaction/transaction-drawer.tsx`:Drawer.Footer 容器加 `style={{ paddingBottom: 'max(env(safe-area-inset-bottom), {keyboardHeight}px)' }}` + `transition: padding-bottom 200ms ease`,通过 `useVisualViewport()` 取 `keyboardHeight`(R3 Strategy A)
- [ ] T011 [US1] 修改 `src/components/transaction/transaction-form.tsx`:embedded 模式下表单根 `<div className="space-y-4 pb-4">` 接 `ref={useScrollIntoViewOnFocus()}`,让任意子字段 focusin 触发滚入中心
- [ ] T012 [US1] 验证 `Drawer.Header`(含"记一笔"标题 + CloseTrigger)在键盘弹起时 sticky 在 Drawer 顶部,不被推出视口(FR-004)
- [ ] T013 [US1] DevTools 模拟验收(iPhone 12 + Mid-Tier Mobile + Slow 3G):跑 quickstart.md §3.1.1 – §3.1.4 全部 checklist,更新 `baseline.md` after 区块
- [ ] T014 [US1] 真机验收:iPhone 12/13 Safari + Redmi Note 12/Samsung A Chrome 各 1 台跑 spec.md US1 acceptance 1–5
- [ ] T015 [US1] 跑 `pnpm test:unit && pnpm type-check && pnpm lint && pnpm build`,提交 **PR-2**(`perf(transaction-drawer): keyboard-safe layout for 记一笔 Drawer`)

**Checkpoint**: P1 主入口键盘可用性达标,宪章原则五 "10 秒完成一笔" 体感预算得到保护。

---

## Phase 4: User Story 2 — 全屏交易表单页的键盘无障碍 (Priority: P2)

**Goal**: `/transaction/new` 与 `/transaction/[id]/edit` 全屏页键盘交互与 Drawer 入口等价。

**Independent Test**: 在真机 + DevTools 上直接访问 `/transaction/new` 深链,跑 spec.md US2 acceptance 1–3。

### Tests for US2

- [ ] T016 [P] [US2] 写 `src/components/transaction/__tests__/transaction-form-fullscreen.test.tsx`:mock visualViewport + focusin,断言 `Card.Footer` 提交按钮在键盘弹起时 paddingBottom 跟随 `keyboardHeight`,断言聚焦字段 `scrollIntoView` 被调用

### Implementation for US2

- [ ] T017 [US2] 修改 `src/components/transaction/transaction-form.tsx` 非 embedded 分支(独立 page 模式):`Card.Footer` 加 `style={{ paddingBottom: 'max(env(safe-area-inset-bottom), {keyboardHeight}px)' }}` + `transition: padding-bottom 200ms ease`,表单根容器接 `useScrollIntoViewOnFocus` ref(R3 Strategy B)
- [ ] T018 [US2] 验证 `Card.Header` 内 ChevronLeft 返回按钮在键盘弹起时仍可触达(FR-004);若 Header 被 Card 滚出视口,加 sticky 定位
- [ ] T019 [US2] DevTools 模拟 + 真机验收 `/transaction/new` 与 `/transaction/[id]/edit` 两条路由,更新 `baseline.md` after 区块
- [ ] T020 [US2] 跑 `pnpm test:unit && pnpm type-check && pnpm lint && pnpm build`,提交 **PR-3**(`perf(transaction): keyboard-safe full-screen transaction pages`)

**Checkpoint**: 主要录入入口(Drawer + 全屏)键盘行为一致,无割裂感。

---

## Phase 5: User Story 3 — 其它表单入口的键盘一致性 (Priority: P3)

**Goal**: 账户 / 分类 / 设置 / onboarding 表单键盘行为与 P1/P2 等价(spec clarification Q1)。

**Independent Test**: 每个入口至少 1 个核心输入场景在中端真机上通过 FR-001/002/003 验收。

### Implementation for US3(P3 共用 hook,无新测试)

- [ ] T021 [P] [US3] 用 codegraph 扫描 `src/components/{account,category,settings}/**` + `src/app/(app)/onboarding/**` 全部 `.tsx`,产出表单入口清单(含 input/textarea 的文件),记入 `specs/029-mobile-keyboard-layout/p3-inventory.md`
- [ ] T022 [P] [US3] 修改 `src/components/account/account-form.tsx`(或同类账户表单组件):根 div 接 `useScrollIntoViewOnFocus` ref;若含 Modal/BottomNav 提交按钮,加 `useVisualViewport` paddingBottom
- [ ] T023 [P] [US3] 修改 `src/components/category/category-manager.tsx`:分类名输入聚焦滚入 + 保存按钮键盘上方黏附
- [ ] T024 [P] [US3] 修改 `src/components/settings/api-key-manager.tsx` 与设置内其它输入表单:同上模式接入
- [ ] T025 [P] [US3] 修改 `src/app/(app)/onboarding/**` 内的输入表单:同上模式接入
- [ ] T026 [US3] 真机抽测 P3 入口(每入口至少 1 个核心输入场景),更新 `baseline.md` after 区块
- [ ] T027 [US3] 跑 `pnpm test:unit && pnpm type-check && pnpm lint && pnpm build`,提交 **PR-4**(`perf(mobile): keyboard-safe layout for account/category/settings/onboarding forms`)

**Checkpoint**: 所有用户可见输入场景键盘行为等价,产品一致性达成。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 桌面端回归 + 性能验证 + initiative 收尾。

- [ ] T028 [P] 桌面端回归测试(SC-005):桌面 Chrome 跑 quickstart.md §6 全部 checklist(物理键盘 / Tab 导航 / autocomplete / zoom / window resize),0 退化
- [ ] T029 SC-006 端到端耗时测量:在中端 iPhone 12 Safari 测"打开应用 → 进入记一笔 → 输入完整一笔 → 保存"的中位耗时,与 baseline.md 修复前对照,确认不增加
- [ ] T030 [P] SC-003 Lighthouse Mobile 验证:`pnpm build && pnpm start`,DevTools Lighthouse Mobile preset 对 `/dashboard` 跑 3 次取中位数,CLS ≤ 0.05、LCP/INP 不退化
- [ ] T031 [P] 更新 `docs/AGENTS.md` React/Next.js 范式段落:若本次 initiative 厘清了"移动端键盘适配用 visualViewport + HeroUI 外层 workaround"约定,补入文档
- [ ] T032 跑全量 `pnpm test:unit && pnpm test:procedure && pnpm type-check && pnpm lint && pnpm build`,SC-010 等价要求 100% 通过、0 新增 bug
- [ ] T033 最终视觉 diff:截 `/`、`/transactions`、`/transaction/new`、`/settings` 四张稳态截图,与 `baseline.md` 修复前对照(只允许 contracts/visual-equivalence.md §4 列出的差异)
- [ ] T034 完整跑一遍 `quickstart.md` §1 – §11 作为最终 acceptance gate;在 `baseline.md` 末尾记 "All SC passed" 与日期
- [ ] T035 提交 **PR-5**(`chore(mobile): final validation + initiative close`),关闭 029-mobile-keyboard-layout

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,可立即开始
- **Foundational (Phase 2)**: 依赖 Phase 1 完成 —— **阻塞所有用户故事**
- **US1 (Phase 3, P1)**: 依赖 Phase 2 hooks;独立可测,推荐 MVP 单 PR-2 合并
- **US2 (Phase 4, P2)**: 依赖 Phase 2 hooks;可与 US1 并行(若两人协作),但建议 US1 先合并避免 merge 冲突
- **US3 (Phase 5, P3)**: 依赖 Phase 2 hooks;可与 US1/US2 并行
- **Polish (Phase 6)**: 依赖所有用户故事完成

### User Story Dependencies

- **US1 (P1)**: 仅依赖 Foundational,与 US2/US3 无相互依赖
- **US2 (P2)**: 仅依赖 Foundational;修改 `transaction-form.tsx` 非 embedded 分支与 US1 的 embedded 分支**同文件不同分支**,建议串行避免冲突
- **US3 (P3)**: 仅依赖 Foundational;四个子入口(account/category/settings/onboarding)全部 [P] 可并行

### Within Each User Story

- 测试先写 → 失败 → 实现转绿(宪章原则四)
- Hook 接入 → 视觉/交互验收 → 真机抽测 → PR
- 每 PR 单独 mergeable,不依赖后续 PR

### Parallel Opportunities

- Phase 2 T003 + T004(两个 hook 单元测试)可并行
- Phase 3+ 各 US 之间可并行(若团队容量允许)
- Phase 5 P3 四个入口(T022 – T025)全部 [P] 可并行
- Phase 6 T028 + T030 + T031 可并行

---

## Parallel Example: Phase 5 P3 入口并行

```bash
# Four P3 entry points can be worked on simultaneously:
Task: "T022 [P] [US3] account form keyboard-safe (src/components/account/account-form.tsx)"
Task: "T023 [P] [US3] category manager keyboard-safe (src/components/category/category-manager.tsx)"
Task: "T024 [P] [US3] settings forms keyboard-safe (src/components/settings/api-key-manager.tsx + others)"
Task: "T025 [P] [US3] onboarding forms keyboard-safe (src/app/(app)/onboarding/**)"
```

---

## Implementation Strategy

### MVP First(US1 Only,推荐路径)

1. Phase 1 Setup(baseline 截图)
2. Phase 2 Foundational(2 hooks + 2 单元测试 → PR-1)
3. Phase 3 US1(TransactionDrawer → PR-2)
4. **STOP and VALIDATE**:在真机跑完 spec.md US1 acceptance 1–5,确认 P1 主入口达标
5. 若时间紧迫,可在此暂停合并,US2/US3 留后续 initiative

### Incremental Delivery

1. Foundational → hooks ready(可单独合 PR-1)
2. +US1 → P1 主入口可用(PR-2)
3. +US2 → 全屏页等价(PR-3)
4. +US3 → 全产品一致性(PR-4)
5. Polish → 收尾验收 + 关闭 initiative(PR-5)

### Single-Developer Strategy(本仓库默认)

按 P1 → P2 → P3 → Polish 严格顺序;每 PR 独立 mergeable;Foundational 必须最先合并(否则后续 PR 都基于未合并代码,reviewer 难以验收)。

---

## Notes

- 测试任务标 [P] 可与同 Phase 其它测试并行(不同文件)
- 同一文件多个修改不可并行(如 `transaction-form.tsx` 的 embedded + 非 embedded 分支在 US1/US2,建议串行)
- 每个 PR 必须包含 quickstart.md 对应章节的验收记录
- NEEDS-MANUAL(真机 + DevTools GUI)部分不走 CI 自动化,对齐 025 模式(reviewer runbook)
- 宪章原则七硬约束:任何 HeroUI 组件 API 改动前重新调用 `/heroui-react` skill;若发现 R2 决策的 workaround 在新 HeroUI 版本有原生支持,及时收敛
