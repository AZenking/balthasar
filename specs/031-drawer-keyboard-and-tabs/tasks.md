---

description: "Task list for 031-drawer-keyboard-and-tabs — 记一笔 Drawer 键盘避让收敛 + 类型 Tabs 优化"
---

# Tasks: 031 记一笔 Drawer 键盘避让收敛 + 类型 Tabs 优化

**Input**: Design documents from `/specs/031-drawer-keyboard-and-tabs/`

**Prerequisites**: [plan.md](./plan.md)(required), [spec.md](./spec.md)(required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/keyboard-strategy.md](./contracts/keyboard-strategy.md), [quickstart.md](./quickstart.md)

**Tests**: 宪章原则四"测试优先"硬性要求;每个 hook 纯函数 / 关键交互改动先写测试,观察失败,再实现转绿。测试落 `src/tests/unit/`(项目既有约定:`.test.ts` 走 unit/node,`.test.tsx` 走 ui/jsdom)。

**Organization**: 按 spec.md 两档优先级(US1 P1 Drawer 键盘 / US2 P2 Tabs)纵切,Phase 2 共享 hook 改造作为 Foundational。每个 Phase 是独立可测增量,对齐 incremental delivery。

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可并行(不同文件,无依赖)
- **[Story]**: 用户故事标签(US1 / US2),映射 spec.md
- **路径**: `src/lib/hooks/` 共享,`src/components/transaction/` feature slice,`src/tests/unit/` 测试

---

## Phase 1: Setup

**Purpose**: 验证分支干净 + 捕获修复前 baseline 截图(对齐 029 baseline.md 模式),作为 after 区块对照基准。

- [ ] T001 验证当前分支 `031-drawer-keyboard-and-tabs` 基于 `main` 最新(含 029 hooks: `src/lib/hooks/use-visual-viewport.ts`、`use-scroll-into-view-on-focus.ts`;含 030 dashboard),`pnpm install` + `pnpm test:unit` 通过(确认无既有红)
- [ ] T002 [P] 创建 `specs/031-drawer-keyboard-and-tabs/baseline.md`,记录修复前在 iPhone Safari + 中端 Android Chrome 上"打开 Drawer → 聚焦金额 → 切换备注 → 收起键盘"四帧截图 + 症状描述(Drawer 上移 / 空隙 / 设置页透出),作为 quickstart.md §3.1 的 before 对照(SC-001 分母)
- [ ] T003 [P] 先调 `/heroui-react` skill 取 HeroUI v3 Drawer / Modal / Tabs 官方文档,确认 research.md R2/R5/R6 引用的 prop/slot(anatomy:`Drawer.Content` / `Drawer.Dialog` / `Drawer.Body` / `Drawer.Footer`;Tabs 无 `size`、密度经 `Tabs.List`/`Tabs.Tab` className)与当前 `@heroui/react` 版本一致;若有版本差异,补一条 note 到 research.md(宪章原则七)

---

## Phase 2: Foundational — scroll hook 改造为 Body 内部滚动(Blocking Prerequisites)

**Purpose**: 把 `useScrollIntoViewOnFocus` 从"全局 scrollIntoView"改造为"只调 Drawer.Body 自身 scrollTop",并加去抖。这是 US1/US2 共享基础设施,Phase 3+ 全部依赖。

**⚠️ CRITICAL**: 本 Phase 是根因(R1)消除的核心——不改造此 hook,US1 的"Drawer 不被带飞"无法成立。

### Tests for Foundational(test-first,宪章原则四)

- [ ] T004 写 `useScrollIntoViewOnFocus` 改造后的纯函数测试 `src/tests/unit/scroll-into-view-on-focus.test.ts`:抽出的纯函数 `computeBodyScrollDelta(targetRect, bodyRect, currentScrollTop)` 在目标在 Body 上方/下方/居中三种情形返回正确的 `delta`;断言 hook 永不调用 `target.scrollIntoView`(mock `Element.prototype.scrollIntoView` 断言 not called),只赋值 `container.scrollTop`
- [ ] T005 写 `useScrollIntoViewOnFocus` 去抖测试(同文件):连续两次 focusin(第二次在第一次的 rAF 触发前)只应产生一次 scrollTop 赋值(断言 pending rAF 被 cancel)
- [ ] T006 跑 `pnpm test:unit src/tests/unit/scroll-into-view-on-focus.test.ts` 确认 T004 + T005 **红**(新测试,实现未改)→ 改造后转绿

### Implementation for Foundational

