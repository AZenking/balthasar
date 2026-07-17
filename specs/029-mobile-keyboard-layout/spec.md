# Feature Specification: 移动端键盘弹起布局稳定性 (Mobile Keyboard-Safe Layout)

**Feature Branch**: `029-mobile-keyboard-layout`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "UI 操作合理性;目前有个问题是:记录一笔在 mobile app 上面;键盘弹出会顶开"

## Clarifications

### Session 2026-07-17

- Q: 本次"键盘顶开"问题覆盖哪些入口? → A: 覆盖所有移动端用户可见的输入型表单,但优先级分层 —— **P1 是"记一笔"主入口(底部 Drawer 内的交易表单)**,因为宪章原则五硬性要求"手机上 10 秒内完成一笔账",任何键盘交互障碍都直接侵蚀这条预算;**P2 是全屏交易表单页(新建/编辑)**;**P3 是账户/分类/设置/onboarding 等次要表单**(横扫,不阻塞合并)。
- Q: "键盘顶开"具体表现是什么? → A: 三类症状:(1) 虚拟键盘弹起时,正在输入的字段被键盘遮挡,用户看不到自己输入的内容;(2) 表单顶部标题/返回按钮被推出可视区域,用户失去上下文;(3) 键盘弹起/收起瞬间触发非预期布局抖动或闪烁(CLS),破坏视觉一致性。
- Q: 修复目标行为是什么? → A: 三项硬目标:(1) 当前聚焦输入字段始终可见(键盘弹起后自动滚入可视区域);(2) 主要操作按钮(保存/提交)始终可被用户触达,无需先收起键盘;(3) 键盘交互过程不产生用户可感知的布局抖动或闪烁。
- Q: 平台范围? → A: 仅 PWA / 移动浏览器(iOS Safari、Android Chrome),不含 native 客户端。中端设备(2-3 年机龄)为主要测试对象。桌面端既有体验必须保持回归 0 缺陷。
- Q: 实现阶段是否受宪章原则七约束? → A: 是。任何 UI / className / 组件 props 改动 MUST 先调用 `/heroui-react` skill 获取 HeroUI v3 关于 Modal/Drawer/Input 在键盘交互下的官方行为文档,禁止凭陈旧记忆编码。
- Q: P3 入口(账户/分类/设置/onboarding)的键盘修复深度? → A: **与 P1/P2 等价全量达标**。FR-001(聚焦字段 300ms 内可见)、FR-002(保存按钮始终可达)、FR-003(CLS=0)对 P3 同样硬性适用,不允许"仅扫除明显反模式"的弱化兜底。理由:产品一致性 — 次要入口若割裂会让用户产生"应用半成品"的感知,违背宪章原则五体感预算。
- Q: 若 HeroUI v3 Drawer/Modal 原生能力在某些 iOS Safari 边缘场景无法满足 SC,应对策略? → A: **在 HeroUI 组件外层加薄薄 workaround**(例如聚焦事件 + scrollIntoView 协调、键盘可见性状态同步),HeroUI 组件本身不替换、不绕过。理由:保宪章原则七完整性(HeroUI 仍是 UI 真相源),同时允许在 HeroUI 之上加一层"行为协调代码"应对 v3 尚未覆盖的边缘场景。**禁止**替换 HeroUI 组件本身、引入新 UI 库、或回退到原生 HTML/CSS 表单元素。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 记一笔 Drawer 内的键盘无障碍 (Priority: P1)

一位用户在手机上打开"记一笔"底部 Drawer 录入一笔支出。金额、备注、
分类选择等字段依次聚焦时,虚拟键盘弹起,但用户始终能看清正在输入
的字段、能随时触达"保存"按钮、能在键盘弹起与收起之间无视觉抖动。
整个录入流程在键盘交互层面零摩擦,符合宪章原则五"10 秒完成一笔账"
的体感预算。

**Why this priority**: 宪章原则五是产品的硬性成功指标,"记一笔"是
该指标最直接的载体。当前键盘弹起会遮挡输入或顶飞标题,直接破坏
"10 秒体感"。这是本次修复的核心战场,P1 优先级。

**Independent Test**: 在中端 Android 手机(Chrome)与 iPhone(Safari)
上,从首页打开"记一笔"Drawer,依次输入金额、切换分类、输入备注,
验证每一步聚焦字段可见、保存按钮可触达、整体无抖动。

**Acceptance Scenarios**:

1. **Given** 用户在中端 Android 手机上打开"记一笔"底部 Drawer,
   **When** 点击金额输入框唤起虚拟键盘,
   **Then** 金额输入框完整可见(不被键盘遮挡),用户能看到自己输入的数字。
2. **Given** 金额已输入,键盘仍弹出,
   **When** 用户切换到备注字段,
   **Then** 备注输入框自动滚入键盘上方的可视区域,无需用户手动滚动。
3. **Given** 用户填完所有字段,键盘仍弹出,
   **When** 用户点击"保存"按钮,
   **Then** 按钮可被直接触达(无需先收起键盘),保存成功。
