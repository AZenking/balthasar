# Feature 规约: 历史页面 shadcn 迁移 (008/009/010)

**Feature 分支**: `feat/025-legacy-shadcn-migration`

**创建日期**: 2026-07-12

**状态**: Draft

**依赖**: `024-ui-consistency` (US1 沉淀 shadcn 原语 + US2 验证迁移路径)。本 feature **必须** 在 024 合并后启动;若 024 未落地,本 feature 阻塞。

**输入**: 用户在 024-ui-consistency spec 的 Out of Scope 第 3 条明确："为 007-onboarding-ui / 008-transaction-ui / 009-transactions-list-ui / 010-settings-ui 历史页面补 shadcn 原语(只迁移 023;历史页面若用手写元素工作良好,不在本 feature 改动范围 —— 后续按需在各自迭代中迁移)"。本 feature 就是这个"后续迭代"。

## 概述

本 feature 是 **024-ui-consistency 的纵向延伸**:把 024 沉淀的 shadcn 原语应用到剩余的历史页面上,让全工程的交互元素 100% 跑在 shadcn/Radix 上,彻底消除"裸 HTML 元素 + 自造浮层"的技术债。

**调查结论(已 grep 验证)**:

| Feature | 涉及文件 | 手写元素 | 迁移目标 |
|---|---|---|---|
| 008-transaction-ui | `src/components/transaction/transaction-form.tsx`(278 行) | 2 处裸 `<select>`(accountId / categoryId) | shadcn `Select` |
| 009-transactions-list-ui | `src/components/transactions/transaction-filters.tsx`(105 行) | 2 处裸 `<select>`(accountId / categoryId) | shadcn `Select` |
| 009-transactions-list-ui | `src/app/(app)/transactions/page.tsx`(171 行) | 1 处 `window.confirm("确认删除?")` | shadcn `AlertDialog` |
| 010-settings-ui | `src/components/settings/account-form.tsx`(112 行) | 1 处裸 `<select>`(currency) | shadcn `Select` |
| 010-settings-ui | `src/app/(app)/settings/page.tsx`(200 行) | 1 处 `window.confirm("确认归档?")` + 反归档静默 | **取消 confirm + 加 toast**(与 023 对齐,clarify Q2) |
| **007-onboarding-ui** | `(auth)/login` + `(auth)/register` | **无**(已用 Card / Input / Label / Button + RHF,符合 shadcn 风格) | **不在本 feature scope** |

合计:**5 处 `<select>` + 1 处 `window.confirm(删除)` + 1 处 `window.confirm(归档→取消改 toast)` = 7 处迁移点**,跨 5 个文件。

**为什么 024 不一起做**:024 已锁定"行为零回归 + scope 收紧"原则,把历史页面拉进来会爆炸 blast radius(007+008+009+010 四个 feature 的 quickstart 都要重跑)。历史页面 quickstart 各自独立,适合作为本 feature 的验收依据。

**为什么现在做**(而非"按需迭代"):宪章 v2.0.0 第二章 "UI 组件 | shadcn/ui | Radix + Tailwind" 是不可妥协的技术栈;024 让它"在 `ui/` 目录成立",本 feature 让它"在所有页面成立"。两项闭环后,宪章技术栈声明 100% 落地,新加入的开发者不会因"看到历史页面用裸 select"而模仿。

## Clarifications

### Session 2026-07-12

