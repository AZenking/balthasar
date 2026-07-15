# Feature 规约: 分类图标全量迁移 emoji → lucide-react 矢量图标

**Feature 分支**: `feat/028-category-lucide-icons`

**创建日期**: 2026-07-15

**状态**: Draft

**输入**: 用户描述 "全量替换分类(categoryId)图标,从 emoji 字符迁移到 lucide-react SVG 矢量图标(数据迁移 + 常量/校验 + CategoryIcon 渲染组件 + IconPicker + ~12 处渲染点 + 测试)。"

## 概述

本 feature 是一次**面向视觉一致性的分类图标系统替换**,不引入新业务能力。背景:

- 分类(category)的 `icon` 字段当前存储 **emoji 字符**(🍔 💰 🚗 …),来源是 `src/lib/constants/category-emojis.ts` 的 ~120 个 emoji 白名单,按"食物/交通/购物"等 13 域分组。前端在 ~12 处把 `icon` 当**纯文本**渲染(`<span>{cat.icon}</span>`),依赖系统 emoji 字体上色。
- 024-ui-consistency 已把**功能性 UI chrome 图标**(BottomNav、sidebar)统一为 lucide-react 线条图标,并在 FR-019 显式声明"分类数据中的 emoji 如 `category.icon` 仍允许,因为它是用户内容而非 UI chrome" —— 即分类图标被刻意留到了本 feature。
- emoji 字符在 macOS / Windows / Android 三平台渲染差异大(表情 vs 实心 vs 平台特定),无法跟随主题色,屏幕阅读器读法不可控("图形"或忽略),且与 024 已统一的 lucide 线条图标风格割裂。

本 feature 解决三件事:
1. **建立矢量图标基础设施**:一个 `CategoryIcon` 渲染组件(图标名 → lucide 组件映射)+ 一个图标名白名单/分组常量(替换 `category-emojis.ts`)+ 校验层从 emoji 集改为图标名集。
2. **迁移既有分类数据**:所有 `category.icon` 值从 emoji 字符转换为对应的 lucide 图标名(20 内置 seed + 全部曾通过校验的自定义分类);`icon` 列类型不变,只改"内容"。
3. **替换图标选择器**:`EmojiPicker` 改为 `IconPicker`,沿用分组 tab + 搜索交互,候选为 lucide 矢量图标。

本 feature **不新增业务功能 / 新 tRPC procedure / 新表 / 新域名实体**,只做图标系统的"存储值 + 渲染方式"统一替换。所有现有分类交互(新增 / 编辑 / 选择 / 报表下钻)在迁移后必须行为零回归。

## Clarifications

(本次 spec 写入 0 个 [NEEDS CLARIFICATION],所有歧义点均落入"合理默认 + 写入 Assumptions"。可在 `/speckit-clarify` 阶段进一步 challenge。)

**关键决策记录**:

- **存储格式**:icon 字段存 lucide 图标名(kebab-case 字符串,如 `utensils`/`car`),`text NOT NULL` 列类型不变 —— 无 schema 变更,只改列内容。(理由:图标名人类可读、可调试,无需引入 ID 映射表,符合宪章原则六 YAGNI。)
- **自定义分类迁移**:既有自定义分类的 icon 值均曾通过 `CATEGORY_EMOJI_SET` 校验,故属于有限白名单(~120)内,可建立**完整 emoji→图标名映射**;不存在"语义无法对应"的孤儿值。若有非白名单脏数据(如手工改库),迁移兜底处理。
- **色彩语义**:本 feature 只替换图标**形状**,不引入 income→success / expense→danger 色彩语义到图标(保留现有文本色继承)。色彩语义属独立主题 feature scope(`docs/THEME.md` 是真相源)。
- **图标选择器 UX**:沿用 024 已沉淀的 Popover + Tabs 骨架,仅把网格内容从 emoji 字符换成 lucide 图标,交互行为零回归。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 矢量图标渲染层 + 校验/常量 (Priority: P1) 🎯 MVP

