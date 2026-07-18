# Feature Specification: 记一笔 Drawer 键盘避让收敛 + 类型 Tabs 优化

**Feature Branch**: `031-drawer-keyboard-and-tabs`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description:
> 截图中的问题本质是：键盘弹出后，整个记账 Drawer 被向上滚动了，导致
> Drawer 底部与键盘之间出现空隙，下面的"设置"页面透了出来。
> 最可能的直接原因是 `use-scroll-into-view-on-focus.ts` 在输入框聚焦
> 300ms 后调用 `scrollIntoView({ block: "center" })`，在 iOS Safari/PWA
> 中它可能滚动整个页面 / Visual Viewport，而不只是 Drawer.Body，于是
> 固定定位的 Drawer 也被带着向上移动；同时 `transaction-form.tsx` 又
> 根据键盘高度给表单增加底部空间，两套机制叠加后加剧跳动和大面积留白。
> 同时记账；上部分 tabs 优化下；为什么和原来的 heroui-react 不太一样。

## Clarifications

### Session 2026-07-18

- **Q1 — 本次修复的范围是否仅限"记一笔"底部 Drawer？**
  → A: 本次以 **"记一笔"底部 Drawer 内的交易表单**为唯一必达入口
  （P1）。它是 029 spec 的 P1 主战场，也是宪章原则五"手机上 10 秒内完成
  一笔账"最直接的载体，但 029 已合并后仍残留"背景透出 + Drawer 上移"
  症状，说明既有双重键盘补偿机制在本入口失效。全屏交易表单页
  （P2）与账户/分类/设置/onboarding 次要表单（P3）本次**不在范围**，
  它们的键盘行为若同样回归，按 029 spec 的既有 FR 兜底，不在本 feature
  新增工作。

- **Q2 — "上部分 tabs 优化下"具体指什么？**
  → A: 指交易表单顶部的**交易类型切换** Tabs（支出 / 收入 / 转账，
  `transaction-form.tsx` 中 `<Tabs><Tabs.List>…`）。优化目标三选一由
  实现阶段按 `/heroui-react` skill 文档择优：(a) 视觉密度收紧——减少
  Tabs 高度与留白，让首屏能多露出一个表单字段；(b) 可达性——确保键盘
  弹起时 Tabs 仍稳定可见、不被推出可视区域（与 P1 闭环）；(c) 与
  HeroUI v3 官方 Tabs 推荐用法对齐（见 Q3）。**不**改变三类的语义、
  颜色映射（支出红 / 收入绿 / 转账蓝）与切换后的表单字段联动。

- **Q3 — "为什么和原来的 heroui-react 不太一样"？**
  → A: 这是一个**说明性诉求**而非功能变更。用户感知当前 Tabs（或
  Drawer）的呈现与 `/heroui-react` skill 记录的 HeroUI v3 官方推荐形态
  有差异。实现阶段 MUST 先调用 `/heroui-react` skill 取得 Tabs v3 与
  Drawer v3 在键盘交互下的官方文档，逐一对照当前实现，把"不一致"项
  明确列出（是真问题、还是有意的项目定制）并在 research.md 落档。
  禁止凭陈旧记忆编码（宪章原则七）。若发现当前实现是 v2 残留或绕过
  HeroUI 的写法，回归官方用法；若是合理定制，则在文档说明理由。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 记一笔 Drawer 键盘弹起不再透出背景页 (Priority: P1)

一位用户在手机上打开"记一笔"底部 Drawer 录入一笔支出。点击金额输入框，
虚拟键盘弹起。与修复前不同，用户现在看到的是：Drawer 本体稳稳贴在
键盘正上方、与键盘之间没有空隙，Drawer 下方的"设置"或其它背景页面
**完全不透出**；Drawer 顶部"记一笔"标题与关闭按钮始终可见；正在输入
的字段完整出现在可视区域内；底部"保存"按钮始终可触达。键盘收起后，
Drawer 平滑回弹，无闪烁、无跳变。整个录入流程在键盘层面零摩擦，守住
宪章原则五"10 秒完成一笔账"的体感预算。

**Why this priority**: 这是 029 spec P1 的回归——已合并的 029 用"全局
`scrollIntoView` + 表单底部追加 keyboardHeight padding"两套机制补偿
键盘，在 iOS Safari/PWA 上两套机制叠加反而把固定定位的 Drawer 整体
向上推、露出背景页。这是用户当前最直接、最影响"10 秒体感"的缺陷，
必须作为本 feature 唯一必达入口优先解决。

