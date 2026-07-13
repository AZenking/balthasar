# Feature 规约: UI 一致性补齐 (shadcn 原语沉淀 + 图标统一)

**Feature 分支**: `feat/024-ui-consistency`

**创建日期**: 2026-07-12

**状态**: Draft

**输入**: 用户描述 "1. shadcn 原子组件只有 6 个(button/card/input/label/modal/skeleton)。023 tasks T002 提到 `pnpm dlx shadcn add dialog/select/tabs/popover/radio-group/checkbox/command/tooltip`,但 `src/components/ui/` 当前仍只有原 6 个 —— 说明这些组件以源码内联进了 023 的组件(category-manager 等),未沉淀到 `ui/` 目录。2. BottomNav 用 emoji 图标,其他页面用 lucide-react —— 风格不统一。"

## 概述

本 feature 是一次**面向一致性的 UI 基础设施补齐**,不引入新业务能力。背景:

- 宪章 v2.0.0 第二章技术栈声明 "UI 组件 | shadcn/ui | Radix + Tailwind",但 `src/components/ui/` 实际只有 6 个原子组件(button / card / input / label / modal / skeleton),`components.json`(shadcn CLI 配置)也不存在。
- 023-category-ui tasks.md T002 标记为 [X] 完成 "add shadcn dialog/select/tabs/popover/radio-group/checkbox/command/tooltip",但**实际未沉淀**;023 改用裸 HTML 元素(`<input type="radio">` / `<select>` / `<input type="checkbox">`)和自造 `Modal`(57 行,无 Radix)/ 自造 popover(emoji-picker.tsx 中 `<button>` + `useState` + 手写 `aria-*`)替代。
- BottomNav 用 emoji 字符(📊 📋 ✏️ ⚙️)作为功能性导航图标,而项目其他位置(设置页 / 分类管理 / category-item)使用 lucide-react 线条图标 —— 视觉割裂 + emoji 字符在 macOS / Windows / Android 渲染差异大 + 屏幕阅读器读出"图形"或忽略。

本 feature 解决三件事:
1. **沉淀 shadcn 原语**(dialog / select / tabs / popover / radio-group / checkbox / command / tooltip)到 `src/components/ui/`,让宪章声明的技术栈真正落地。
2. **迁移 023 分类管理 UI** 从手写实现 → shadcn 原语,行为零回归。
3. **统一图标系统**:BottomNav 切换为 lucide-react,移除功能性 emoji。

本 feature **不新增业务功能**,只做结构性重构 + 视觉统一。所有 023 的手动验证场景(6 US × 多 Acceptance Scenario)在迁移后必须 100% 通过。

## Clarifications

### Session 2026-07-12

- Q: 手写的 `Modal`(src/components/ui/modal.tsx,023 创建)在 shadcn `Dialog` 沉淀后,是否替换? → A: **替换** —— `Modal` 是 023 为绕开缺失的 `Dialog` 而临时手写的,迁移后由 `Dialog` 接管,`modal.tsx` 文件删除。同时清理所有 `import { Modal } from "@/components/ui/modal"` 引用(category-manager.tsx)。
- Q: `components.json`(shadcn CLI 配置)是否在本 feature 创建? → A: **是** —— 当前仓库无 `components.json`,导致 T002 当年的 `pnpm dlx shadcn add` 实际未生效。本 feature 必须先补 `components.json` 才能用 CLI 沉淀组件。
- Q: BottomNav 的 emoji 替换为哪些 lucide 图标? → A: **沿用主流记账 App 视觉惯例** —— 首页 = `LayoutDashboard` / 流水 = `ReceiptText`(或 `ListOrdered`)/ 记账 = `PencilLine`(或 `Plus` 圆按钮)/ 设置 = `Settings`。具体图标在 plan 阶段确定 + 截图对比,本 spec 只锁定"必须是 lucide-react 线条图标"。
- Q: 是否同时引入 dark mode? → A: **否** —— dark mode 是独立 feature(影响 globals.css 主题变量 + 全工程颜色 token),与本 feature 正交。本 spec 仅锁定"图标风格统一",不涉及色觉主题切换。

### Session 2026-07-12 (clarify 025 反哺)