开发者(本项目目标"用户"之一)在 `src/components/category/` 下能直接 import `CategoryIcon` 组件,传入图标名即渲染对应的 lucide 矢量 SVG 图标;`src/lib/constants/` 下有一个矢量图标名白名单 + 按域分组 + O(1) 校验集(替换 `category-emojis.ts`);分类 icon 字段的 zod 校验(前端 + 后端 procedure)从 emoji 集改为图标名集。所有渲染分类图标的位置(流水列表项、dashboard recent-transactions / category-breakdown / top-category-card / category-top-list、报表 category-donut / category-breakdown-card、分类选择器 category-select、分类管理 category-item / category-form 的父分类下拉)统一使用 `CategoryIcon` 渲染,不再把 icon 当文本字符渲染。

**为何此优先级**:这是整个迁移的**地基** —— 没有渲染组件 + 白名单 + 校验,数据迁移(US2)与选择器(US3)都无依托。`CategoryIcon` 过渡期**兼容旧 emoji 值**(未命中映射时回退为文本渲染),使渲染层可先于数据迁移安全上线,避免"半截迁移"期间图标空白。

**独立测试**:`pnpm type-check` + `pnpm lint` 通过;`grep -rE '<span[^>]*>\{[^}]*(cat|node|t|item|c)\.icon' src/components/` 与 `grep -rE '\{[^}]*(cat|node|t|item|c)\.categoryIcon\}' src/components/` 返回 0 匹配(所有渲染点已改用组件);既有测试 0 回归。

**Acceptance Scenarios**:

1. **Given** 一个分类的 icon 值为合法 lucide 图标名, **When** 在任意页面渲染该分类图标, **Then** DOM 输出为 `<svg>` 元素(lucide 渲染),非 emoji 文本字符。
2. **Given** 一个分类的 icon 值为旧 emoji 字符(过渡期), **When** `CategoryIcon` 渲染, **Then** 回退为文本渲染(不抛错、不空白),保证迁移期不破图。
3. **Given** 一个分类的 icon 值不在图标名白名单内(未知名), **When** `CategoryIcon` 渲染, **Then** 回退到兜底图标(如 `circle-help`),不抛错、不渲染空。
4. **Given** 分类创建/编辑表单提交, **When** icon 值不在矢量图标名白名单内, **Then** 前端 zod + 后端 procedure 均拒绝,错误信息指向"图标必须来自内置图标库"。
5. **Given** 渲染层已替换, **When** 在 macOS Safari / Windows Chrome / Android Chrome 查看, **Then** 同一分类图标视觉一致(无 emoji 字体回退导致的跨平台差异)。
6. **Given** 屏幕阅读器聚焦分类图标, **When** 朗读, **Then** 不读出"图形 / image",而是忽略(`aria-hidden`)或读出语义标签。

---

### User Story 2 - 既有分类数据迁移 (Priority: P1) 🎯 MVP

所有已存在的分类行(20 内置 seed + 用户自建)的 `icon` 字段被自动从 emoji 字符转换为对应的 lucide 图标名。迁移覆盖内置 seed 的 20 个(餐饮 🍔→`utensils`、交通 🚗→`car`、工资 💰→`wallet` …)以及全部曾通过 `CATEGORY_EMOJI_SET` 校验的自定义分类 emoji。迁移后无需用户手动重选图标。`0003_categories.sql` seed 与种子生成脚本同步输出图标名,防止重跑种子回退到 emoji。

**为何此优先级**:数据层与渲染层(US1)是**一体两面** —— US1 让渲染兼容新旧两种值,US2 把数据从旧值统一切到新值。两者必须同批上线,否则用户看到的是半截迁移的图标。优先级与 US1 并列 P1。

**独立测试**:迁移脚本对开发库执行后,`SELECT icon FROM categories WHERE icon ~ '[^\x00-\x7F]'` 返回 0 行(无 emoji/非 ASCII 残留);`SELECT count(*) FROM categories` 迁移前后行数一致(只改值,不改行数);迁移日志中兜底(fallback)计数可查。

