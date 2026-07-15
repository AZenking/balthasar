# Tasks: 分类图标全量迁移 emoji → lucide-react

**Input**: Design documents from `/specs/028-category-lucide-icons/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1(渲染层) / US2(数据迁移) / US3(选择器)

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: 图标白名单常量 + CategoryIcon 渲染组件,所有后续任务依赖此阶段。

**⚠️ CRITICAL**: US1/US2/US3 均依赖 T001 + T002。

- [ ] T001 [US1] 新建 `src/lib/constants/category-icons.ts`:
  - 从 `lucide-react` 导入 ~80 个图标组件
  - 构建 `CATEGORY_ICON_MAP: Record<string, LucideIcon>`(图标名→组件)
  - 派生 `CATEGORY_ICONS`(白名单数组)+ `CATEGORY_ICON_SET`(O(1) 校验集)
  - 构建 `CATEGORY_ICON_GROUPS`(13 域分组,picker tab 用)
  - 构建 `EMOJI_TO_ICON`(~120 条 emoji→图标名映射,迁移+回退用)
  - 导出 `isCategoryIcon(value)` 校验函数
  - 参照 `data-model.md` §2 + `research.md` §2-3

- [ ] T002 [US1] [P] 新建 `src/components/category/category-icon.tsx`:
  - `CategoryIcon({ name, size=20, className, "aria-label" })` 组件
  - 查 `CATEGORY_ICON_MAP[name]` → 渲染 lucide SVG 组件
  - 未命中 → 渲染兜底图标(`CircleHelp`),不抛错
  - 装饰性默认 `aria-hidden=true`;传 `aria-label` 时可见
  - 参照 `research.md` §4 + `quickstart.md` §1

**Checkpoint**: 常量+组件就绪,可独立测试(`CategoryIcon` 渲染 svg)

---

## Phase 2: User Story 1 — 矢量图标渲染层 + 校验 (Priority: P1) 🎯 MVP

**Goal**: 所有渲染分类图标的位置统一使用 `CategoryIcon`,校验层从 emoji 集改为图标名集。

**Independent Test**: `pnpm type-check` + `pnpm lint` 通过;`grep -rE '<span[^>]*>\{[^}]*(cat|node|t|item|c)\.icon' src/components/` 返回 0 匹配。

### 校验层更新

- [ ] T003 [US1] [P] 更新 `src/lib/validators/category.ts`:
  - `CATEGORY_EMOJI_SET` → `CATEGORY_ICON_SET`
  - import 从 `category-emojis` → `category-icons`
  - 错误信息改为"图标必须来自内置图标库"

- [ ] T004 [US1] [P] 更新 `src/server/api/routers/category.ts`:
  - `iconSchema` 的 refine 从 `isCategoryEmoji` → `isCategoryIcon`
  - import 从 `domain/category/rules` → `lib/constants/category-icons`
  - create + update procedure 的 input schema

- [ ] T005 [US1] [P] 更新 `src/server/domain/category/rules.ts`:
  - `isCategoryEmoji` → `isCategoryIcon`(或新增,保留旧函数标 deprecated)

### 渲染点替换(8 个组件,可并行)

- [ ] T006 [US1] [P] 替换 `src/components/category/category-select.tsx`:
  `<span>{cat.icon}</span>` → `<CategoryIcon name={cat.icon} size={16} />`

- [ ] T007 [US1] [P] 替换 `src/components/settings/category-item.tsx`:
  `<span className="shrink-0 text-lg">{node.icon}</span>` → `<CategoryIcon name={node.icon} size={20} />`

- [ ] T008 [US1] [P] 替换 `src/components/transactions/transaction-list-item.tsx`:
  `<span className="text-xl">{transaction.categoryIcon}</span>` → `<CategoryIcon name={transaction.categoryIcon ?? "circle-help"} size={20} />`

- [ ] T009 [US1] [P] 替换 `src/components/dashboard/recent-transactions.tsx`:
  `<span className="text-xl">{t.categoryIcon}</span>` → `<CategoryIcon name={t.categoryIcon ?? "circle-help"} size={20} />`

- [ ] T010 [US1] [P] 替换 `src/components/dashboard/category-breakdown.tsx`:
  `<span className="text-base">{c.categoryIcon}</span>` → `<CategoryIcon name={c.categoryIcon} size={18} />`

- [ ] T011 [US1] [P] 替换 `src/components/dashboard/top-category-card.tsx`:
  `{c.categoryIcon ? <span>...</span> : null}` → `{c.categoryIcon ? <CategoryIcon name={c.categoryIcon} size={18} /> : null}`

- [ ] T012 [US1] [P] 替换 `src/components/dashboard/category-top-list.tsx`:
  `{item.categoryIcon ?? ""}` → `<CategoryIcon name={item.categoryIcon ?? "circle-help"} size={16} />`

- [ ] T013 [US1] [P] 替换 `src/components/reports/category-breakdown-card.tsx`:
  `{item.categoryIcon ? <span>...</span> : null}` → `<CategoryIcon name={item.categoryIcon ?? "circle-help"} size={20} />`

**Checkpoint**: 渲染层全量替换完成。所有图标渲染为 `<svg>`,旧 emoji 值走兜底(不破图)。

---

## Phase 3: User Story 2 — 既有数据迁移 (Priority: P1) 🎯 MVP

**Goal**: `categories.icon` 列内容从 emoji 字符 → lucide 图标名;seed 同步。

**Independent Test**: 迁移后 `SELECT icon FROM categories WHERE icon ~ '[^\x00-\x7F]'` 返回 0 行;行数不变。

- [ ] T014 [US2] [P] 新建 `src/server/db/migrations/0008_category_icons.sql`:
  - `UPDATE categories SET icon = CASE icon WHEN '🍔' THEN 'utensils' ... ELSE 'circle-help' END`
  - 全量 ~120 条 CASE(从 `data-model.md` §3 生成)
  - 兜底 `ELSE 'circle-help'`

- [ ] T015 [US2] 更新 `src/server/db/migrations/0003_categories.sql`:
  - 20 个内置分类的 icon 值从 emoji → 图标名
  - 保持 `ON CONFLICT DO NOTHING` 幂等
  - 参照 `data-model.md` §4

**Checkpoint**: 数据迁移完成。新部署直接用图标名;既有部署经 0008 迁移。

---

## Phase 4: User Story 3 — 矢量图标选择器 IconPicker (Priority: P2)

**Goal**: `IconPicker` 替换 `EmojiPicker`,沿用 Popover+Tabs 骨架,网格换为 lucide 图标。

**Independent Test**: `/settings/categories` → 新增/编辑 → 点图标 → 弹出 Popover 含 Tabs + 搜索 + 图标网格;搜索"car"能定位;选中后触发器显示矢量图标。

- [ ] T016 [US3] 新建 `src/components/settings/icon-picker.tsx`:
  - 沿用 `EmojiPicker` 的 Popover + Tabs + 搜索骨架
  - 网格内容从 emoji 字符 → `<CategoryIcon name={icon} size={24} />`
  - 数据源从 `CATEGORY_EMOJI_GROUPS` → `CATEGORY_ICON_GROUPS`
  - 搜索匹配图标名(如 `car`)或中文域标签(如"交通")
  - 触发器显示当前 `<CategoryIcon>`(替换 `{value || "❓"}`)
  - **前置**:查 `/heroui-react` skill 确认 Popover/Tabs API(宪章原则七)

- [ ] T017 [US3] 更新 `src/components/settings/category-form.tsx`:
  - `EmojiPicker` → `IconPicker`(import + JSX)
  - 父分类下拉 SelectItem 中 `{c.icon} {c.name}` → `<CategoryIcon name={c.icon} size={16} /> {c.name}`

**Checkpoint**: 用户可通过 IconPicker 选择矢量图标新建/编辑分类。

---

## Phase 5: Cleanup & Verification

**Purpose**: 删除旧文件 + grep 验证零残留 + 测试更新。

- [ ] T018 删除 `src/components/settings/emoji-picker.tsx`
- [ ] T019 删除 `src/lib/constants/category-emojis.ts`
- [ ] T020 验证 `grep -r "EmojiPicker" src/` 返回 0 匹配
- [ ] T021 验证 `grep -r "category-emojis" src/` 返回 0 匹配
- [ ] T022 [P] 验证 `grep -rE '<span[^>]*>\{[^}]*(cat|node|t|item|c)\.icon' src/components/` 返回 0 匹配
- [ ] T023 更新既有测试 icon 断言(emoji → 图标名):
  - `tests/procedure/transaction.test.ts` 中 icon 值
  - `tests/integration/` 中 category seed icon 值
  - 其他引用 `CATEGORY_EMOJI` / emoji 字符的测试
- [ ] T024 [P] 新增 `CategoryIcon` 渲染测试:正常/兜底/aria-hidden
- [ ] T025 `pnpm type-check` + `pnpm lint` + `pnpm test` 全量通过

---

## Dependencies & Execution Order

```
T001 (常量) ──┬──→ T002 (组件) ──→ T006-T013 (渲染点,并行)
              ├──→ T003-T005 (校验,并行)
              ├──→ T014-T015 (迁移,可并行)
              └──→ T016-T017 (IconPicker)

T016-T017 ──→ T018-T019 (删除旧文件)
T006-T013 + T003-T005 + T014-T015 ──→ T020-T025 (验证+测试)
```

### Parallel Opportunities

- T002 可与 T001 并行(组件先写,常量后填)
- T003/T004/T005 校验层三个文件可并行
- T006-T013 八个渲染点可并行(不同文件)
- T014/T015 迁移 SQL 和 seed 可并行
- T022/T024 验证和测试可并行