- Q: AlertDialog 沉淀位置(025 clarify Q1 反哺)? → A: **沉淀归 024** —— 024 FR-002 清单从 8 个原语扩展为 9 个(补 `alert-dialog.tsx`)。理由:024 是"shadcn 沉淀"主 feature,完整原语清单的单一权威;025 是"消费"feature。024 自身不消费 AlertDialog,但沉淀职责要求清单完整。

### Session 2026-07-12 (clarify 024 自身)

- Q: 沉淀 9 个原语时是否同步补全 globals.css 缺失 token? → A: **同步补全** —— shadcn 原语源码(如 `PopoverContent` / `DialogContent`)默认 className 含 `bg-popover text-popover-foreground`,当前 `src/app/globals.css` 缺 `--color-popover` / `--color-popover-foreground` 等 token(已有 background/foreground/primary/destructive 等核心 token)。US1 沉淀时**必须**补全原语所需的全部 CSS token(light 值,dark 值本 feature 不引入);否则 US2 迁移时原语视觉错乱(透明背景 / 回退默认色),违反"行为零回归"。补 token 不是新功能,是让原语开箱即用的必要前置。

(本次 spec 写入 0 个 [NEEDS CLARIFICATION],所有歧义点均落入"合理默认 + 写入 Assumptions"。可在 `/speckit-clarify` 阶段进一步 challenge。)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - shadcn 原语沉淀到 ui/ 目录 (Priority: P1) 🎯 MVP

开发者(本项目的目标"用户"之一)在 `src/components/ui/` 目录下能直接 import 8 个 shadcn 原语:dialog / select / tabs / popover / radio-group / checkbox / command / tooltip。`components.json` 配置就绪,后续任何 feature 需要新增此类原语时,可通过 CLI 或手动复制从同源获取,无需再造。

**为何此优先级**: 这是宪章技术栈声明的**真正落地** —— 没有这 8 个原语,US2(023 迁移)和未来所有交互密集型 feature 都得继续手写 popover / dialog,违反 DRY 与宪章原则二。

**独立测试**: `ls src/components/ui/` 应看到 8 个新文件 + 既有的 6 个;`cat components.json` 应看到合法 shadcn 配置;`pnpm type-check` 通过;`pnpm test` 既有测试 0 回归。

**Acceptance Scenarios**:

1. **Given** 开发者克隆仓库, **When** 执行 `pnpm install` + `pnpm type-check`, **Then** 8 个新原语文件全部通过 TypeScript 编译,无 missing import 报错。
2. **Given** `src/components/ui/` 目录, **When** 查看内容, **Then** 至少包含 `dialog.tsx` / `select.tsx` / `tabs.tsx` / `popover.tsx` / `radio-group.tsx` / `checkbox.tsx` / `command.tsx` / `tooltip.tsx`,每个文件导出对应的主组件 + 子组件(DialogContent / SelectTrigger / TabsList 等)。
3. **Given** 仓库根目录, **When** 查看 `components.json`, **Then** 配置存在且字段合法(style / rsc / tsx / tailwind config / aliases 指向 `@/components/ui`)。
4. **Given** 既有 6 个原子组件(button / card / input / label / skeleton), **When** US1 完成后重新跑既有测试, **Then** 0 个测试失败(向后兼容)。

> **注**: `modal.tsx` 在 US2 中删除,US1 完成时仍保留(供 US2 渐进迁移)。

---

### User Story 2 - 023 分类管理 UI 迁移到 shadcn 原语 (Priority: P1) 🎯 MVP

已登录用户进入 `/settings/categories` 看到的界面、能完成的操作、感知到的交互(打开/关闭/键盘焦点/滚动锁定/层级嵌套),与 023 当前交付**完全一致**,但底层从手写 HTML / 自造 Modal+Popover 改为 shadcn `Dialog` + `Popover` + `Tabs` + `RadioGroup` + `Checkbox` + `Select`。

**为何此优先级**: 让 US1 沉淀的原语**被实际使用**,证明可用性 + 验证迁移路径。若 US2 不做,US1 沉淀的原语没有 dogfood,后续 feature 仍可能因"不确定能否用"而继续手写。