**Independent Test**: 在 iPhone（Safari）与中端 Android（Chrome）上，
从首页打开"记一笔"Drawer，点击金额输入框唤起键盘，对照修复前后的
截图，验证 (1) Drawer 与键盘之间无空隙、(2) Drawer 下方背景页完全不
可见、(3) 标题与保存按钮全程可见可达、(4) 键盘收起无抖动。

**Acceptance Scenarios**:

1. **Given** 用户在手机上打开"记一笔"底部 Drawer，
   **When** 点击金额输入框唤起虚拟键盘，
   **Then** Drawer 本体紧贴键盘上方，Drawer 底部边缘与键盘顶部之间**无可见空隙**，Drawer 下方原本的页面（如设置）**完全不透出**。
2. **Given** 键盘已弹出，金额输入框聚焦，
   **When** 用户点击备注（或其它）输入框切换焦点，
   **Then** 新聚焦的字段自动滚入 Drawer.Body 可视区域，且滚动只发生在 Drawer.Body **内部**，Drawer 本体与背景页位置不动。
3. **Given** 键盘弹出，用户已填完字段，
   **When** 用户点击"保存"按钮，
   **Then** 按钮可被直接触达（无需先收键盘），保存成功后 Drawer 正常关闭。
4. **Given** 表单顶部"记一笔"标题与关闭按钮，
   **When** 键盘弹起与收起，
   **Then** 标题与关闭按钮始终停留在 Drawer 可视区域内，不被推出、不被遮挡。
5. **Given** 键盘处于弹出状态，
   **When** 用户逐格收起键盘，
   **Then** Drawer 平滑回弹到展开位置，过程中无内容闪烁、无布局跳变（CLS 不可感知）。
6. **Given** 手机处于深色模式或浅色模式，
   **When** 重走 acceptance scenario 1–5，
   **Then** 所有"无空隙 / 不透出 / 无抖动"结论在两种主题下均成立（回归主题无关性）。

---

### User Story 2 - 类型 Tabs 在键盘交互下稳定且视觉更紧凑 (Priority: P2)

用户打开"记一笔"Drawer，看到顶部的"支出 / 收入 / 转账"三个类型 Tabs。
用户切换类型时，Tabs 选中态平滑变化、下方表单字段按类型联动；键盘弹起
时 Tabs 行不被推出可视区域；整体视觉比修复前更紧凑，首屏能在键盘未弹起
时多露出至少一个表单字段。Tabs 的呈现与 `/heroui-react` skill 记录的
HeroUI v3 官方推荐形态一致（或在文档中明确说明合理偏离的理由）。

**Why this priority**: Tabs 是交易表单的第一眼控件，其视觉密度直接挤占
首屏预算；其键盘交互稳定性又与 US1 同属一个闭环。但它不是 US1 的前置
阻塞项，作为 P2 在 US1 之后独立交付，单独可测、单独可演示。

**Independent Test**: 在中端手机上打开 Drawer，依次点击支出/收入/转账，
验证切换平滑、字段联动正确；再唤起键盘，验证 Tabs 行始终可见；对照
HeroUI v3 官方 Tabs 文档，列出当前实现与官方推荐的差异清单。

**Acceptance Scenarios**:

1. **Given** 用户打开"记一笔"Drawer，
   **When** 依次点击"支出""收入""转账"，
   **Then** 选中态平滑切换，颜色映射保持（支出红 / 收入绿 / 转账蓝），且每次切换后下方表单字段按类型正确联动（转账显示转入账户、隐藏分类等）。
2. **Given** 键盘已弹出，焦点在金额或备注输入框，
   **When** 用户滚动表单或切换焦点，
   **Then** 顶部 Tabs 行始终留在 Drawer 可视区域内，不被推出、不被键盘遮挡。
3. **Given** 修复前的 Tabs 视觉密度，
   **When** 对比修复后首屏，
   **Then** 在键盘未弹起时，Drawer 首屏（Drawer 可见高度内）至少比修复前多露出一个表单字段（或等价的可量化留白减少）。
4. **Given** `/heroui-react` skill 取得的 HeroUI v3 Tabs 官方用法，
   **When** 逐一对照当前实现，
   **Then** 当前实现与官方用法一致；若有偏离，每一项偏离都在 research.md 有明确记录与理由（不得静默偏离）。