- [ ] T007 改造 `src/lib/hooks/use-scroll-into-view-on-focus.ts`:
  - 抽出并导出纯函数 `computeBodyScrollDelta(target: DOMRect, body: DOMRect, currentScrollTop: number): number`(目标滚到 Body 视觉中心所需的 `scrollTop` 增量)
  - hook 签名从 `useScrollIntoViewOnFocus<T>()` 改为接收 scroll container ref 的形式(如 `useScrollIntoViewOnFocus<T>()` 返回 `{ containerRef, attachRef }`,或新增参数 `getScrollContainer: () => HTMLElement | null`);focusin 时用 `computeBodyScrollDelta` 计算 delta 并赋值给 container 的 `scrollTop`,**删除** `target.scrollIntoView` 调用与 300ms `setTimeout`(保留 `requestAnimationFrame` 等 React 渲染)
  - 用 `cancelAnimationFrame` 去抖:新 focusin cancel 上一个 pending rafId(spec FR-007)
  - 更新文件顶部 JSDoc:标注 031 改造原因(029 全局 scroll 在 iOS 滚 fixed 容器,R1/R3)
- [ ] T008 跑 `pnpm test:unit src/tests/unit/scroll-into-view-on-focus.test.ts` 确认 T004 + T005 **转绿**(宪章红 → 绿)

**Checkpoint**: scroll hook 只滚 Body 内部、已去抖;US1/US2 可接入。

---

## Phase 3: User Story 1 — 记一笔 Drawer 键盘弹起不再透出背景页 (Priority: P1) 🎯 MVP

**Goal**: Drawer 高度受 `visualViewport.height` 钳制,submit 移入 `Drawer.Footer`,移除 paddingBottom 补偿;键盘弹起时 Drawer 紧贴键盘、无空隙、背景不透出、无抖动。

**Independent Test**: iPhone(Safari + PWA standalone)+ 中端 Android(Chrome)上从首页点 FAB 开 Drawer,跑 spec US1 acceptance scenarios 1–6,对照 baseline.md before 截图验证"无空隙 / 不透出 / 无抖动"。

### Tests for User Story 1(test-first)

> NOTE: 写测试 FIRST,确认 FAIL(header 高度钳制 + Footer submit 尚未实现),再实现转绿。

- [ ] T009 [P] [US1] 写 `useVisualViewport` 在 Drawer 高度钳制场景的契约测试 `src/tests/unit/drawer-viewport-clamp.test.ts`(纯函数):若新增 `computeDrawerMaxHeight(vvHeight: number, fallback: number)` 纯函数,断言 `vvHeight>0` 返回 `vvHeight`、`vvHeight<=0`(SSR/桌面 identity)返回 `fallback`;断言桌面端(`innerHeight === vv.height`)钳制值等于 innerHeight(不误钳)
- [ ] T010 [P] [US1] 写组件测试 `src/tests/unit/transaction-drawer.test.tsx`(jsdom):render `<TransactionDrawer>` 打开后,断言 submit 按钮渲染在 `Drawer.Footer` slot 内(非 `Drawer.Body` 内);断言 `Drawer.Content`/`Drawer.Dialog` 的 style 含受 `visualViewport.height` 驱动的 maxHeight(通过 mock `useVisualViewport` 返回固定 height 断言)
- [ ] T011 [P] [US1] 写组件测试(同 T010 文件或 `transaction-form.test.tsx`):断言 embedded 分支的根 div **不再**含 `paddingBottom: max(env(...), <keyboardHeight>)` inline style(R4 移除补偿);断言非 embedded(page)分支 `Card.Footer` 行为不变(回归保护)
- [ ] T012 跑 `pnpm test:unit src/tests/unit/drawer-viewport-clamp.test.ts src/tests/unit/transaction-drawer.test.tsx` 确认 T009–T011 **红**

### Implementation for User Story 1

- [ ] T013 [US1] (若 T009 需要)在 `src/lib/hooks/use-visual-viewport.ts` 新增并导出纯函数 `computeDrawerMaxHeight(vvHeight, fallback)`(或直接在 Drawer 内联,视简洁度择一;YAGNI 倾向内联则跳过此任务并改 T009 为不依赖新函数)
- [ ] T014 [US1] 改 `src/components/transaction/transaction-form.tsx` embedded 分支:把 `submitButton` 从根 div JSX 中移除;移除根 div 的 `paddingBottom: max(env(safe-area-inset-bottom), ${computeFooterPaddingBottom(keyboardHeight)}px)` inline style 与 `transition-[padding-bottom]` className(R4);保留 `embeddedScrollRef`(由 T015 的容器接管)。同步把 `submitButton` 通过 props 暴露给 `TransactionDrawer`(render prop 或 children 分离,见 contracts/keyboard-strategy.md C3)
- [ ] T015 [US1] 改 `src/components/transaction/transaction-drawer.tsx`:在 `Drawer.Body` 之后新增 `<Drawer.Footer>{form.submitButton}</Drawer.Footer>`(承载 T014 暴露的 submit);给 `Drawer.Content`(或 `Drawer.Dialog`,实测 HeroUI slot 择优)加 inline style `maxHeight: vv.height` + className `transition-[max-height] duration-200 ease-out`(R2);用 `useVisualViewport()` 读 `height`;embedded scroll container ref 接 Phase 2 改造后的 `useScrollIntoViewOnFocus`,指向 `Drawer.Body`
- [ ] T016 [US1] 确认 `useVisualViewport` 的 `keyboardHeight`/`isKeyboardOpen` 不再被 embedded 分支消费(已由 maxHeight 钳制取代);若 `computeFooterPaddingBottom` 成为 dead code,删除 `src/components/transaction/compute-footer-padding-bottom.ts` 及其在 `transaction-form.tsx` 的 import(YAGNI,清理补偿机制残留)
- [ ] T017 [US1] 跑 `pnpm test:unit src/tests/unit/drawer-viewport-clamp.test.ts src/tests/unit/transaction-drawer.test.tsx` 确认 T009–T011 **转绿**
- [ ] T018 [US1] 真机走查(NEEDS-MANUAL):iPhone Safari + iPhone PWA standalone + 中端 Android Chrome 三平台,跑 quickstart.md §3.1 全部 6 步,对照 baseline.md before 截图确认 SC-001(无空隙不透出)、SC-002(无抖动)通过;失败项回 T013–T016