**Acceptance Scenarios**:

1. **Given** 迁移前 `categories` 表含 20 内置 + N 自定义行,icon 均为 emoji 字符, **When** 执行数据迁移, **Then** 所有行 icon 变为 kebab-case 图标名;行数不变;无 emoji 字符残留。
2. **Given** 某自定义分类 icon 值不在 emoji→图标名映射表中(脏数据), **When** 迁移执行, **Then** 该行 icon 被置为兜底默认图标名,且该行 id + 旧值被写入迁移日志,供人工修正。
3. **Given** 迁移后重跑 `0003_categories.sql` seed(幂等 `ON CONFLICT DO NOTHING`), **When** 检查内置行 icon, **Then** 值仍为图标名(seed 已同步,不会回退到 emoji)。
4. **Given** 迁移完成, **When** 用户进入流水/dashboard/报表, **Then** 所有分类图标正确显示为对应矢量图标(餐饮→餐具、交通→汽车、工资→钱包),语义保持。
5. **Given** 迁移脚本存在 down 路径(回滚), **When** 执行回滚, **Then** icon 值恢复为迁移前 emoji(虽不要求长期支持 down,但迁移本身可逆,符合宪章"迁移验证 down 路径可回滚"开发流程)。

---

### User Story 3 - 矢量图标选择器 IconPicker (Priority: P2)

用户在分类新增/编辑表单点击"图标"触发器,弹出一个矢量图标选择器(替换现有 `EmojiPicker`):沿用分组 tab(食物/交通/购物…)+ 搜索框交互,候选为 lucide 矢量图标网格;点击选中后关闭弹层并写入表单。交互行为(打开/关闭/焦点陷阱/Esc/Tab 循环)与 `EmojiPicker` 一致(024 已沉淀 Popover+Tabs)。

**为何此优先级**:选择器是用户**主动创建/修改**分类图标的入口,影响面小于 US1/US2(渲染 + 数据全量切换),且在数据迁移完成后才完全生效(用户只能在图标名白名单内选)。但缺了它,用户无法新建带矢量图标的分类,故仍为 P2 必做。

**独立测试**:浏览器打开 `/settings/categories` → 新增/编辑 → 点图标触发器:弹出 Popover 含 Tabs(域分组)+ 搜索框 + 图标网格;搜索"餐"或"car"能定位目标;选中后触发器显示该矢量图标;Esc/遮罩点击关闭。

**Acceptance Scenarios**:

1. **Given** 分类表单的图标字段, **When** 点击触发器, **Then** 弹出 Popover(024 沉淀的原语),内含分组 Tabs + 搜索框 + lucide 图标网格。
2. **Given** 选择器打开, **When** 在搜索框输入图标名(如 `car`)或中文域标签(如"交通"), **Then** 网格过滤到匹配项;无匹配时显示"无匹配图标"占位。
3. **Given** 选择器网格, **When** 点击某图标, **Then** 表单 icon 字段写入该图标名,触发器显示该矢量图标,Popover 关闭。
4. **Given** 选择器打开, **When** 按 Esc / 点击遮罩 / Tab 循环, **Then** 行为与 `EmojiPicker` 一致(关闭、焦点回归触发器、焦点陷阱)。
5. **Given** 表单提交, **When** icon 为选择器写入的图标名, **Then** 通过 zod + procedure 校验(命中白名单)。

---

### Edge Cases