**独立测试**: 浏览器手动重跑 023 `specs/023-category-ui/quickstart.md` 的全部 6 US 场景,所有 Acceptance Scenario 100% 通过,且开发者工具的 Accessibility Tree 显示 `dialog` / `combobox` / `tab` / `radio` / `checkbox` 等 ARIA role(而非 023 当前的裸 `button` / `radio` 无 group)。

**Acceptance Scenarios**:

1. **Given** 用户进入 `/settings/categories`, **When** 点击"新增分类"按钮, **Then** 弹出 shadcn `Dialog`(而非自造 Modal):焦点自动落到表单首字段、Esc 关闭、点击遮罩关闭、body 滚动锁定 —— 与 023 行为一致。
2. **Given** 新增/编辑表单打开, **When** 用户点击 emoji 触发器, **Then** 弹出 shadcn `Popover`(而非手写 div),内含 shadcn `Tabs`(分类切换)+ emoji grid;焦点陷阱工作,Tab 键可在 popover 内循环。
3. **Given** 表单中的 type 字段(支出/收入), **When** 渲染, **Then** 使用 shadcn `RadioGroup`(role="radiogroup"),而非裸 `<input type="radio">`;键盘 ↑↓ 切换工作。
4. **Given** 表单中的 parent 字段, **When** 渲染, **Then** 使用 shadcn `Select`(combobox 模式),而非裸 `<select>`;搜索 / 键盘导航 / 已选中标记工作。
5. **Given** CategoryManager 的"显示已归档"切换, **When** 渲染, **Then** 使用 shadcn `Checkbox`,而非裸 `<input type="checkbox">`。
6. **Given** 用户已完成 US2 迁移, **When** 查看 `src/components/ui/modal.tsx`, **Then** 文件已删除;`grep -r "Modal" src/components/settings/` 返回 0 个匹配。

---

### User Story 3 - BottomNav 图标统一为 lucide-react (Priority: P2)

用户在任意带 BottomNav 的页面看到的 4 个 tab 图标(首页 / 流水 / 记账 / 设置)与设置页、分类管理等位置的图标风格统一(lucide-react 线条图标),不再使用 emoji 字符。

**为何此优先级**: 视觉一致性问题,不影响功能;但 emoji 字符在不同操作系统渲染差异大(macOS 表情 vs Windows 实心 vs Android 平台特定),且屏幕阅读器读法不可控。优先级低于 US1/US2 因为 BottomNav 当前能用,只是"丑"。

**独立测试**: 浏览器打开任意 `(app)` 路由,查看底栏 —— 4 个图标均为 lucide-react SVG(右键检查元素是 `<svg>` 而非文本字符);active tab 颜色与现有 primary 一致;tap target ≥ 44px;屏幕阅读器(可选 VoiceOver)读出"首页 / 流水 / 记账 / 设置"而非"图形 / image"。

**Acceptance Scenarios**:

1. **Given** BottomNav 渲染, **When** 检查 DOM, **Then** 4 个 tab 的图标均为 `<svg>` 元素(lucide-react 渲染),无 emoji 文本字符。
2. **Given** BottomNav, **When** 在不同设备渲染(macOS Safari / Windows Chrome / Android Chrome), **Then** 图标视觉一致(无平台特定的 emoji 字体回退)。
3. **Given** BottomNav, **When** 用 Tab 键聚焦 + Enter 激活, **Then** 焦点可见 + 跳转工作(active state 切换);屏幕阅读器读出 tab 的 `aria-label`(如"首页")。
4. **Given** 用户切换 active tab, **When** 视察颜色, **Then** active tab 使用 primary 色 + 其余使用 muted-foreground,与现状一致(只换图标源,不改配色)。

---

### Edge Cases

