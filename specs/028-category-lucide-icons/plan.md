# Implementation Plan: 分类图标全量迁移 emoji → lucide-react

**Branch**: `feat/028-category-lucide-icons` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-category-lucide-icons/spec.md`

## Summary

将分类(category)的 `icon` 字段从 emoji 字符(🍔 🚗 …)全量迁移到 lucide-react 矢量 SVG 图标名(kebab-case 字符串)。三件事一体交付:

1. **矢量图标基础设施**(US1/P1):`CategoryIcon` 渲染组件 + `category-icons.ts` 白名单常量(替换 `category-emojis.ts`) + zod 校验从 emoji 集改为图标名集 + ~12 处渲染点统一替换。
2. **既有数据迁移**(US2/P1):`categories.icon` 列内容从 emoji → 图标名,`0003_categories.sql` seed 同步。
3. **矢量图标选择器**(US3/P2):`IconPicker` 替换 `EmojiPicker`,沿用 Popover+Tabs 骨架,网格内容换为 lucide 图标。

**技术路线**:无 schema 变更(`icon` 列保持 `text NOT NULL`,只改内容);无新依赖(`lucide-react@1.23.0` 已安装);无新 tRPC procedure/表/领域实体。`CategoryIcon` 过渡期兼容旧 emoji 值(文本回退),使渲染层可先于数据迁移安全上线。

**执行策略**:T0(常量+组件)→ T1(校验层)→ T2(渲染点替换)→ T3(数据迁移)→ T4(IconPicker)→ T5(清理+测试)。每阶段可独立提交。

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19 / Next.js 16(宪章技术栈冻结)

**Primary Dependencies**:
- 保留(零变更):Next.js 16 / React 19 / Tailwind v4 / `@heroui/react` + `@heroui/styles`(HeroUI v3)/ tRPC v11 / Drizzle / Better-Auth / `recharts` / `react-hook-form` / `zod` / `sonner` / `superjson`
- **`lucide-react@1.23.0`**(已安装,024 起 UI chrome 图标已用):本 feature 将分类数据图标也迁移至同一库。plan 阶段已验证 183+ 图标名可用(见 [research.md](./research.md))。

**Storage**: PostgreSQL 16。**无 schema 变更**:`categories.icon` 列保持 `text NOT NULL`,只改列内容(emoji 字符 → kebab-case 图标名)。

**Testing**: Vitest 3 + `@testing-library/react` + `@testcontainers/postgresql`(保留)。更新既有测试的 icon 断言(emoji → 图标名);新增 `CategoryIcon` 渲染测试(正常/兜底/emoji 回退)。

**Target Platform**: Web 浏览器,移动端优先。矢量图标在 macOS/Windows/Android 三平台渲染一致(消除 emoji 字体差异)。

**Project Type**: web-app(Next.js 全栈,T3 stack)

**Performance Goals**: 无新增性能目标。`CategoryIcon` 为纯客户端组件,lucide 图标按需 tree-shake,无 bundle 膨胀风险。

**Constraints**:
- 宪章原则七:所有 UI 改动先 `/heroui-react` skill 查询
- 迁移期间 `CategoryIcon` 必须兼容旧 emoji 值(文本回退,不抛错)
- 迁移后仓库内无 emoji 分类图标残留(`grep` 验证)
- `EmojiPicker` 必须删除,禁止保留兼容垫片(宪章原则六 YAGNI)

**Scale/Scope**:
- 新建文件:3 个(`category-icons.ts`、`category-icon.tsx`、`icon-picker.tsx`)
- 修改文件:~15 个(8 渲染组件 + 2 校验文件 + 1 领域规则 + 1 seed SQL + 1 form + 1 EmojiPicker 删除 + 测试)
- 数据迁移:1 条 SQL(`UPDATE categories SET icon = CASE ... END`)
- 无新 tRPC procedure / 新表 / 新领域实体

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 说明 |
|------|------|------|
| 一、MVP 范围 | ✅ Pass | 分类是 MVP 核心实体(003)。图标系统替换不引入范围外功能(AI/OCR/投资/多币种等禁止项均未触及)。 |
| 二、Feature-Sliced Architecture | ✅ Pass | 新组件入 `src/components/category/`(CategoryIcon)与 `src/components/settings/`(IconPicker);新常量入 `src/lib/constants/`;迁移 SQL 入 `src/server/db/migrations/`。依赖方向不变。 |
| 三、领域驱动设计 | ✅ Pass | `Family` 仍为唯一聚合根;`Category.icon` 字段内容变更不引入新表/新聚合。`isCategoryEmoji()` → `isCategoryIcon()` 仅改校验集,不改领域边界。 |
| 四、测试优先 | ✅ Pass | 测试矩阵:① 单元 — `CategoryIcon` 渲染(正常/兜底/emoji 回退);② 校验 — zod schema 拒绝非白名单图标名;③ 集成 — testcontainers 验证迁移 SQL;④ 既有测试更新 icon 断言。tasks 阶段先红后绿。 |
| 五、性能与极速录入 | ✅ Pass | 无 query 变更(`icon` 仍为 text 透传)。IconPicker 交互零回归(沿用 Popover+Tabs)。 |
| 六、简单 (YAGNI) | ✅ Pass | 显式排除:图标 ID 映射表(用图标名字符串即可)、EmojiPicker 兼容垫片(迁移后删除)、图标色彩语义(属独立主题 feature)。 |
| 七、UI 调整纪律 (HeroUI) | ⚠️ Reminder → **实现期强制执行** | 本 spec 触及 `src/components/**/*.tsx`。**所有 UI 改动实现前必须先 `/heroui-react` skill 查询**(HeroUI v3 Popover/Tabs/Button API)。记为实现阶段每张涉及 UI 的 task 的前置步骤。 |
| 技术栈 | ✅ Pass | 零栈变更。`lucide-react@1.23.0` 已安装。 |

**Gate 结论**:全原则通过,无 violation。原则七为 reminder(实现期强制 skill 查询)。**允许 Phase 0/1 继续**。

## Project Structure

### Documentation (this feature)

```text
specs/028-category-lucide-icons/
├── spec.md              # ✅ 已完成
├── plan.md              # 本文件
├── research.md          # Phase 0: emoji→lucide 映射 + 版本验证
├── data-model.md        # Phase 1: 迁移 SQL + 常量文件设计
├── quickstart.md        # Phase 1: 开发者快速上手
├── checklists/
│   └── requirements.md  # ✅ 已完成
└── contracts/           # (本 feature 无 API 契约变更)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── constants/
│       ├── category-emojis.ts      # ❌ 删除(被 category-icons.ts 替换)
│       └── category-icons.ts       # ✨ 新建:矢量图标名白名单 + 分组 + Set
├── components/
│   ├── category/
│   │   ├── category-select.tsx     # 📝 修改:cat.icon → <CategoryIcon>
│   │   └── category-icon.tsx       # ✨ 新建:图标名 → lucide 组件映射 + 兜底
│   ├── settings/
│   │   ├── emoji-picker.tsx        # ❌ 删除(被 icon-picker.tsx 替换)
│   │   ├── icon-picker.tsx         # ✨ 新建:矢量图标选择器(Popover+Tabs)
│   │   ├── category-form.tsx       # 📝 修改:EmojiPicker → IconPicker + 父分类下拉
│   │   └── category-item.tsx       # 📝 修改:node.icon → <CategoryIcon>
│   ├── dashboard/
│   │   ├── category-breakdown.tsx  # 📝 修改:c.categoryIcon → <CategoryIcon>
│   │   ├── top-category-card.tsx   # 📝 修改:c.categoryIcon → <CategoryIcon>
│   │   ├── category-top-list.tsx   # 📝 修改:item.categoryIcon → <CategoryIcon>
│   │   └── recent-transactions.tsx # 📝 修改:t.categoryIcon → <CategoryIcon>
│   ├── reports/
│   │   ├── category-breakdown-card.tsx # 📝 修改:item.categoryIcon → <CategoryIcon>
│   │   └── category-donut.tsx      # 📝 修改:类型含 categoryIcon(如需渲染则用组件)
│   └── transactions/
│       └── transaction-list-item.tsx # 📝 修改:transaction.categoryIcon → <CategoryIcon>
├── lib/
│   └── validators/
│       └── category.ts             # 📝 修改:CATEGORY_EMOJI_SET → CATEGORY_ICON_SET
├── server/
│   ├── api/routers/
│   │   └── category.ts             # 📝 修改:iconSchema 校验集改为图标名
│   ├── domain/category/
│   │   └── rules.ts                # 📝 修改:isCategoryEmoji → isCategoryIcon
│   └── db/
│       └── migrations/
│           ├── 0003_categories.sql # 📝 修改:seed icon 值 emoji → 图标名
│           └── 0008_category_icons.sql # ✨ 新建:数据迁移 UPDATE CASE
└── tests/
    └── (更新既有测试 icon 断言)