- **非白名单脏数据**:既有行 icon 值不在 emoji→图标名映射表(手工改库 / 历史遗留),迁移**兜底**为默认图标名 + 日志告警,不阻塞迁移;人工据日志修正。
- **`lucide-react` 版本与图标名差异**:不同版本 lucide 的图标名/导出可能不同(package.json 当前 `^1.23.0`,需在 plan 阶段核对实际安装版本的可用导出名);`CategoryIcon` 的映射表必须以实际版本导出为准,未知名回退兜底。
- **`CategoryIcon` 未知名兜底**:任何映射表外的图标名 → 渲染兜底图标(如 `circle-help`),不抛错、不空白。
- **迁移 SQL CASE 与白名单漂移**:迁移的 `CASE icon WHEN ... THEN ...` 子句必须与图标名白名单完全一致;plan 阶段应从白名单常量生成 CASE 子句,防止手写漂移。
- **报表 donut / legend 中的图标渲染**:`category-donut.tsx` 在图例/tooltip 处渲染 `categoryIcon`;矢量图标在这些小尺寸场景下需保持可辨识(尺寸 ≥ 12px,不糊)。
- **父分类下拉(category-form SelectItem)中的图标**:`{c.icon} {c.name}` 内联场景需用 `CategoryIcon`(小尺寸),与文本基线对齐。
- **`EmojiPicker` 删除**:迁移完成后 `src/components/settings/emoji-picker.tsx` 删除;`grep -r "EmojiPicker" src/` 返回 0;**禁止**保留作为兼容垫片(违反宪章原则六 YAGNI)。
- **既有 RTL 组件测试**:若 emoji-picker / category-form / category-select 有 RTL 测试,迁移后 selector/断言需调整(图标从文本字符变为 svg),**禁止**删除或 skip 测试。
- **过渡期渲染兼容**:US1 的 `CategoryIcon` 必须兼容旧 emoji 值(文本回退),使渲染层可先于 US2 数据迁移合并;但 feature 整体完成后,仓库内无 emoji 分类图标残留。
- **宪章原则七(HEROUI 纪律)**:本 feature 触及 `src/components/**/*.tsx`,plan/implement 阶段**必须**先查 `/heroui-react` skill 获取 HeroUI v3 组件 API(variant/slot/Popover+Tabs)再落码;**禁止**凭 shadcn 时代记忆编码。

## Requirements *(mandatory)*

### Functional Requirements

**矢量图标基础设施 + 渲染(US1)**

- **FR-001**: 系统 MUST 提供一个 `CategoryIcon` 渲染组件:输入图标名(kebab-case 字符串),输出对应 lucide 矢量 SVG 图标;未知名 MUST 回退到兜底图标(不抛错、不渲染空)。
- **FR-002**: `CategoryIcon` MUST 过渡期兼容旧 emoji 值 —— 输入值未命中图标名映射时,回退为文本渲染(保证迁移期不破图)。
- **FR-003**: 系统 MUST 在一个常量文件(替换 `category-emojis.ts`)中维护:矢量图标名白名单(数组)+ 按域分组(picker tab 用)+ O(1) 校验集;新增图标只需在此文件加一条目。
- **FR-004**: 分类 icon 字段的校验(前端 zod `iconSchema` + 后端 procedure 输入 schema)MUST 从 `CATEGORY_EMOJI_SET` 改为矢量图标名白名单集;非白名单值 MUST 被拒绝,错误信息指向"图标必须来自内置图标库"。
- **FR-005**: 所有渲染分类图标的位置 MUST 使用 `CategoryIcon` 渲染,不再把 icon 当文本字符渲染。覆盖位置至少含:`category-select.tsx`、`category-item.tsx`、`category-form.tsx`(父分类 SelectItem 内)、`transaction-list-item.tsx`、`transaction-filters.tsx`、`recent-transactions.tsx`、`category-breakdown.tsx`、`top-category-card.tsx`、`category-top-list.tsx`、`category-breakdown-card.tsx`、`category-donut.tsx`。
- **FR-006**: 矢量图标 MUST 继承当前文本色,不引入 income→success / expense→danger 色彩语义(仅替换图标形状,保留现有配色)。
- **FR-007**: 矢量图标 MUST 在 macOS / Windows / Android 三平台渲染一致(无 emoji 字体回退)。
- **FR-008**: 矢量图标 MUST 有无障碍标注(装饰性图标 `aria-hidden`,语义性图标提供 `aria-label`),屏幕阅读器不读出"图形 / image"。

**既有数据迁移(US2)**