---

### Edge Cases

- **桌面端回归**：桌面端无虚拟键盘、无 visualViewport 变化，本 feature 的
  所有键盘补偿逻辑 MUST 在桌面端优雅降级为 identity（不改变桌面端既有
  交易表单体验），回归 0 缺陷。
- **iOS Safari 与 PWA standalone 差异**：同一 iPhone 在 Safari 标签页与
  "添加到主屏幕"的 standalone PWA 下，visualViewport 行为可能不同
  （standalone 下无 Safari 工具栏）。两种模式 MUST 都满足 US1 的
  "无空隙 / 不透出 / 无抖动"。
- **Android Chrome**：Android 键盘的 resize 行为（resize vs visualViewport）
  与 iOS 不同，MUST 验证 US1 在中端 Android 上同样成立。
- **快速反复聚焦/失焦**：用户在金额与备注之间快速来回点击，可能导致
  多个 pending 的 scroll/补偿任务排队。系统 MUST 做去抖/取消，不产生
  抖动累加或跳变。
- **Drawer 内长表单滚动到极顶/极底**：聚焦最顶部或最底部字段时，
  scrollIntoView 不应把内容推出 Drawer.Body 的可滚动边界，也不应带动
  Drawer 本体或背景页。
- **横屏**：手机横屏下键盘占屏比更高，Drawer 可见高度更小，US1 的
  可见性与可达性结论仍 MUST 成立（或若不成立，作为已知限制在
  research.md 显式记录，不在本 feature 范围解决）。
- **键盘弹出时切换 Tabs**：焦点在某输入框、键盘已弹出，用户点 Tabs
  切换交易类型，切换不应导致 Drawer 本体位移或背景透出。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 只保留**一套**键盘避让机制来决定"记一笔"
  Drawer 的可见高度与位置，**禁止**同时存在 (a) 全局 `scrollIntoView`
  驱动 Drawer 位移 与 (b) 表单底部追加 keyboardHeight padding 两套
  互相叠加的补偿。即：两套机制中**最多保留一套**，另一套移除或改造
  为不与 Drawer 位移耦合。
- **FR-002**: 输入框聚焦时的滚动行为 MUST 只作用于 **Drawer.Body 内部**
  （调整 Drawer.Body 自身的 `scrollTop`），**禁止**调用会滚动整个页面
  或 Visual Viewport 的全局 `scrollIntoView`，从而避免固定定位的
  Drawer 被带着上移。
- **FR-003**: 当虚拟键盘弹出时，Drawer 本体 MUST 紧贴键盘上方，Drawer
  底部边缘与键盘顶部之间**不可出现可见空隙**；Drawer 下方的背景页面
  （设置页等）MUST **完全不可见**。
- **FR-004**: Drawer 顶部"记一笔"标题与关闭按钮，在键盘弹出与收起的
  全过程中 MUST 始终留在 Drawer 可视区域内。
- **FR-005**: "保存"按钮 MUST 在键盘弹出状态下始终可被用户直接触达，
  无需先收起键盘；推荐通过 Drawer 内部的 sticky footer 实现，而非在
  按钮后方塞入等于 keyboardHeight 的 padding。
- **FR-006**: Drawer 打开期间，背景页面 MUST 被锁定滚动（body scroll
  lock），避免 iOS 为聚焦输入框自动滚动背景页。
- **FR-007**: 系统必须**去抖/取消** pending 的滚动或补偿任务，避免用户
  快速反复聚焦/失焦时出现抖动累加或跳变。
- **FR-008**: 顶部类型 Tabs（支出 / 收入 / 转账）在键盘弹出与收起的全
  过程中 MUST 始终留在 Drawer 可视区域内，不被推出或遮挡。
- **FR-009**: 类型 Tabs 的视觉密度 MUST 比修复前更紧凑，使键盘未弹起
  时 Drawer 首屏至少多露出一个表单字段（或等价的、可量化的留白减少）。
- **FR-010**: 类型 Tabs MUST 与 `/heroui-react` skill 记录的 HeroUI v3
  官方 Tabs 推荐用法对照；任何偏离 MUST 在 research.md 逐项记录理由，
  禁止静默偏离。同样，Drawer 的键盘避让实现 MUST 对照 HeroUI v3
  Drawer/Modal 官方文档。