- Q: 007-onboarding-ui 是否真的不需要迁移? → A: **是** —— login/register 页面已使用 shadcn `Card` / `Input` / `Label` / `Button` + react-hook-form,符合 shadcn 风格,无裸 `<select>` / `<input type="radio/checkbox">` / `window.confirm`。本 feature 在 spec 阶段 grep 验证后,007 不在 scope。若 plan 阶段发现遗漏(如服务端渲染时的 hydration 警告、a11y 问题),记入 plan 的 Complexity Tracking,但**不**因此扩大 spec scope。
- Q: `window.confirm` 替换为 `AlertDialog` 还是 `Dialog`? → A: **`AlertDialog`**(Radix 的 alert-dialog 原语,shadcn 提供)—— `AlertDialog` 的语义是"打断用户工作流、强制选择",匹配删除的"确认/取消"二元决策(归档不再用 confirm,见 clarify Q2)。AlertDialog 沉淀归 024 承担(clarify Q1 决议)。
- Q: 024 的 US2(023 迁移)与本 feature 的关系? → A: **强参考** —— 024 US2 是迁移路径的"参考实现",本 feature 复用 024 US2 的迁移模式(`Select` / `AlertDialog` 的 prop 映射、`className` 覆盖策略、a11y 验证流程)。若 024 US2 在执行中调整了 024 spec 的某些决策(如 `Select` 改为 `Command`),本 feature 自动跟随。
- Q: 历史 quickstart(007/008/009/010)是否需要刷新? → A: **不需要刷新功能验证**,但**需要补一节"shadcn 迁移回归验证"** —— 在每个 feature 的 quickstart.md 末尾追加"迁移后手动验证 checklist"(对照本 feature 的 FR-008..FR-014)。**禁止**重写既有 quickstart(保留历史可追溯)。
- Q: 是否同时给历史页面补 dark mode / a11y / 响应式? → A: **否** —— 本 feature 只做"shadcn 原语替换",dark mode / a11y 全局审计 / 响应式调整都是独立 feature。Radix 自带的 a11y(focus trap / aria / 键盘导航)是迁移的**自然副产出**,不作为本 feature 的强制验收项,但记入 Edge Cases。

### Session 2026-07-12 (clarify)

- Q: AlertDialog 沉淀位置(回写 024 vs 仅放 025)? → A: **回写 024** —— 把 AlertDialog 加入 024 FR-002 清单(8→9 个原语),025 spec 改为"复用 024 沉淀"。理由:024 是"shadcn 沉淀"主 feature,完整原语清单的单一权威;025 是"消费"feature,不应承担沉淀职责。这样后人单看 024 spec 即可拿到完整清单,不会漏掉 AlertDialog。
- Q: 全工程 archive/delete UX 一致性? → A: **按操作可逆性语义化统一** —— `归档(可逆)` = server-first mutation + 即时 toast 反馈(UX 感知等价"optimistic",实现不引入 onMutate,research.md R5),无 confirm;`删除(不可逆)` = AlertDialog confirm。具体影响:(a) 010 账户归档的 `window.confirm` **取消**,改为 server-first + toast(与 023 分类归档对齐);(b) 010 账户反归档**补 toast**(当前完全静默);(c) 009 删除交易的 AlertDialog confirm **保留**(删除是不可逆操作);(d) 023 分类归档/反归档维持 024 已锁定的 server-first + toast,不动。理由:UX 一致性应建立在"操作语义"而非"操作类型"上 —— 用户对"能否撤销"的预期决定 confirm 必要性,而非"这是哪个实体的操作"。
- Q: AlertDialog 删除按钮是否使用 destructive 红色样式? → A: **是** —— "确认删除"按钮用 destructive 红色 variant(`AlertDialogAction asChild` + `Button variant="destructive"`),"取消"按钮保持 default。理由:删除是不可逆操作,红色按钮符合用户对"危险操作"的视觉预期;AlertDialog 默认 primary 色不足以传达风险。与 Q2"删除=不可逆"语义呼应。归档场景已移出 AlertDialog,所以 destructive variant 仅用于 009 删除交易一处。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 记账表单(008)下拉迁移 (Priority: P1) 🎯 MVP

用户在 `/transaction/new`(或 `?id=` 编辑模式)填写记账表单时,账户选择和分类选择从浏览器原生 `<select>`(渲染样式因 OS 而异、键盘体验割裂)切换为 shadcn `Select`(combobox 模式,统一渲染、键盘可达、搜索友好)。