- **023 自造 `Modal` 的关闭按钮位置 / 遮罩颜色 / 标题字号与 shadcn `Dialog` 默认不同时**:以**023 当前外观**为准,通过 `className` 覆盖 shadcn 默认,而非接受 shadcn 默认。锁定"行为零回归,外观零回归"。
- **emoji-picker.tsx 的 ~13 个 group tabs + 搜索框 + grid**:shadcn `Tabs` + `Input` + 自定义 grid 的组合;`Command`(cmdk 包装)在 plan 阶段评估是否更合适(搜索 + 列表场景)。本 spec 不锁定。
- **`Modal` 删除后,若发现非 023 的其他文件也在引用**:本 feature 假设只有 category-manager.tsx 引用(已通过 grep 确认);若 plan 阶段发现更多引用,一并迁移,**不允许**保留 `modal.tsx` 作为"兼容垫片"(违反宪章原则六 YAGNI)。
- **shadcn CLI 与 Next.js 16 / React 19 / Tailwind v4 的版本兼容性**:若 CLI 因版本不兼容无法直接 add,允许**手动从 shadcn 官网仓库复制源码**到 `src/components/ui/`(shadcn 的设计就是"复制粘贴拥有源码")。本 spec 锁定结果(8 个文件存在且可用),不锁定路径(CLI vs 手动)。
- **BottomNav 的"记账"图标选择 `PencilLine` vs `Plus` vs `PenLine`**:本 spec 不锁定具体图标,留 plan 阶段对比 + 用户确认;但锁定"必须来自 lucide-react"。
- **迁移过程中发现 023 既有手写组件有 a11y bug**(如手写 popover 无 focus trap):**修**,并在 quickstart / 验证文档中记录"修复了 023 遗留的 a11y 问题"作为副产出。
- **若迁移后 023 既有组件测试(emoji-picker / category-form / category-select 的 RTL 测试)失败**:必须**调整测试**(selector 从 `role="button"` 改为 `role="dialog"` 等),不允许绕过测试或删除测试。

## Requirements *(mandatory)*

### Functional Requirements

**shadcn 原语沉淀(US1)**