- **FR-011**: 所有键盘补偿逻辑在桌面端（无 visualViewport 变化）MUST
  优雅降级为 identity，不改变桌面端既有交易表单体验。
- **FR-012**: 修复 MUST 在 iOS Safari（含 PWA standalone）、Android
  Chrome 两种移动环境下均满足 FR-001 ~ FR-008。

### Key Entities

本 feature 无新增数据实体。涉及的行为实体（非持久化）：

- **Drawer 键盘避让策略**：决定 Drawer 在键盘弹出时如何呈现的唯一规则
  集合（可见高度、位置、内部滚动、footer 粘性）。本 feature 的核心是
  把它从"两套叠加机制"收敛为"一套唯一机制"。
- **类型 Tabs**：交易表单顶部的支出/收入/转账切换控件，承载类型语义、
  颜色映射、字段联动。本 feature 不改其语义，只优化视觉密度与键盘交互
  稳定性，并对齐 HeroUI v3 官方用法。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在 iPhone（Safari + PWA standalone）与中端 Android
  （Chrome）上，"记一笔"Drawer 键盘弹出后，用户**目测** Drawer 底部与
  键盘之间无可见空隙、背景页完全不透出——以修复前后同设备同操作截图
  对照确认（定性验收，二值：通过/不通过）。
- **SC-002**: 键盘弹出与收起的完整过程中，"记一笔"交互的累积布局偏移
  （CLS）**不可被用户感知**（对齐 029 spec SC-003：CLS ≤ 0.05 的机械
  化测量阈值继续沿用，本 feature 在此基础上要求真机目测无抖动）。
- **SC-003**: 在中端手机上，键盘未弹起时，Drawer 首屏可见的表单字段
  数量比修复前**至少多 1 个**（或等价的可量化留白减少，以截图对照）。
- **SC-004**: 桌面端交易表单的回归测试**通过率 100%**——本 feature
  的任何改动在桌面端无可见行为变化、无新增缺陷。
- **SC-005**: HeroUI v3 官方 Tabs/Drawer 文档与当前实现的差异清单
  **100% 落档**（research.md），每一项偏离都有明确理由或已回归官方
  用法，无静默偏离。
- **SC-006**: 用户从打开 Drawer 到完成一笔录入（含键盘交互）的体感
  流程，在真机走查下**守住宪章原则五"10 秒完成一笔账"**的预算
  （沿用 029 spec 既有体感目标，不退步）。

## Assumptions

- **沿用 029 的环境基线**：目标平台仍为 PWA / 移动浏览器（iOS Safari、
  Android Chrome），不含 native 客户端；测试对象为中端设备（2–3 年
  机龄）。本 feature 不扩展平台范围。
- **沿用 029 的合规边界**：任何 UI / className / 组件 props 改动 MUST
  先调用 `/heroui-react` skill 取得 HeroUI v3 官方文档，禁止凭陈旧记忆
  编码（宪章原则七）。允许在 HeroUI 组件**外层**加薄薄 workaround，但
  **禁止**替换 HeroUI 组件本身、引入新 UI 库、或回退到原生 HTML/CSS
  表单元素。
- **沿用 029 的 hooks 资产**：`useVisualViewport` 与
  `useScrollIntoViewOnFocus` 已存在于 `src/lib/hooks/`，本 feature
  复用/改造它们而非另起炉灶；若 `useScrollIntoViewOnFocus` 的全局
  `scrollIntoView` 行为被确认为主因，本 feature 将其改造为"只调
  Drawer.Body 自身 scrollTop"或移除，由实现阶段据 HeroUI 文档择优。
- **不扩展到 P2/P3 入口**：全屏交易表单页、账户/分类/设置/onboarding
  等次要表单本次不在范围；若它们的键盘行为同样回归，按 029 spec 既有
  FR 兜底，不新增工作。
- **Tabs 颜色映射与字段联动不变**：支出红 / 收入绿 / 转账蓝的语义着色、
  以及切换类型后的表单字段联动（转账显示转入账户、隐藏分类等）为既有
  产品行为，本 feature 不改其语义，仅优化视觉密度与键盘交互稳定性。
- **依赖既有 useVisualViewport**：键盘高度的感知继续依赖
  `useVisualViewport`（`keyboardHeight = max(0, innerHeight - vv.height)`，
  `isKeyboardOpen = keyboardHeight > 150`），本 feature 不改其阈值定义。