4. **Given** 表单顶部显示"记一笔"标题与关闭按钮,
   **When** 键盘弹起,
   **Then** 标题与关闭按钮不被推出可视区域(或仍可通过稳定手势访问)。
5. **Given** 键盘弹出状态下,
   **When** 用户收起键盘,
   **Then** 布局平滑回弹,无闪烁、无内容跳变。

---

### User Story 2 - 全屏交易表单页的键盘无障碍 (Priority: P2)

用户通过 `/transaction/new` 或 `/transaction/[id]/edit` 进入全屏
表单页录入或编辑交易。键盘弹起时,页面顶部标题不被顶出可视区域、
聚焦输入字段可见、底部保存按钮始终可触达。键盘交互体验与
Drawer 入口保持一致。

**Why this priority**: 全屏表单是 Drawer 之外的次要录入入口(桌面端、
深链场景)。键盘行为应与 Drawer 入口一致,避免用户在两个入口间
体验到割裂的交互。P2 是因为主入口已是 Drawer,全屏页流量占比低。

**Independent Test**: 在中端手机上从浏览器直接打开 `/transaction/new`
深链,完整走一遍输入流程,验证键盘交互与 US1 等价。

**Acceptance Scenarios**:

1. **Given** 用户在 `/transaction/new` 全屏页,
   **When** 点击任一输入字段唤起键盘,
   **Then** 顶部标题与返回按钮保持可见,聚焦字段不被遮挡。
2. **Given** 键盘弹出,
   **When** 用户在字段间切换,
   **Then** 每次切换后聚焦字段自动进入键盘上方的可视区域。
3. **Given** 键盘弹出,
   **When** 用户点击底部"保存",
   **Then** 按钮可被直接触达,保存成功。

---

### User Story 3 - 其它表单入口的键盘一致性 (Priority: P3)

用户在账户新增、分类管理、设置、onboarding 等表单中输入时,
键盘行为与交易表单完全等价 —— 聚焦字段 300ms 内可见、保存按钮始终
可达、CLS=0、跨浏览器一致。**P3 与 P1/P2 同等达标**,**不允许弱化
兜底**(2026-07-17 clarification)。

**Why this priority**: 这些入口流量低,但产品一致性要求所有用户可见
输入场景体验等价;次要入口割裂会让用户产生"应用半成品"的感知,
侵蚀宪章原则五的体感预算。P3 优先级低是因流量小,但**达标标准与
P1/P2 一致**。

**Independent Test**: 在账户/分类/设置/onboarding 各跑一次主要输入
流程,验证 FR-001/002/003 与 SC-001/002/003 全部适用。

**Acceptance Scenarios**:

1. **Given** 用户在账户新增表单(账户名、初始余额等字段),
   **When** 点击任一输入字段唤起键盘,
   **Then** 聚焦字段 300ms 内自动滚入键盘上方可视区域(FR-001)。
2. **Given** 用户在分类管理输入新分类名,
   **When** 键盘弹起,
   **Then** "保存"按钮可直接触达,无需先收键盘(FR-002)。
3. **Given** 用户在 onboarding 流程的任一步输入,
   **When** 键盘弹起与收起,
   **Then** 布局无用户可感知抖动(CLS ≤ 0.05,FR-003)。

---

### Edge Cases

- 当用户在 iOS Safari 上使用外接物理键盘时,虚拟键盘不弹出,布局应保持稳态,不应因键盘状态误判触发非预期滚动。
- 当用户切换输入法(如中文输入法的候选词条)导致键盘高度动态变化时,布局应平滑跟随,不抖动。
- 当用户在键盘弹起时旋转设备(横竖屏切换),布局应正确重排,聚焦字段保持可见。
- 当用户使用浏览器原生日期/选择器组件(取代文本输入)时,不应触发本规范描述的键盘弹起场景,但视觉应保持一致。
- 当用户从 Drawer 内打开二级 Modal(如分类选择弹窗),键盘已弹起时,二级 Modal 内的输入应同样满足可见性要求。
- 当 HeroUI v3 Drawer/Modal 在特定 iOS Safari 版本上存在已知键盘 bug(如聚焦字段未自动滚入),系统应通过外层 workaround 兜底而非替换组件(见 FR-007 clarification)。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 保证移动端虚拟键盘弹出时,当前聚焦的输入字段完整可见(不被键盘遮挡),并在 300ms 内自动滚入可视区域。
- **FR-002**: 系统 MUST 保证主要表单的"保存"/"提交"按钮在键盘弹出状态下始终可被用户直接触达,无需先收起键盘。
- **FR-003**: 系统 MUST 保证键盘弹出与收起过程不产生用户可感知的布局抖动、闪烁或非预期滚动跳变(视觉等价契约:CLS = 0)。
- **FR-004**: 系统 MUST 保证表单顶部关键元素(标题、返回/关闭按钮)在键盘弹出时仍可见或可通过稳定手势访问,不被推出可视区域。
- **FR-005**: 键盘交互行为 MUST 在主流移动浏览器(iOS Safari、Android Chrome)上表现一致,差异不可被用户感知。
- **FR-006**: 系统 MUST NOT 改变桌面端既有的表单与键盘交互体验(回归 0 缺陷)。
- **FR-007**: 系统 MUST 保持视觉一致性(宪章原则七):修复方案不引入新 UI 库、不替换 HeroUI v3 组件本身、token 命名遵循 HeroUI 原生约定。**允许**在 HeroUI 组件外层加薄薄行为协调代码(如聚焦事件监听 + scrollIntoView、键盘可见性状态同步)以应对 HeroUI v3 尚未覆盖的边缘场景(2026-07-17 clarification)。
- **FR-008**: 系统 MUST 保证 PWA 安装模式与浏览器模式下键盘行为一致(用户从主屏图标打开 vs 浏览器地址栏下方打开,体验不应割裂)。
- **FR-009**: 修复 MUST 覆盖"记一笔"底部 Drawer 内的所有输入字段(金额、备注、分类选择、账户选择、日期选择等交互组件)。
- **FR-010**: 系统 MUST 在键盘弹起时正确处理 Drawer/Modal 内嵌场景(分类选择二级 Modal、账户选择器等),聚焦字段在嵌套层级中仍可见。