- **FR-001**: 系统 MUST 在仓库根目录创建合法的 `components.json`(shadcn CLI 配置),字段含 style / rsc / tsx / tailwind / aliases,aliases.components 指向 `@/components`。
- **FR-002**: 系统 MUST 在 `src/components/ui/` 目录下沉淀 **9 个 shadcn 原语文件**:`dialog.tsx` / `select.tsx` / `tabs.tsx` / `popover.tsx` / `radio-group.tsx` / `checkbox.tsx` / `command.tsx` / `tooltip.tsx` / **`alert-dialog.tsx`**(clarify 025 Q1 决议:AlertDialog 是 shadcn 标准原语之一,沉淀清单需保持完整,即便 024 自身不消费;025-legacy-shadcn-migration 将消费)。沉淀同时 MUST 在 `src/app/globals.css` **补全原语所需的 CSS token**(clarify 024 Q1 决议):至少含 `--color-popover` / `--color-popover-foreground`(Dialog/Popover 内容默认引用);其他原语默认引用的 token(如 `--color-secondary` 若 shadcn 当前版本引用)在 plan 阶段对照 shadcn 源码确认补齐;light 值参考 shadcn 官方默认,dark 值本 feature **不引入**(独立 dark mode feature scope)。
- **FR-003**: 每个原语文件 MUST 导出与 shadcn 官方一致的主组件及子组件(如 `dialog.tsx` 导出 `Dialog` / `DialogTrigger` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogDescription` / `DialogFooter` / `DialogClose`)。
- **FR-004**: 新沉淀的原语 MUST 在 `pnpm type-check` + `pnpm lint` + `pnpm test` 下 0 错误。
- **FR-005**: 既有 6 个原子组件(button / card / input / label / modal / skeleton)在 US1 完成时 MUST 保持不变(`modal.tsx` 在 US2 才删除)。

**023 迁移(US2)**

- **FR-006**: `src/components/ui/modal.tsx` MUST 在 US2 完成时被删除;所有原 `import { Modal } from "@/components/ui/modal"` 改为 `import { Dialog, DialogContent, ... } from "@/components/ui/dialog"`。
- **FR-007**: 023 分类管理 UI 的所有手写 popover(emoji-picker.tsx 的 `<button aria-expanded>` + `useState` 自造浮层)MUST 替换为 shadcn `Popover` + `PopoverTrigger` + `PopoverContent`。
- **FR-008**: emoji-picker 内的 group 切换(`<button>` 数组)MUST 替换为 shadcn `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent`。
- **FR-009**: CategoryForm 的 type 字段(裸 `<input type="radio">`)MUST 替换为 shadcn `RadioGroup` + `RadioGroupItem`。
- **FR-010**: CategoryForm 的 parent 字段(裸 `<select>` + `<option>`)MUST 替换为 shadcn `Select` + `SelectTrigger` + `SelectContent` + `SelectItem`。
- **FR-011**: CategoryManager 的"显示已归档"切换(裸 `<input type="checkbox">`)MUST 替换为 shadcn `Checkbox`。
- **FR-012**: 迁移后,023 `specs/023-category-ui/quickstart.md` 中 6 US 的全部 Acceptance Scenario MUST 在浏览器手动验证 100% 通过(行为零回归)。
- **FR-013**: 迁移后,Accessibility Tree(浏览器 DevTools)MUST 显示正确的 ARIA role:`dialog` / `combobox` / `tablist` / `radiogroup` / `checkbox`,而非 023 当前的裸 `button` / 杂散 `radio`。
- **FR-014**: 023 既有的 RTL 组件测试(emoji-picker / category-form / category-select)MUST 调整 selector 适配新 ARIA tree 后全部通过;**禁止**删除或 skip 测试。

**图标统一(US3)**

- **FR-015**: BottomNav 的 4 个 tab 图标(首页 / 流水 / 记账 / 设置)MUST 来自 `lucide-react`,不再使用 emoji 字符(📊 📋 ✏️ ⚙️)。
- **FR-016**: BottomNav 的图标 MUST 保留 active / inactive 配色逻辑(active = `text-primary`,inactive = `text-muted-foreground hover:text-foreground`),仅替换图标源。
- **FR-017**: BottomNav 的 tap target MUST 保持 ≥ 44×44px(移动端可达性,宪章原则五);图标尺寸 ≥ 20px。
- **FR-018**: BottomNav 的每个 tab MUST 保留 `aria-label` 或可见文本 label(当前已有 `<span>{tab.label}</span>`,迁移后保留)。
- **FR-019**: 系统 MUST 不出现新的 emoji 字符作为**功能性 UI 图标**(分类数据中的 emoji 如 `category.icon` 仍允许,因为它是用户内容而非 UI chrome)。

**通用(贯穿三 US)**

- **FR-020**: 本 feature MUST NOT 引入新的业务 tRPC procedure / 新的数据库表 / 新的域名实体(纯前端 + UI 基础设施)。
- **FR-021**: 本 feature MUST NOT 修改任何 server 端代码(`src/server/**`),只动 `src/components/**` / `src/app/**` / 仓库根配置文件。
- **FR-022**: 本 feature 完成后,宪章 v2.0.0 第二章技术栈"UI 组件 | shadcn/ui | Radix + Tailwind"在仓库代码层面 MUST 真实成立(`ui/` 含 shadcn 全套原语 + 无手写绕开)。

### Key Entities *(include if feature involves data)*

本 feature **不涉及新数据实体**(纯前端重构)。涉及的现有目录 / 配置文件视为"工件(Artifact)"而非领域实体:

- **`components.json`**(新建):shadcn CLI 配置,描述风格 / 路径别名 / Tailwind 集成点。
- **`src/components/ui/<primitive>.tsx`**(8 个新建 + 1 个删除 `modal.tsx`):shadcn 原语源码,由 CLI 生成或从官方仓库复制。
- **`src/components/bottom-nav.tsx`**(修改):tab 图标源从 emoji 字符改为 lucide-react 组件。
- **`src/components/settings/{emoji-picker,category-form,category-manager,category-item}.tsx`**(修改):手写原语 → shadcn 原语。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 开发者在后续任何 feature 中需要一个 dialog / popover / select / tabs / radio-group / checkbox / command / tooltip / alert-dialog 时,可直接 `import { Dialog } from "@/components/ui/dialog"` 而无需复制源码 —— 可由"仓库 `ui/` 目录下文件清单"验证(目标:14 个文件 = 既有 6 - modal 1 + 新 9)+ "`grep -E '\\-\\-color-popover' src/app/globals.css` 返回 ≥1 匹配"(clarify 024 Q1 token 补全验证)。
- **SC-002**: 023 `specs/023-category-ui/quickstart.md` 中 6 US × 多 Acceptance Scenario 共计 ≥ 30 个手动验证步骤,在本 feature 完成后 100% 通过(行为零回归)。
- **SC-003**: 屏幕阅读器(VoiceOver / NVDA)在 `/settings/categories` 页面正确读出"对话框 / 表单 / 单选组 / 复选框 / 选项卡列表"等语义,而非"图形 / 按钮 / 按钮 / 按钮";在 BottomNav 正确读出"首页 / 流水 / 记账 / 设置"而非"图形"。
- **SC-004**: 用户在 macOS Safari / Windows Chrome / Android Chrome 三平台看到的 BottomNav 图标视觉一致(无 emoji 字体回退导致的跨平台差异)。
- **SC-005**: 本 feature 不引入新业务能力,但**间接降低**未来交互密集型 feature 的实现成本 —— 可由"后续第一个使用 dialog/popover 的新 feature 实现时间 ≤ 不沉淀时的 70%"间接验证(本指标在 feature 落地后的下一个相关 feature 中观察,不在本 feature 验收时强制)。

## Assumptions

- **lucide-react 已是项目依赖**(023 已使用 `Tags` / `X` / `GripVertical`),无需新增 dep。
- **`@radix-ui/*` 是 shadcn 原语的 peer dependency**,沉淀 8 个原语会引入一批 `@radix-ui/react-*` 包(如 `@radix-ui/react-dialog` / `@radix-ui/react-popover` 等)—— 这是必要的依赖增长,符合宪章"新增依赖必须有正当理由:缺失能力,而非便利"原则(缺失的就是 dialog/popover 等组件能力)。
- **BottomNav 是当前唯一使用 emoji 字符作为功能性 UI 图标的位置**(已通过 `grep -rE '[📊📋✏️⚙️🔑💸💰]'` 验证;分类数据中的 emoji 如 `category.icon` 是用户内容,不在本 feature scope)。
- **`src/components/ui/modal.tsx` 当前只被 `category-manager.tsx` 引用**(已通过 grep 验证;若 plan 阶段发现更多引用,一并迁移)。
- **023 当前的 RTL 组件测试覆盖 emoji-picker / category-form / category-select**(已在 023 Phase 9 落地),迁移后需调整 selector 但不删除。
- **shadcn CLI 可能因 Next.js 16 / React 19 / Tailwind v4 版本兼容性无法直接使用**,允许 plan 阶段决定走"手动复制源码"路径;shadcn 的设计哲学就是"复制源码拥有它",CLI 只是便利工具,缺失不影响沉淀结果。
- **本 feature 不引入 dark mode**(独立 feature scope),BottomNav 图标迁移保留当前明暗配色逻辑。
- **本 feature 不替换既有 `button.tsx` / `card.tsx` / `input.tsx` / `label.tsx` / `skeleton.tsx`**(它们工作良好且被广泛引用,替换无收益却有回归风险)。
- **023 既有手写 popover 可能有 a11y 问题**(focus trap / Esc 关闭 / aria 属性),迁移到 Radix 后**自然修复**,这是本 feature 的副产出而非额外要求。

## Out of Scope

- **dark mode / 主题切换**(globals.css 色彩变量重构,独立 feature)。
- **替换既有 6 个原子组件**(button / card / input / label / skeleton,无收益)。
- **为 007-onboarding-ui / 008-transaction-ui / 009-transactions-list-ui / 010-settings-ui 历史页面补 shadcn 原语**(只迁移 023;历史页面若用手写元素工作良好,不在本 feature 改动范围 —— 后续按需在各自迭代中迁移)。
- **新增业务功能 / 新 procedure / 新表**(纯重构)。
- **性能基准刷新**(宪章原则五的 p95 目标不受 UI 原语切换影响,不重测;若 plan 阶段发现 Radix 带来的运行时开销显著,记入 plan 的 Complexity Tracking)。
- **i18n / a11y 全局审计**(只锁定本 feature 触及的文件;a11y 全局推进是独立 feature)。