```

**Structure Decision**:沿用现有 feature-sliced 布局。`CategoryIcon` 入 `components/category/`(与 `CategorySelect` 同域);`IconPicker` 入 `components/settings/`(与原 `EmojiPicker` 同位);常量入 `lib/constants/`(替换原文件)。

## Implementation Phases

### Phase 0 — Research ✅ (research.md)

- ✅ 验证 `lucide-react@1.23.0` 安装版本 + 183+ 图标名可用
- ✅ 完成 20 内置 seed emoji→图标名映射(见 [research.md](./research.md) §1)
- ✅ 完成 ~120 全量 emoji→图标名映射策略(见 [research.md](./research.md) §2)
- ✅ 确认 HeroUI v3 Popover/Tabs API(024 已适配,沿用)

### Phase 1 — Design ✅ (data-model.md + quickstart.md)

- ✅ `category-icons.ts` 常量文件设计(图标名数组 + 13 域分组 + Set)
- ✅ `CategoryIcon` 组件 API 设计(name + size + className + aria-label)
- ✅ 迁移 SQL 设计(`UPDATE categories SET icon = CASE ... END` + 兜底)
- ✅ `0003_categories.sql` seed 同步方案
- ✅ 开发者快速上手(quickstart.md)

### Phase 2 — Tasks (tasks.md, 待生成)

实现任务按依赖序拆分,每任务可独立提交:

| Task | 优先级 | 依赖 | 概述 |
|------|--------|------|------|
| T0 | P1 | — | 新建 `category-icons.ts`(白名单 + 分组 + Set + emoji→icon 映射表) |
| T1 | P1 | T0 | 新建 `CategoryIcon` 组件(图标名→lucide 映射 + emoji 回退 + 兜底) |
| T2 | P1 | T0 | 更新校验层:`validators/category.ts` + `routers/category.ts` + `domain/category/rules.ts` |
| T3 | P1 | T1 | 替换 ~12 处渲染点:`<span>{icon}</span>` → `<CategoryIcon name={icon} />` |
| T4 | P1 | T0 | 数据迁移:`0008_category_icons.sql` + 同步 `0003_categories.sql` seed |
| T5 | P2 | T0,T1 | 新建 `IconPicker`(替换 `EmojiPicker`),更新 `category-form.tsx` |
| T6 | P1 | T5 | 删除 `emoji-picker.tsx` + `category-emojis.ts`;`grep` 验证零残留 |
| T7 | P1 | T2-T6 | 更新既有测试 icon 断言;新增 CategoryIcon 渲染测试;全量 `pnpm test` 通过 |

## Complexity Tracking

> 无宪章 violation,无需填写。