**Checkpoint**: US1 完成——Drawer 键盘避让收敛为单一机制,背景不透出、无抖动。

---

## Phase 4: User Story 2 — 类型 Tabs 收紧 + 键盘交互稳定 (Priority: P2)

**Goal**: Tabs 经 `Tabs.List`/`Tabs.Tab` className 收紧密度(首屏多露 ≥1 字段),键盘弹起时 Tabs 行不被滚出;颜色语义与字段联动不变。

**Independent Test**: 中端手机上开 Drawer,依次点支出/收入/转账验证切换+联动;唤起键盘验证 Tabs 行始终可见;对照修复前后首屏确认多露一字段(spec US2 acceptance 1–4)。

### Tests for User Story 2(test-first)

- [ ] T019 [P] [US2] 写组件测试 `src/tests/unit/transaction-form-tabs.test.tsx`(jsdom):render embedded 表单,断言 `Tabs.List` 含收紧密度的 className(如 `*:h-8` 或更紧,视 T021 实测择优值);断言三个 `Tabs.Tab` 的颜色 className(支出/收入/转账的 `selectedTextCls`/`indicatorCls`)未被本 feature 改动(回归保护)
- [ ] T020 [P] [US2] 写组件测试(同文件):切换 Tabs(支出→转账)后断言字段联动正确(转账显示转入账户、隐藏分类),与修复前行为一致(回归保护)
- [ ] T021 跑 `pnpm test:unit src/tests/unit/transaction-form-tabs.test.tsx` 确认 T019–T020 **红**(密度 className 尚未加)

### Implementation for User Story 2

- [ ] T022 [US2] 改 `src/components/transaction/transaction-form.tsx` 的 `<Tabs.List>`:加收紧密度 className(从 `*:h-8 *:px-3 *:text-sm` 起,真机实测若首屏仍不够多露一字段则收紧到 `*:h-7 *:px-2.5 *:text-xs`,记录择优值到 research.md R5);**不**改 `Tabs.Tab` 的颜色 `selectedTextCls` 与 `Tabs.Indicator` 的 `indicatorCls`(支出红/收入绿/转账蓝,docs/THEME.md 真相源)
- [ ] T023 [US2] 真机验证键盘弹起时 Tabs 行是否仍留在 Drawer 可视区:若被 `Drawer.Body` 滚出,则把 Tabs 从 `TransactionForm` 的 `formFields` 提到 `Drawer.Body` 之外的 sticky 区(`Drawer.Header` 下方或 Body 上方固定行),保证键盘弹起时 Tabs 始终可见(spec FR-008);若实测未滚出则保持原位并在 research.md R5 记一条"无需提取"的结论
- [ ] T024 [US2] 跑 `pnpm test:unit src/tests/unit/transaction-form-tabs.test.tsx` 确认 T019–T020 **转绿**
- [ ] T025 [US2] 真机走查(NEEDS-MANUAL):中端手机跑 quickstart.md §3.2 全部 3 步,对照 baseline.md before 首屏截图确认 SC-003(多露 ≥1 字段)通过

**Checkpoint**: US2 完成——Tabs 收紧、键盘可见、颜色/联动回归 0 缺陷。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 桌面端回归、HeroUI v3 对齐核对、文档与 baseline after 区块收尾。