- **FR-009**: 系统 MUST 提供一条数据迁移,把所有现有 `category.icon` 值(emoji 字符)转换为对应的 lucide 图标名;迁移 MUST 覆盖内置 seed 的 20 个 + 全部曾通过 `CATEGORY_EMOJI_SET` 校验的自定义分类 emoji。
- **FR-010**: `icon` 列类型 MUST 保持 `text NOT NULL` 不变(无 schema 变更,只改列内容)。
- **FR-011**: 数据迁移 MUST 对未在映射表中的 icon 值提供兜底默认图标名,并在迁移日志中记录这些行的 id + 旧值,供人工修正。
- **FR-012**: 迁移后,`0003_categories.sql` seed 与种子生成脚本(`scripts/generate-category-seed.mjs`)MUST 同步输出矢量图标名,防止重跑种子回退到 emoji。
- **FR-013**: 迁移 MUST 只改 icon 列值,不改行数、不改其他列、不改 id;迁移后 `SELECT count(*)` 与迁移前一致。

**矢量图标选择器(US3)**

- **FR-014**: 系统 MUST 用 `IconPicker` 替换 `EmojiPicker`,沿用 024 已沉淀的 Popover + Tabs 骨架;交互(打开/关闭/Esc/遮罩/焦点陷阱/Tab 循环)与 `EmojiPicker` 行为零回归。
- **FR-015**: `IconPicker` 的候选 MUST 来自矢量图标名白名单,按域分组(食物/交通/购物…),与常量文件的分组一致。
- **FR-016**: `IconPicker` 的搜索 MUST 支持按图标名(如 `car`)或中文域标签(如"交通")匹配。
- **FR-017**: 迁移完成后,`src/components/settings/emoji-picker.tsx` MUST 被删除;`grep -r "EmojiPicker" src/` 返回 0 匹配;**禁止**保留作为兼容垫片。

**通用(贯穿三 US)**

- **FR-018**: 本 feature MUST NOT 新增业务 tRPC procedure / 新数据库表 / 新域名实体(只改 icon 字段"内容" + 渲染 + 选择器)。
- **FR-019**: 服务端查询层(`queries/category.ts` / `dashboard.ts` / `transaction.ts`)对 `icon`/`categoryIcon` 的透传逻辑 MUST 保持不变(字段仍为 text 透传,零逻辑改动)。
- **FR-020**: 既有分类相关测试 MUST 更新 icon 断言(emoji → 图标名)后全部通过;**禁止**删除或 skip 测试。
- **FR-021**: 本 feature 的 UI 改动(plan/implement 阶段)MUST 先查 `/heroui-react` skill(宪章原则七 UI 调整纪律)。

### Key Entities *(include if feature involves data)*

本 feature **不新增领域实体**(纯图标系统替换)。涉及的现有字段/工件:

- **`categories.icon` 字段**(修改"内容",不改列):存储值从 emoji 字符改为 lucide 图标名(kebab-case 字符串);`text NOT NULL` 类型不变。
- **矢量图标白名单常量**(替换 `category-emojis.ts`):图标名数组 + 按域分组 + O(1) 校验集;前端(picker)+ 后端(zod refine)同源,无漂移。
- **`CategoryIcon` 渲染组件**(新建,`src/components/category/`):图标名 → lucide 组件映射 + 兜底;所有渲染点统一消费。
- **`IconPicker`**(替换 `EmojiPicker`):lucide 图标网格 + 分组 Tabs + 搜索;基于 024 沉淀的 Popover+Tabs。
- **数据迁移 SQL**(新建 migration):`UPDATE categories SET icon = CASE ... END`,emoji→图标名;`0003_categories.sql` seed + 生成脚本同步。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户在流水列表、dashboard(最近交易/分类占比/顶级分类)、报表(分类环图/分类占比卡)、分类选择器、分类管理 5 类页面看到的分类图标均为矢量图形(DOM 检查为 `<svg>`),无 emoji 文本字符残留 —— 可由 `grep -rE '[🍔💰🚗🛍️🏠💡📱💊🎮📚👕🎁💸🎉📈💼🧾🧧↩️💵]' src/components/` 返回 0 匹配验证。
- **SC-002**: 迁移后 0 个分类行出现"兜底图标"(即所有既有 emoji 都命中映射表)—— 可由"迁移日志中 fallback 计数 = 0"验证;若有 fallback,人工修正后 = 0。
- **SC-003**: 用户在 macOS Safari / Windows Chrome / Android Chrome 三平台看到的同一分类图标视觉一致(无跨平台 emoji 字体差异)。
- **SC-004**: 用户新建/编辑分类时,图标选择器的分组 tab + 搜索体验与迁移前 `EmojiPicker` 一致 —— 能完成"选图标"操作,搜索能按图标名或中文域标签定位目标图标。
- **SC-005**: 屏幕阅读器在分类图标处不读出"图形 / image",而是忽略(`aria-hidden`)或读出语义标签 —— 5 类页面抽检通过。
- **SC-006**: 既有分类相关测试(procedure / dashboard / transaction create 集成测试)在更新 icon 断言后 100% 通过(零回归)。