**为何此优先级**:记账是产品核心动作(宪章原则五"10 秒完成"),表单第二常用控件(仅次于金额 Input)。原生 `<select>` 在移动端体验差(弹原生 picker、不可搜索、不可滚动长列表),直接影响 SC-001 的实现时间预算。

**独立测试**: 浏览器打开 `/transaction/new`,点账户字段 → 弹出 shadcn `Select` 浮层(role="listbox")含全部 active 账户 + 已选中标记;键盘 ↓↑ Enter 工作;点分类字段 → 同样行为 + 含 category.icon + 层级缩进(顶级/二级)。

**Acceptance Scenarios**:

1. **Given** 用户进入 `/transaction/new`, **When** 点击账户字段, **Then** 弹出 shadcn `Select` 浮层(非原生 picker),含全部 active 账户,当前选中项有 ✓ 标记。
2. **Given** Select 浮层打开, **When** 按 ↓↑ 键, **Then** 高亮在选项间移动;按 Enter 选中并关闭;按 Esc 关闭不修改。
3. **Given** 用户在分类 Select, **When** 列表打开, **Then** 每个分类显示 `${icon} ${name}` 格式;若 024 US6 已交付层级数据,二级分类缩进显示。
4. **Given** 用户已选账户 + 分类 + 输入金额, **When** 提交表单, **Then** 提交成功,行为与 024 迁移前一致(包括校验失败时保留选择状态)。
5. **Given** 编辑模式(`/transaction/new?id=xxx`), **When** 表单加载, **Then** 账户 / 分类 Select 预填已有值,显示正确。

---

### User Story 2 - 流水筛选(009)下拉迁移 (Priority: P1) 🎯 MVP

用户在 `/transactions` 页面看到的"账户筛选"和"分类筛选"两个下拉,从原生 `<select>`(全选项写着"全部账户" / "全部分类")迁移到 shadcn `Select`;同时删除确认改用 shadcn `AlertDialog`(替代 `window.confirm`)。

**为何此优先级**:流水页是用户回顾历史的主入口,筛选交互频繁;原生 `<select>` 体验割裂(尤其分类数较多时不可搜索)。删除交易是高风险操作,`window.confirm` 的"原生弹窗"打破了产品视觉一致性。

**独立测试**: 浏览器打开 `/transactions`,点账户筛选 → shadcn `Select` 弹层(含"全部账户"占位 + 各账户);点分类筛选 → 同;点删除按钮 → shadcn `AlertDialog` 弹出(标题"确认删除?"+ "取消"/"确认" 按钮 + 焦点默认在"取消"防误触)。

**Acceptance Scenarios**:

1. **Given** 用户在 `/transactions`, **When** 点击账户筛选, **Then** 弹出 shadcn `Select`(含"全部账户"占位 + active 账户列表 + 已选中标记)。
2. **Given** 用户在 `/transactions`, **When** 点击分类筛选, **Then** 弹出 shadcn `Select`(含"全部分类"占位 + 分类列表 `${icon} ${name}`)。
3. **Given** 用户已选筛选条件, **When** 列表更新后再次打开 Select, **Then** 显示当前已选值。
4. **Given** 用户在 `/transactions`, **When** 点击交易行的"删除"按钮, **Then** 弹出 shadcn `AlertDialog`(非浏览器原生 confirm),含标题"确认删除?"+ 正文(可选说明)+ "取消"/"确认"按钮。
5. **Given** AlertDialog 打开, **When** 焦点状态, **Then** 默认焦点在"取消"按钮(防误触 Enter 删除);"确认删除"按钮视觉为 destructive 红色(clarify Q3);按 Esc = 取消;点击遮罩 = 取消。
6. **Given** 用户点"确认", **When** mutation 完成, **Then** 交易从列表消失 + toast 提示"已删除"(沿用现有 toast 行为)。

---

