# Tasks: 自定义分类管理 UI (023-category-ui)

**Input**: Design documents from `/specs/023-category-ui/` (spec + plan + research + data-model + contracts + quickstart)

**Prerequisites**: plan.md ✅ / spec.md ✅ / research.md ✅ / data-model.md ✅ / contracts/components.md ✅ / quickstart.md ✅

**Tests**: ✅ Component tests (Vitest + Testing Library) for纯函数组件(EmojiPicker / CategoryForm / CategorySelect);手动浏览器验证覆盖 6 US(与 010 模式一致)。

**Organization**: Tasks grouped by user story (US1-US6 per spec.md priority)。

## Format: `[ID] [P?] [Story?] Description (file path)`

- **[P]**: 可并行(不同文件,无未完成依赖)
- **[Story]**: US1-US6 (Setup/Foundational/Polish 阶段无此 label)
- 所有 task 含**精确文件路径**
- 实现遵循 Constitution v2.0.0(Feature-Sliced + tRPC client + react-query + react-hook-form)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 安装依赖 + 准备共享常量 + zod schema。

- [X] T001 [P] Install DnD + toast + icon deps in `package.json` — `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities sonner lucide-react`。验证 `pnpm install` 成功 + `pnpm tsc --noEmit` 0 错误。
- [ ] T002 [P] Add shadcn components via CLI — `pnpm dlx shadcn@latest add dialog select tabs popover radio-group checkbox command tooltip`。验证 `src/components/ui/` 含 dialog.tsx / select.tsx / tabs.tsx / popover.tsx / radio-group.tsx / checkbox.tsx / command.tsx / tooltip.tsx。
- [X] T003 [P] Add Toaster to root layout in `src/app/layout.tsx` — import `sonner` `<Toaster />` 放在 `<body>` 末尾,配置 `richColors / position="top-center"`。验证 toast 在任意页面可触发。
- [X] T004 [P] Add emoji group metadata to `src/lib/constants/category-emojis.ts` — 018 已有 `CATEGORY_EMOJIS` 扁平数组 + 12 个分组常量(FOOD/TRANSPORT/...)。新增导出 `CATEGORY_EMOJI_GROUPS` 数组(含 `id` / `label` / `emojis`),保留原 `CATEGORY_EMOJIS` 不破坏 018。详见 [research.md D6](./research.md#d6-emoji-picker--自建组件popover--tabs--grid--search)。
- [X] T005 [P] Create zod validators in `src/lib/validators/category.ts` — 导出 `categoryCreateSchema` + `categoryUpdateSchema`(沿用 018 后端 procedure 的字段约束:type enum / name 1-30 trim / icon 白名单 refine / parentId uuid optional / sortOrder int optional)+ 类型 `CategoryFormValues`。详见 [data-model.md](./data-model.md)。

**Checkpoint**: 共享基础设施就绪,可进入路由 + 组件实现。

---

## Phase 2: Foundational (Route + Entry)

**Purpose**: 新建 `/settings/categories` 路由 + `/settings` 页加入口卡片。**阻塞性**,所有 US 依赖此。

- [X] T006 Create categories route page in `src/app/(app)/settings/categories/page.tsx` — `"use client"` 页,渲染 `<CategoryManager />`(Phase 3 创建),页面负责 `<Card>` 外壳 + 标题"分类管理"。可暂用占位 `<div>TODO</div>`,Phase 3 替换为真实组件。
- [X] T007 Update settings entry in `src/app/(app)/settings/page.tsx` — 加"分类管理"入口卡片(类似 010 已有的"账户管理"+"API Key 管理"),用 `<Card>` + 链接 `/settings/categories` + lucide `Tags` 图标。保留既有账户管理 + API Key + 登出。

**Checkpoint**: 路由可达 + 入口可见。US1-US6 可并行开工(若团队容量允许)。

---

## Phase 3: User Story 1 — 查看分类列表 (Priority: P1) 🎯 MVP

**Goal**: 用户在 `/settings/categories` 看到层级列表(内置+自定义,二级嵌套,type/includeArchived 切换)。

**Independent Test**: 登录 → `/settings/categories` → 默认支出 type + 隐藏归档 → 看到内置 🔒 + 自定义 → 切收入 type → 勾选"显示已归档"。

### Implementation

- [X] T008 [P] [US1] Create CategoryItem component in `src/components/settings/category-item.tsx` — 单行展示:`${icon} ${name}` + 二级缩进(`isChild` prop)。内置(isBuiltIn=true)显示 🔒 + 无编辑/归档/拖拽手柄。active-custom 显示"编辑"+"归档"按钮(callbacks)。archived-custom 灰显 + "反归档"按钮。接收 `{ node: CategoryTreeNode; isChild?: boolean; onEdit; onArchive; onUnarchive }`。**递归渲染 children**(若 node.children 非空)。详见 [contracts/components.md#categoryitem](./contracts/components.md#categoryitem)。
- [X] T009 [P] [US1] Create CategoryManager component in `src/components/settings/category-manager.tsx` — `"use client"` 容器。内部 state:`type`(默认 expense)/ `includeArchived`(默认 false)/ `showCreateForm` / `editingCategoryId`。调 `trpc.category.list.useQuery({ type, includeArchived })`。渲染:type radio(支出/收入,shadcn RadioGroup)+ "显示已归档" Checkbox + "新增分类" Button(占位,Phase 4 接 create mutation)+ 列表(`data.map(node => <CategoryItem node={node} onEdit onArchive onUnarchive />)`)+ 空状态(无自定义时"还没有自定义分类,点击'新增'开始")+ `<Skeleton>` loading。详见 [contracts/components.md#categorymanager](./contracts/components.md#categorymanager)。
- [X] T010 [US1] Wire CategoryManager into page in `src/app/(app)/settings/categories/page.tsx` — 替换 T006 占位,渲染 `<CategoryManager />`。
- [X] T011 [US1] Verify US1 list rendering — 浏览器手动:登录 → `/settings/categories` → 验证 [quickstart 场景 1+2](./quickstart.md) 全部通过(入口跳转 / 列表展示 / type 切换 / includeArchived / 内置 🔒 / 二级嵌套 / 空状态)。

**Checkpoint**: US1 完成,MVP 可见(列表 + 切换)。用户能看到自定义分类,但还不能增删改(后续 US)。

---

## Phase 4: User Story 2 — 新增自定义分类 (Priority: P1) 🎯 MVP

**Goal**: 用户点"新增分类" → 表单 → 提交 → 列表更新。

**Independent Test**: 点新增 → 表单(type/name/emoji picker/parent/sortOrder)→ 校验 → 提交 → toast "已创建" + 列表含新分类 → 进交易表单 categoryId 下拉含该分类(US6 完成后)。

### Implementation

- [ ] T012 [P] [US2] Create EmojiPicker component in `src/components/settings/emoji-picker.tsx` — `"use client"` Popover 触发器(显示当前选中 emoji 或 placeholder)→ PopoverContent 含:搜索 `<Input>`(实时 filter)+ `<Tabs>`(沿用 `CATEGORY_EMOJI_GROUPS` ~10 类)+ Grid(`<button>` × emojis,选中高亮 `ring-2`)+ 点击 emoji → `onChange(emoji)` + 关闭 popover。8 列 × N 行 grid,emoji button `min-w-[44px] min-h-[44px]`(触屏可达)。详见 [contracts/components.md#emojipicker](./contracts/components.md#emojipicker) + [research.md D6](./research.md#d6-emoji-picker--自建组件popover--tabs--grid--search)。
- [ ] T013 [P] [US2] Create CategoryForm component in `src/components/settings/category-form.tsx` — `"use client"` react-hook-form + zod(T005 schema)。Props:`{ mode: "create"|"edit"; defaultValues?; categories: CategoryTreeNode[]; editingCategory?; onSubmit; onCancel }`。字段:type RadioGroup(支出/收入)+ name Input(1-30 trim)+ `<EmojiPicker value onChange />`(RHF Controller 包)+ parent Select(仅顶级,过滤同 type + active + 同家庭,shadcn Select)+ sortOrder Input(可选,默认 100)。create 模式全字段可填。校验失败禁用提交按钮 + 红字提示。提交 → `onSubmit(values)`。详见 [contracts/components.md#categoryform](./contracts/components.md#categoryform)。
- [ ] T014 [US2] Wire create mutation in CategoryManager — 加 `trpc.category.create.useMutation`。`showCreateForm` 时渲染 `<Dialog open><CategoryForm mode="create" onSubmit={async (v) => { await createMutation.mutateAsync(v); }} /></Dialog>`。`onSuccess`:`utils.category.list.invalidate()` + 关闭 dialog + `toast.success("已创建")`。`onError`:`toast.error(err.message)` + **保留表单不关 dialog**(server-first,FR-024a)。详见 [research.md D7](./research.md#d7-optimistic-更新--react-query-onmutateonerror-模式)。
- [X] T015 [US2] Add 200 cap detection in CategoryManager — `trpc.category.list.useQuery` 数据长度 ≥ 200(注意:list 返回含内置,需 filter `!isBuiltIn` 后计数)→ "新增分类" Button `disabled` + shadcn `<Tooltip>` "已达上限 200"。FR-025。
- [ ] T016 [US2] Verify US2 create flow — 浏览器手动:[quickstart 场景 3](./quickstart.md)(新增 happy path + 校验失败 + 200 上限 + 重名冲突)。

**Checkpoint**: MVP 完整可见可写(列表 + 新增)。用户能创建自定义分类。

---

## Phase 5: User Story 3 — 编辑自定义分类 (Priority: P1)

**Goal**: 用户点"编辑" → 表单预填 → 受限于 018 FR-008..FR-014 的字段 → 提交 → 列表更新。

**Independent Test**: 创建分类 → 点编辑 → 改名 → 提交 → toast "已保存" + 列表更新 → 尝试编辑内置(无按钮)→ 尝试改已归档分类 type(置灰)。

### Implementation

- [ ] T017 [US3] Extend CategoryForm for edit mode in `src/components/settings/category-form.tsx` — edit 模式预填 `defaultValues`。**字段限制**(基于 `editingCategory` prop,FR-011 + FR-013;FR-012 走乐观不置灰,见下):
  - `editingCategory.archivedAt !== null` → type RadioGroup + parent Select `disabled` + 提示"已归档分类不可改 type/parentId"(FR-011)
  - **FR-012 不预置灰 type**:已被交易引用的状态 UI 无从得知(018 list 不含 hasTransactions)。用户改 type + 提交时,后端 018 FR-013 拒绝 400 → 前端 toast "已被交易引用,不可切换 type" + **保留表单**(乐观策略,Clarify Q3)
  - `editingCategory.children.length > 0` → parent Select `disabled` + 提示"已有子分类不可变为二级"(FR-013,children count 从 list tree 取)
- [ ] T018 [US3] Wire update mutation in CategoryManager — 加 `trpc.category.update.useMutation`。`editingCategoryId` state:`<CategoryItem onEdit={(id) => setEditingCategoryId(id)} />`。`editingCategoryId` 时渲染 `<Dialog><CategoryForm mode="edit" defaultValues={findNode(id)} editingCategory={findNode(id)} onSubmit={async (v) => { await updateMutation.mutateAsync({ id: editingCategoryId, ...v }); }} /></Dialog>`。`onSuccess`:`invalidate` + 关闭 + `toast.success("已保存")`。`onError`:toast + 保留表单(server-first)。FR-014。
- [ ] T019 [US3] Verify US3 edit flow — 浏览器手动:[quickstart 场景 4](./quickstart.md)(改名 + 内置无按钮 + 已归档限制 + 已引用限制 + 有子限制 + 重名)。

**Checkpoint**: US1+US2+US3 完整,P1 写闭环(列表 + 新增 + 编辑)。

---

## Phase 6: User Story 4 — 归档与反归档 (Priority: P2)

**Goal**: 用户归档不再使用的分类(级联子),反归档时强制复活所有子。

**Independent Test**: 创建父+2子 → 独立归档子A → 归档父(级联子B) → toast 含数 → 反归档父 → 所有子复活(含A)。

### Implementation

- [ ] T020 [US4] Wire archive mutation (optimistic) in CategoryManager — 加 `trpc.category.archive.useMutation`。`onMutate`:本地从 list cache 移除该分类 + 其子(optimistic)。`onError`:回滚 + `toast.error("操作失败,已恢复")`(FR-024b + Edge Case "Optimistic 回滚")。`onSuccess`:`invalidate` + `toast.success(\`已归档${childCount > 0 ? `(含 ${childCount} 个子分类)` : ""}\`)`(FR-016 级联提示文案)。CategoryItem `onArchive(id, childCount)` callback → 弹 shadcn `<AlertDialog>` 确认框 → 确认调 `archiveMutation.mutate({ id })`。详见 [research.md D7](./research.md#d7-optimistic-更新--react-query-onmutateonerror-模式)。
- [ ] T021 [US4] Wire unarchive mutation (optimistic) in CategoryManager — 加 `trpc.category.unarchive.useMutation`。逻辑对称 archive:`onMutate` 本地恢复显示(需先存 before snapshot 含 archived 状态)→ `onError` 回滚 → `onSuccess` invalidate + `toast.success(\`已恢复(含 ${N} 个子分类,含此前独立归档的)\`)`(FR-018)。仅"显示已归档"模式下可见的已归档分类有"反归档"按钮。`onUnarchive(id, childCount)` callback → 直接调(无需确认框,反归档无破坏性)。
- [ ] T022 [US4] Verify US4 archive flows — 浏览器手动:[quickstart 场景 5](./quickstart.md)(归档父级联 + idempotent + 反归档强制复活 + 失败回滚)。

**Checkpoint**: US1-4 完整。列表 + 增 + 改 + 归档全闭环。

---

## Phase 7: User Story 5 — 拖拽排序 (Priority: P2)

**Goal**: 用户拖拽同级分类调整顺序,间隔策略自动算 sortOrder,耗尽时调 reorder。

**Independent Test**: 3 同级(sortOrder 10/20/30)→ 拖 C 到 A/B 间 → C.sortOrder=15 → 多次拖耗尽 → 自动重排 10/20/30。

### Implementation

- [ ] T023 [P] [US5] Create useCategoryReorder hook in `src/components/category/use-category-reorder.ts` — 导出 `useCategoryReorder({ type, parentId })` 返回 `{ onDragEnd, sensors }`。`onDragEnd(event)`:(1) 取 active.id + over.id;(2) 找 prev/next 兄弟的 sortOrder;(3) 调 018 `computeSortOrder(prev, next)`(import from `@/server/domain/category/rules`):返回数字 → 调 `trpc.category.update.mutate({ id, sortOrder })`(optimistic);返回 NaN → 调 `trpc.category.reorder.mutate({ items: renumberSortOrders(N).map((so, i) => ({ id: siblings[i].id, sortOrder: so })) })`(optimistic)。失败:`onError` 回滚 + toast。sensors:PointerSensor(activationConstraint distance 8px,防误触)+ KeyboardSensor。详见 [research.md D7+D1](./research.md) + [contracts/components.md#usecategoryreorder](./contracts/components.md#usecategoryreorder)。
- [ ] T024 [US5] Integrate @dnd-kit into CategoryManager in `src/components/settings/category-manager.tsx` — 包裹顶级分类列表(`<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder.onDragEnd}><SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>{topLevel.map(node => <SortableCategoryItem />)}</SortableContext></DndContext>`)。二级 children 暂不支持拖拽(深度限制,只能重排顶级)。跨 type/cross-level 检查:`onDragEnd` 内若 active.type !== over.type 或 active.parentId !== over.parentId → toast "不能跨 type/级 排序" + return。
- [ ] T025 [US5] Add drag handle to CategoryItem — CategoryItem 加 `draggable?: boolean` prop(true 时渲染 `lucide-react GripVertical` 手柄 + `useSortable({ id: node.id })`)。内置 / 已归档 / 二级分类 `draggable=false`(无手柄)。拖拽中行 opacity-50 + cursor-grabbing。
- [ ] T026 [US5] Verify US5 drag-drop — 浏览器手动:[quickstart 场景 6](./quickstart.md)(间隔足够 single-update + 间隔耗尽 full-renumber + 拒绝跨 type/级 + 内置不可拖 + 移动端长按)。

**Checkpoint**: US1-5 完整。分类管理全闭环(列表 + 增 + 改 + 归档 + 拖拽)。

---

## Phase 8: User Story 6 — 交易表单 categoryId 下拉更新 (Priority: P1)

**Goal**: 008 transaction-form 的 categoryId 下拉改用新 `category.list` 接口,显示内置+自定义+层级。

**Independent Test**: 创建自定义分类 → 进 /transaction/new → categoryId 下拉含"内置"+"自定义"分组 + 二级缩进 → 选自定义分类 → 提交交易成功。

### Implementation

- [ ] T027 [P] [US6] Create CategorySelect component in `src/components/category/category-select.tsx` — `"use client"` Combobox(shadcn `command` + `popover`)。Props:`{ value; onChange; type }`。内部 `trpc.category.list.useQuery({ type })`(返回 tree)。渲染分组:command list 内用 `<CommandGroup heading="内置">`(所有 isBuiltIn=true 顶级)+ `<CommandGroup heading="自定义">`(所有 isBuiltIn=false 顶级 + 其 children 缩进显示)。`<CommandItem onSelect={(id) => onChange(id)}>${icon} ${name}</CommandItem>`。二级 children 缩进 `pl-4`。已归档后端已过滤(默认 includeArchived=false)。详见 [contracts/components.md#categoryselect](./contracts/components.md#categoryselect) + [research.md D5+D9](./research.md)。
- [ ] T028 [US6] Replace categoryId select in 008 transaction-form in `src/components/transaction/transaction-form.tsx` — 找到现有 categoryId `<select>{categories?.map(...)}</select>`,替换为 `<CategorySelect type={selectedType} value={watchCategoryId} onChange={(id) => setValue("categoryId", id, { shouldValidate: true })} />`。保留 RHF register/validation。移除 form 内的 `trpc.category.list.useQuery`(移入 CategorySelect 内部)。
- [ ] T029 [US6] Update 008 test mocks in `src/tests/integration/transaction/*.test.ts` + `src/tests/procedure/transaction.test.ts` — 008 既有测试 mock `trpc.category.list` 返回**旧扁平结构**(Category[]),需更新为**新树结构**(CategoryTreeNode[] 含 children)。既有断言逻辑不变(只改 mock 数据 shape)。若有 procedure 测试 mock `findAllCategories`,同样适配 018 新返回。验证 `pnpm test -- transaction` 全绿。
- [ ] T030 [US6] Verify US6 transaction dropdown — 浏览器手动:[quickstart 场景 7](./quickstart.md)(分组渲染 + 二级缩进 + type 过滤 + 归档隐藏 + 选自定义创建交易)。

**Checkpoint**: 全部 6 US 完整。端到端闭环(分类管理 + 交易记账使用自定义分类)。

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 组件测试 + 响应式/暗色/a11y 验证 + 最终质量门。

- [ ] T031 [P] Write component tests in `src/tests/unit/components/category/` — (a) `emoji-picker.test.tsx`:tab 切换 / 搜索过滤 / 选中高亮 / 白名单限制 / 空结果;(b) `category-form.test.tsx`:create happy / 校验失败(空 name/超长/非白名单 emoji)/ parent 锁 type / 已归档限制 / 重名 toast;(c) `category-select.test.tsx`:分组渲染(内置/自定义)/ 二级缩进 / type 过滤 / 归档隐藏。Vitest + Testing Library,@testing-library/react 已安装。详见 [quickstart.md 组件测试](./quickstart.md)。
- [ ] T032 [P] Responsive + dark mode verification — Chrome DevTools:(a) iPhone SE 375px 列表单列 + 表单 modal 全屏 + emoji picker bottom sheet;(b) iPad 768px 双列?(若设计);(c) 暗色模式切换(若有 toggle,否则用 `prefers-color-scheme: dark`)→ contrast ≥ WCAG AA 4.5:1。FR-027。
- [ ] T033 Keyboard navigation + a11y verification — Tab 遍历所有交互元素(新增/编辑/归档/emoji picker/parent select);Enter 提交表单;Esc 关闭 dialog;drag handle 用 @dnd-kit KeyboardSensor 方向键移动。屏幕阅读器(VoiceOver)测试列表结构语义化(ul/li + aria-label)。FR-021 + FR-028。
- [ ] T034 Run quickstart.md 9 scenarios manually — 浏览器逐场景跑 [quickstart.md](./quickstart.md) 场景 1-9,每场景截图或录屏归档到 PR 描述。覆盖:入口 / 列表 / 新增 / 编辑 / 归档级联 / 拖拽策略 / 交易下拉 / emoji picker / 响应式+暗色+键盘。
- [ ] T035 Final quality gate — `pnpm tsc --noEmit` 0 错误 / `pnpm lint` 0 errors(allow warnings)/ `pnpm test` 全套绿(含 018 既有 + 008 更新 mock 后 + 023 新组件测试)。审查 SC 性能基线(列表渲染 P95 < 500ms / emoji picker < 100ms / 拖拽 < 300ms < 800ms)。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,5 个 [P] 任务可全部并行(deps / shadcn / Toaster / emoji groups / validators)
- **Foundational (Phase 2)**: 依赖 Phase 1;**BLOCKS** 所有 US(路由 + 入口)
- **US1-US6 (Phase 3-8)**: 均依赖 Phase 2 完成
  - US1 是 US2-US5 的容器(列表组件 CategoryManager 是其他 US 的修改对象)→ US1 优先
  - US2 是 US3-US5 测试数据的来源(需先有自定义分类才能 edit/archive/reorder)
  - US6 独立于 US1-US5,可与 US1-US5 并行(只改 008 transaction-form)
- **Polish (Phase 9)**: 依赖所有 US 完成

### User Story Dependencies

| Story | 优先级 | 依赖 | 可并行? |
|---|---|---|---|
| US1 列表 | P1 🎯 MVP | Foundation | 是 (基线) |
| US2 新增 | P1 🎯 MVP | Foundation + US1(列表容器) | 是 |
| US3 编辑 | P1 | Foundation + US1 + US2(测试数据) | 是 |
| US4 归档 | P2 | Foundation + US1 + US2 | 是 |
| US5 拖拽 | P2 | Foundation + US1 + US2 | 是 |
| US6 交易下拉 | P1 🎯 MVP | Foundation(独立于 US1-US5) | 是 (可与 US1-US5 完全并行) |

### Within Each User Story

1. 子组件先(P 标记,可并行)
2. 容器/接入(串行,依赖子组件)
3. 浏览器验证(最后)

### Parallel Opportunities

- **Phase 1**:T001-T005 完全并行(5 个不同文件/操作)
- **Phase 3-4**:T008(CategoryItem)+ T009(CategoryManager)+ T012(EmojiPicker)+ T013(CategoryForm)4 个组件可并行(不同文件)
- **Phase 8 US6**:T027(CategorySelect)与 Phase 3-7 完全独立,可由另一开发者并行
- **Phase 9**:T031 组件测试 + T032 响应式 + T033 a11y 文档化并行;T034/T035 串行

---

## Parallel Example: US2 新增分类

```bash
# 并行起 4 个组件/接入任务:
Task: "T012 [US2] EmojiPicker component"
Task: "T013 [US2] CategoryForm component"

# 等组件完成后,串行:
Task: "T014 [US2] Wire create mutation in CategoryManager"
Task: "T015 [US2] Add 200 cap detection"

# 最后:
Task: "T016 [US2] Browser verify create flow"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US6)

1. Phase 1 Setup(5 任务,~30 分钟,含 pnpm install)
2. Phase 2 Foundation(2 任务,~30 分钟,路由 + 入口)
3. Phase 3 US1 列表(4 任务,~2 小时,CategoryItem + CategoryManager + 接入 + 验证)
4. Phase 4 US2 新增(5 任务,~3 小时,EmojiPicker + CategoryForm + create mutation + 200 cap + 验证)
5. Phase 8 US6 交易下拉(4 任务,~2 小时,CategorySelect + 替换 008 + 测试适配 + 验证)
6. **STOP & VALIDATE**:用户能在 /settings/categories 增 + 在交易表单用 → 核心闭环可用,可合并发 v0.3.0

### Incremental Delivery

1. Foundation → 路由可达 ✅
2. + US1 → 列表可见 ✅
3. + US2 → 可创建自定义分类 ✅
4. + US6 → 可在交易中使用自定义分类(端到端闭环)✅
5. + US3 → 可编辑(纠错)✅
6. + US4 → 可归档(清理下拉)✅
7. + US5 → 可拖拽排序(优化体验)✅
8. Polish → 组件测试 + 响应式 + a11y + 质量门 ✅

### Suggested Commit Cadence

- Phase 1: 1 commit (`chore(023): install deps + shadcn + emoji groups + validators`)
- Phase 2: 1 commit (`feat(023): /settings/categories route + entry card`)
- US1: 1 commit (`feat(023): US1 category list with hierarchy + filters`)
- US2: 1 commit (`feat(023): US2 create custom category + emoji picker`)
- US3: 1 commit (`feat(023): US3 edit with FR-008..014 restrictions`)
- US4: 1 commit (`feat(023): US4 archive/unarchive with cascade + optimistic`)
- US5: 1 commit (`feat(023): US5 drag-drop reorder with @dnd-kit`)
- US6: 1 commit (`feat(023): US6 transaction form category select + 008 test mocks`)
- Phase 9: 1 commit (`test(023): component tests + a11y + quality gate`)

---

## Notes

- 所有 task 严格遵循 `[ID] [P?] [Story?] Description (file path)` 格式
- [P] 标记的任务在不同文件,无未完成依赖 → 可并行
- 每个 US 内 子组件 → 接入 → 验证 是顺序闭环
- 008 transaction-form 测试 mock 必须更新适配 018 list 新 shape(T029),否则 008 既有测试会 fail
- 手动浏览器验证为主(与 010 模式一致),组件测试覆盖纯逻辑组件(EmojiPicker / CategoryForm / CategorySelect)
- DnD 用 @dnd-kit(D1 决策),不自造
- mutation 策略混合(D7):create/update server-first;archive/unarchive/reorder optimistic + rollback
- 性能 SC(列表 < 500ms / emoji picker < 100ms / 拖拽 < 300ms < 800ms)在 T035 最终验证