- [ ] T026 [P] 桌面端回归(spec SC-004):桌面浏览器开"记一笔"Drawer 完整走输入/保存,确认与修复前无差异、无新增缺陷;确认 `useVisualViewport` 桌面端 `keyboardHeight=0`、maxHeight 钳制等价 identity、scroll hook 不破坏 Tab 键焦点导航
- [ ] T027 [P] 全量跑 `pnpm test:unit`(unit + ui 两 project)确认无既有测试被本 feature 改动打破
- [ ] T028 [P] 全量跑 `pnpm build` 确认无类型/构建错误(TS strict)
- [ ] T029 [P] HeroUI v3 对齐核对(spec SC-005):逐项核对 research.md R6 差异清单(submit 在 Footer / Content 高度钳制 / Tabs 密度 className / 无全局 scrollIntoView / 无 shadcn legacy token / 无 v2 flat API),每项打勾或补 research.md 理由;确认无静默偏离
- [ ] T030 把 quickstart.md §3 + §4 + §5 走查结果回填到 `baseline.md` 的 after 区块(对照 before 截图 + CLS 数字 + 10 秒体感,沿用 029 baseline.md 模式)
- [ ] T031 CLS 机械测量(spec SC-002 / 沿用 029 SC-003):DevTools Lighthouse 跑 `/dashboard` 与 `/transaction/new`,记录 after CLS,确认 ≤ 0.05,回填 baseline.md after 区块
- [ ] T032 [P] 若 `src/components/transaction/compute-footer-padding-bottom.ts` 在 T016 已删,确认无其它引用残留(`grep -rn computeFooterPaddingBottom src/` 为空);若 page 分支仍用 Card.Footer paddingBottom 则保留并注明

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,立即开始。T002/T003 可与 T001 并行。
- **Foundational (Phase 2)**: 依赖 Phase 1。**阻塞** US1/US2(scroll hook 是根因消除核心)。
- **US1 (Phase 3)**: 依赖 Phase 2。MVP 主体。
- **US2 (Phase 4)**: 依赖 Phase 2。可与 US1 并行(不同文件:Tabs 在 transaction-form,Drawer 钳制在 transaction-drawer),但建议 US1 先行(US2 的 T023 依赖 Drawer 结构已稳定)。
- **Polish (Phase 5)**: 依赖 US1 + US2 完成。

### Within Each User Story

- Tests(若含)**MUST** 先写并观察红,再实现转绿(宪章原则四)
- 纯函数 → hook/组件 → 真机走查
- 每个 Checkpoint 可独立验证、独立提交

### Parallel Opportunities

- Phase 1: T002 ∥ T003(T001 完成后)
- Phase 2: T004 ∥ T005(同文件不同 describe,可同 PR)
- Phase 3: T009 ∥ T010 ∥ T011(不同测试文件,可并行写)
- Phase 4: T019 ∥ T020(同文件不同 describe)
- Phase 5: T026 ∥ T027 ∥ T028 ∥ T029 ∥ T032(不同关注点,可并行)

---

## Parallel Example: User Story 1

```bash
# 并行写三个测试文件(均 [P]):
Task: "T009 drawer-viewport-clamp.test.ts(纯函数)"
Task: "T010 transaction-drawer.test.tsx(Footer + maxHeight)"
Task: "T011 transaction-form.test.tsx(无 paddingBottom 补偿)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup(T001–T003)
2. Phase 2 Foundational(T004–T008)—— scroll hook 改造,**根因消除**
3. Phase 3 US1(T009–T018)—— Drawer 钳制 + Footer submit
4. **STOP and VALIDATE**: 真机跑 quickstart §3.1,对照 baseline before 截图
5. 单独提 PR:`fix(mobile): 031 Drawer 键盘避让收敛(单一机制)`

### Incremental Delivery

1. Setup + Foundational → scroll hook 只滚 Body
2. + US1 → Drawer 无空隙不透出(MVP,解决截图核心症状)→ 提 PR-1
3. + US2 → Tabs 收紧、键盘可见 → 提 PR-2
4. + Polish → 桌面回归 + HeroUI 对齐 + baseline after → 收尾

---

## Notes

- **测试落点约定**: `src/tests/unit/*.test.ts`(unit/node,纯函数)与 `src/tests/unit/*.test.tsx`(ui/jsdom,组件)。**不**用 029 plan 提过的 `src/lib/hooks/__tests__/`(项目实际约定是 `src/tests/unit/`,029 的 hook 测试最终未落地)。
- **真机走查为 NEEDS-MANUAL**:T018 / T023 / T025 / T030 / T031 涉及 GUI/真机,沿用 029 baseline.md 的 NEEDS-MANUAL 分项模式,不阻塞 PR 但 MUST 在合并前完成并回填 baseline after。
- **宪章原则七**: T003 / T022 / T029 显式要求查 `/heroui-react` skill;任何额外 JSX/className/props 改动同此。
- **YAGNI**: T016 清理 `compute-footer-padding-bottom.ts`(补偿机制残留);不引入键盘感知库、不为 P2/P3 入口扩范围(spec Q1 限定)。