### User Story 3 - 账户管理(010)下拉 + 归档 UX 对齐 (Priority: P2)

用户在 `/settings` 页面新建/编辑账户时,币种字段从原生 `<select>` 迁移到 shadcn `Select`;账户归档/反归档从 `window.confirm`(仅归档有)+ 静默(反归档)**对齐到 023 的 server-first + toast 模式**(UX 感知等价"optimistic",实现不引入 onMutate,research.md R5),与全工程"归档=可逆=无 confirm"语义统一(clarify Q2 决议)。

**为何此优先级**:010 是低频但重要的设置页;迁移主要是为了一致性(币种选项数量少,原生 select 体验已可接受;归档 UX 对齐消除"为什么分类归档不弹确认、账户归档要弹"的困惑)。优先级低于 US1/US2 因为不影响"10 秒记账"主路径。

**独立测试**: 浏览器打开 `/settings` → 点"新建账户" → 表单中币种字段为 shadcn `Select`(占位"请选择币种"+ 候选 CNY/USD/EUR 等);提交 → 列表出现新账户;点既有账户的"归档"按钮 → **立即**归档(无 confirm)+ toast 提示"已归档";点"已归档"区账户的"反归档"按钮 → **立即**恢复 + toast"已恢复"。

**Acceptance Scenarios**:

1. **Given** 用户在 `/settings` 点"新建账户", **When** 表单打开, **Then** 币种字段为 shadcn `Select`(占位"请选择币种")。
2. **Given** 币种 Select 打开, **When** 浏览选项, **Then** 显示项目支持的币种列表(CNY / USD / EUR / 等,具体列表沿用现有实现)。
3. **Given** 用户编辑既有账户, **When** 表单打开, **Then** 币种 Select 预填当前账户币种。
4. **Given** 用户在账户列表点"归档", **When** 触发, **Then** **无 confirm 对话框弹出**;账户立即从"活跃"区移到"已归档"区;toast 提示"已归档"(与 023 分类归档 UX 一致)。
5. **Given** 用户点"已归档"区账户的"反归档", **When** 触发, **Then** **无 confirm**;账户移回"活跃"区;toast 提示"已恢复"(当前实现完全静默,本 feature 补 toast 与 023 对齐)。
6. **Given** 用户点"归档", **When** 后端返回错误, **Then** 账户保持原位 + toast.error 提示具体原因;**禁止**账户"半归档"中间态。

---

### Edge Cases

- **`AlertDialog` 沉淀归 024 承担**(clarify Q1 决议):024 FR-002 清单已扩展为 9 个原语(补 `alert-dialog.tsx`),本 feature 复用 024 沉淀,不独立沉淀。
- **原生 `<select>` 的"全部账户"占位 vs shadcn Select 的 placeholder**:迁移后"全部账户/全部分类"应作为 Select 的**第一个 SelectItem**(value=`"__all__"` sentinel,024 实测修正),而非 placeholder —— 因为用户需要能"显式选择回到全部"。Radix Select 实测不允许空字符串 value(024 PR category-form.tsx 已发现并修正为 `__root__` sentinel,本 feature 沿用相同模式用 `__all__`)。
- **`window.confirm` 是同步阻塞调用,`AlertDialog` 是 React state 驱动**:迁移意味着把"点删除 → confirm → mutate"改成"点删除 → setState open → 用户确认 → mutate"。需引入每个页面的 confirm state(`confirmingTxId: string | null`),不能复用一个全局 dialog(因为不同交易行的删除目标不同)。
- **移动端 Select 浮层在长列表场景的可滚动性**:分类列表可能含 ~30 个项(内置 12 + 自定义),shadcn Select 默认 max height 需测试;若超出可视区,需 `className` 控制 + 滚动键盘导航。
- **迁移后历史 quickstart 截图失效**:既有 quickstart 若含截图展示原生 `<select>` / `window.confirm`,迁移后视觉变化 —— **不**修改 quickstart 截图(它们记录历史状态),只在末尾追加"shadcn 迁移回归验证"小节。
- **`AlertDialog` 仅用于"删除"场景**(clarify Q2 决议):023 分类归档/反归档 + 010 账户归档/反归档都不用 AlertDialog(归档=可逆,server-first + toast);只有 009 删除交易用 AlertDialog(删除=不可逆,confirm)。原 spec 中"010 归档 → AlertDialog"的提法已废弃。
- **若 024 US1 沉淀的 `Select` 与历史页面 `<select>` 行为不一致**(如已选值显示格式、占位符):以**历史页面当前外观**为准,通过 `className` 或自定义 `SelectValue` 渲染覆盖 shadcn 默认。锁定"行为零回归,外观零回归"。
- **AlertDialog 的 i18n**:本 feature 锁定中文文案("确认删除?" / "取消" / "确认"),与现有 `window.confirm("确认删除?")` 文案对齐;i18n 是独立 feature。归档的 toast 文案("已归档" / "已恢复")与 023 现有 toast 文案对齐(FR-012 / FR-013)。