## Assumptions

- **`lucide-react` 已是项目依赖**(024 已用 `LayoutDashboard`/`Receipt` 等;HeroUI v3 栈继续使用 lucide),无需新增 dep。package.json 当前 `^1.23.0` 需在 plan 阶段核对实际安装版本的可用图标导出名。
- **存储格式**:icon 字段存 lucide 图标名(kebab-case 字符串),`text NOT NULL` 列类型不变,无 schema/迁移类型变更,只改列内容。
- **既有自定义分类的 icon 值均曾通过 `CATEGORY_EMOJI_SET` 校验**,故属于有限白名单(~120)内,可建立完整 emoji→图标名映射;若有非白名单脏数据(手工改库),迁移兜底处理。
- **本 feature 不引入 income/expense 色彩语义到图标**(保留现有文本色继承;色彩语义属独立主题 feature scope,`docs/THEME.md` 是真相源)。
- **本 feature 不替换导航/UI chrome 图标**(已由 024 迁移至 lucide);只替换分类(category)图标。
- **`CategoryIcon` 过渡期兼容旧 emoji 值**(未命中映射时回退文本渲染),使渲染层(US1)可先于数据迁移(US2)合并;feature 整体完成后仓库内无 emoji 分类图标残留。
- **`IconPicker` 沿用 `EmojiPicker` 的 Popover+Tabs 骨架**(024 已沉淀 shadcn→现 HeroUI v3 适配),仅换网格内容为 lucide 图标,交互零回归。
- **本 feature 触及 `src/components/**/*.tsx`**,plan/implement 阶段 MUST 先查 `/heroui-react` skill(宪章原则七 UI 调整纪律);本 spec 不锁定具体 HeroUI 组件 API,留 plan 阶段对照。
- **具体 emoji→lucide 图标名映射表**(20 内置 seed + ~100 候选)在 plan 阶段定稿;本 spec 只锁定"必须是 lucide-react 矢量图标 + 语义保持 + 白名单同源"。
- **迁移 down 路径**(回滚 emoji)虽提供但不要求长期支持;满足宪章"迁移验证 down 路径可回滚"开发流程即可。

## Out of Scope

- **导航/UI chrome 图标**(BottomNav、sidebar 等,已由 024 迁移至 lucide)。
- **图标色彩语义**(income→success / expense→danger,属独立主题 feature;`docs/THEME.md` 是真相源)。
- **dark mode 图标适配**(属独立 dark mode feature)。
- **新增分类域 / 新业务功能 / 新 procedure / 新表**(纯图标系统替换)。
- **重设分类 seed 的 UUID / 排序 / 名称**(只改 icon 列值)。
- **历史页面(007/008/009/010)的 UI 原语补齐**(只动分类图标渲染点;历史页面若工作良好不在本 feature 范围)。
- **i18n / a11y 全局审计**(只锁定本 feature 触及的图标渲染点)。