### Key Entities

本 feature 不涉及新的领域实体。涉及现有 UI 状态:

- **键盘可见性状态**: 虚拟键盘当前是否弹出(影响表单布局策略)。
- **聚焦字段上下文**: 当前用户正在输入的字段(影响自动滚动目标)。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在中端 Android(Chrome)与 iPhone(Safari)上,"记一笔" Drawer 内依次聚焦金额→分类→备注→保存,100% 的聚焦事件后 300ms 内目标字段完整可见(机测 + 人工抽样)。
- **SC-002**: 100% 的主要表单入口("记一笔" Drawer、`/transaction/new`、`/transaction/[id]/edit`)在键盘弹出状态下,保存/提交按钮可直接触达(无需先收键盘)。
- **SC-003**: 在键盘弹出与收起的完整生命周期内,布局抖动累计 CLS ≤ 0.05(用户不可感知级别,Lighthouse Mobile 测量)。
- **SC-004**: 真机测试通过率 —— 在 iOS Safari 与 Android Chrome 各 1 台中端设备(2-3 年机龄)上,完整跑通"打开应用 → 进入记一笔 → 输入完整一笔 → 保存"流程,无键盘相关障碍。
- **SC-005**: 桌面端既有表单交互的回归测试 0 缺陷(类型测试 + 人工抽测)。
- **SC-006**: 宪章原则五体感预算保护 —— "打开应用 → 完成一笔"端到端流程在中端移动设备上的中位耗时较修复前不增加(允许等价或减少)。
- **SC-007**: P3 入口(账户/分类/设置/onboarding)真机抽测 —— 每个入口至少 1 个核心输入场景在中端移动设备上通过 FR-001/002/003 验收(2026-07-17 clarification:P3 与 P1/P2 等价达标)。

## Assumptions

- **现有主入口**: "记一笔"当前为底部 HeroUI Drawer(`TransactionDrawer` placement="bottom"),内嵌 `<TransactionForm embedded />`。次要入口为 `/transaction/new` 全屏页与 `/transaction/[id]/edit` 编辑页。
- **目标平台**: 仅 PWA / 移动浏览器(iOS Safari 16+、Android Chrome 最新两个大版本),不含 native 客户端。中端设备(2-3 年机龄)为主要测试对象。
- **UI 真相源**: HeroUI v3(`@heroui/react` + `@heroui/styles`)是 UI 组件唯一真相源(宪章 v3.2.1 锁定)。任何修复方案不引入新 UI 库、不重建适配层。
- **实施纪律**: 实现阶段(进入 `/speckit-plan` 后)任何 UI / className / 组件 props 改动 MUST 先调用 `/heroui-react` skill 获取 HeroUI v3 关于 Modal/Drawer/Input/Keyboard 的官方行为文档(宪章原则七硬约束)。
- **测试对象**: 中端 Android(如 Redmi Note 12 / Samsung Galaxy A 系列)与 iPhone(如 iPhone 12 / 13)。
- **回归范围**: 桌面端既有键盘交互(物理键盘、Tab 导航、表单 autocomplete)在修复后必须保持原状。
- **不引入 RUM**: 不接入线上真实用户监控(RUM);验证以真机 + Lighthouse + 人工抽样为准(对齐 025-perf-code-optimization 既定方法)。
- **后续 PWA initiative 协同**: 仓库另有 `029-pwa-reliable-shell`(PWA 离线 shell)正在并行进行;本 feature 不与 PWA 离线能力耦合,但 FR-008 保证 PWA 安装模式与浏览器模式体验一致。