## Requirements *(mandatory)*

### Functional Requirements

**Phase 1: AlertDialog 原语沉淀依赖(由 024 承担,本 feature 复用)**

- **FR-001**: 系统 MUST 已沉淀 shadcn `AlertDialog` 原语到 `src/components/ui/alert-dialog.tsx`(由 **024 FR-002 扩展清单**承担,本 feature 不再独立沉淀)。024 FR-002 清单由 8 个原语扩展为 9 个(补 `alert-dialog.tsx`)。
- **FR-002**: 本 feature MUST 验证 024 已落地 AlertDialog(否则本 feature 阻塞);验证方式:`ls src/components/ui/alert-dialog.tsx` 存在 + `import { AlertDialog } from "@/components/ui/alert-dialog"` 通过 type-check。
- **FR-003**: 系统 MUST 引入 `@radix-ui/react-alert-dialog` 依赖(由 024 承担,随 AlertDialog 沉淀时引入;本 feature 不重复引入)。

**Phase 2: 记账表单(008)迁移**

- **FR-004**: `src/components/transaction/transaction-form.tsx` 的账户选择字段(accountId)MUST 从裸 `<select>` + `<option>` 替换为 shadcn `Select` + `SelectTrigger` + `SelectContent` + `SelectItem`。
- **FR-005**: 同文件的分类选择字段(categoryId)MUST 同样替换为 shadcn `Select`,且每个 `SelectItem` 渲染 `${icon} ${name}` 格式(沿用现有 option 文案)。
- **FR-006**: 替换后,记账表单在新建 + 编辑两种模式下的预填、提交、校验失败保留行为 MUST 与迁移前一致(008 quickstart 全部 Acceptance Scenario 通过)。

**Phase 3: 流水页(009)迁移**

- **FR-007**: `src/components/transactions/transaction-filters.tsx` 的账户筛选 + 分类筛选 MUST 从裸 `<select>` 替换为 shadcn `Select`,保留"全部账户" / "全部分类"占位项。
- **FR-008**: `src/app/(app)/transactions/page.tsx` 的删除确认 MUST 从 `window.confirm` 替换为 shadcn `AlertDialog`,默认焦点在"取消"按钮(防误触);"确认删除"按钮 MUST 使用 destructive 红色 variant(clarify Q3 决议,`AlertDialogAction asChild` + `Button variant="destructive"`),"取消"按钮保持 default。
- **FR-009**: AlertDialog 的"确认删除"按钮 MUST 触发现有的删除 mutation;"取消"按钮 MUST 关闭 dialog 不触发任何副作用。
- **FR-010**: 替换后,流水页的筛选 / 删除 / 分页行为 MUST 与迁移前一致(009 quickstart 全部 Acceptance Scenario 通过)。

**Phase 4: 账户管理(010)迁移**

- **FR-011**: `src/components/settings/account-form.tsx` 的币种字段 MUST 从裸 `<select>` 替换为 shadcn `Select`。
- **FR-012**: `src/app/(app)/settings/page.tsx` 的账户**归档** MUST 取消 `window.confirm`,改为 server-first + toast 模式(与 023 分类归档对齐,clarify Q2 决议;**不引入 onMutate**,research.md R5):点击立即触发 mutation,onSuccess 后 toast"已归档",onError 后 toast.error 并保持原位。
- **FR-013**: `src/app/(app)/settings/page.tsx` 的账户**反归档** MUST 补 toast 反馈(当前实现完全静默):成功后 toast"已恢复",失败后 toast.error。
- **FR-014**: 替换后,账户管理的新建 / 编辑 / 归档 / 反归档行为 MUST 满足:010 quickstart 既有 Acceptance Scenario **除"归档 confirm"相关步骤外** 100% 通过;"归档 confirm"步骤按 clarify Q2 决议更新为"立即归档 + toast"。

**Phase 5: 文档与回归验证**

- **FR-015**: 本 feature MUST 在 `specs/008-transaction-ui/quickstart.md`、`specs/009-transactions-list-ui/quickstart.md`、`specs/010-settings-ui/quickstart.md` 三个文件**末尾追加**"shadcn 迁移回归验证"小节,列出本 feature 涉及的迁移点 + 手动验证 checklist。
- **FR-016**: 本 feature MUST NOT 修改既有 quickstart 的历史内容(只在末尾追加,保留历史可追溯)。
- **FR-017**: 本 feature MUST NOT 修改 server 端代码(`src/server/**`)—— 纯前端 + UI 原语沉淀。
- **FR-018**: 本 feature MUST NOT 修改 023 已迁移的 4 个文件(category-form / category-manager / category-item / emoji-picker)—— 它们已在 024 US2 完成。
- **FR-019**: 本 feature MUST NOT 引入新的业务 tRPC procedure / 新表 / 新域名实体。

**通用**

- **FR-020**: 本 feature 完成后,`grep -rE '<select|<option|window\.confirm' src/components/ src/app/` MUST 返回 0 个匹配(全工程功能性 UI 不再含裸 select / window.confirm)。
- **FR-021**: 本 feature 完成后,宪章 v2.0.0 第二章技术栈"UI 组件 | shadcn/ui | Radix + Tailwind"在仓库**所有页面**代码层面 MUST 真实成立。

### Key Entities *(include if feature involves data)*

本 feature **不涉及新数据实体**(纯前端重构 + 1 个新 UI 原语文件)。涉及的现有文件视为"工件(Artifact)":

- **`src/components/ui/alert-dialog.tsx`**(由 024 沉淀,本 feature 复用):shadcn `AlertDialog` 原语。
- **`src/components/transaction/transaction-form.tsx`**(修改):2 处 `<select>` → shadcn `Select`。
- **`src/components/transactions/transaction-filters.tsx`**(修改):2 处 `<select>` → shadcn `Select`。
- **`src/app/(app)/transactions/page.tsx`**(修改):`window.confirm` → shadcn `AlertDialog`。
- **`src/components/settings/account-form.tsx`**(修改):1 处 `<select>` → shadcn `Select`。
- **`src/app/(app)/settings/page.tsx`**(修改):`window.confirm` → shadcn `AlertDialog`。
- **`specs/{008,009,010}-*/quickstart.md`**(修改,末尾追加):迁移回归验证 checklist。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 全工程功能性 UI 元素 100% 跑在 shadcn/Radix 上 —— 可由 `grep -rE '<select|<option|window\.confirm' src/components/ src/app/` 返回 0 匹配验证(FR-019)。
- **SC-002**: 三个历史 feature(008/009/010)的 quickstart 全部 Acceptance Scenario,在本 feature 完成后浏览器手动重跑 100% 通过(行为零回归)。
- **SC-003**: 用户在 macOS Safari / Windows Chrome / Android Chrome 三平台看到的下拉 / 确认弹窗视觉一致(无 OS 原生 picker 渲染差异,无浏览器原生 confirm 视觉割裂)。
- **SC-004**: 屏幕阅读器(VoiceOver / NVDA)正确读出"列表框 / 选项 / 对话框 / 警告"等语义,而非"组合框 / 图形 / 文本";删除/归档 AlertDialog 打开时,屏幕阅读器焦点正确移到 dialog 内(而非迷失在背景)。
- **SC-005**: 用户在记账表单(US1)从打开页面到提交一笔交易的耗时,不超过迁移前(因 Radix Select 的浮层渲染开销被键盘可达性 / 移动端 picker 体验改善抵消);用 1 开发者 × 10 笔交易自我计时(内部项目无 5 用户样本,research.md R5 区域降级),中位数 ≤ 迁移前中位数 + 10%(tolerance 放宽因样本量小)。

## Assumptions

- **024-ui-consistency 已合并到 main**,且其 US1 沉淀的 8 个 shadcn 原语 + `components.json` 可用。本 feature 在 024 之前**阻塞**。
- **024 US1 沉淀的 `Select` 原语**满足本 feature 的需求(combobox 模式 / SelectItem 渲染自定义内容 / placeholder);若 024 US1 实际沉淀的 Select 不满足,本 feature 在 plan 阶段需先扩展 Select(回写 024 或在本 feature 内补)。
- **024 US1 沉淀 `AlertDialog`**(clarify Q1 决议后,024 FR-002 清单已扩展含 AlertDialog)—— 本 feature 复用,无需独立沉淀。
- **lucide-react / react-hook-form / @hookform/resolvers 已是项目依赖**(023 / 008 已使用)。
- **shadcn `Select` 在移动端的长列表滚动行为**:Radix Select 自带键盘导航 + scroll into view,默认 max-height 适合 ~30 项的分类列表;若超出(如未来分类超 100),需独立 feature 优化(本 feature 不前置解决)。
- **`window.confirm` 的同步阻塞语义 vs AlertDialog 的异步 state 驱动**:本 feature 接受这一架构变化(每个删除/归档点引入 confirm state),换取视觉一致性和 a11y。
- **三个历史 feature 的 quickstart 都已存在**(008 / 009 / 010 各自 spec.md 同目录有 quickstart.md)—— 已验证。
- **024 US6 已交付层级 category 数据**(008 transaction-form 在 024 之后已经能用 `category.list` 拿到层级);本 feature 只迁移渲染层,不改 category 数据源。
- **本 feature 不引入 dark mode / 不改主题色 / 不刷新设计系统**(独立 feature scope)。
- **AlertDialog 的"取消"按钮默认焦点**是 Radix `AlertDialogCancel` 的默认行为,无需额外代码(若实测不工作,在 plan 阶段通过 `autoFocus` 或 refs 解决)。

## Out of Scope

- **007-onboarding-ui 迁移**(grep 验证后无手写元素需要替换)。
- **023-category-ui 的 archive/unarchive 改用 AlertDialog**(024 spec 已锁定 023 archive = server-first + toast,不在本 feature 改动)。
- **dark mode / 主题切换**(独立 feature)。
- **a11y 全局审计**(独立 feature;Radix 自带 a11y 是迁移副产出,非强制验收)。
- **响应式 / 移动端 picker 体验专项优化**(本 feature 只换控件源,不重新设计交互)。
- **i18n / 多语言**(锁定中文文案,与现状对齐)。
- **新增业务功能 / 新 procedure / 新表**(纯重构)。
- **性能基准刷新**(若 Radix Select 在移动端的开销显著,记入 plan 的 Complexity Tracking,不重测宪章 p95)。
- **既有 quickstart 截图替换**(保留历史截图,只在末尾追加迁移验证小节)。
