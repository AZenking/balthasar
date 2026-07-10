# Component Contracts: 023-category-ui

**状态**: 前端组件契约。本 feature 不暴露 public API,组件契约仅作 tasks 阶段实现参考。

## 新建组件清单 (6 个)

| 组件 | 路径 | 职责 |
|---|---|---|
| CategoryManager | `src/components/settings/category-manager.tsx` | 列表容器 + type/includeArchived 切换 + 新增按钮 + 200 上限检测 |
| CategoryItem | `src/components/settings/category-item.tsx` | 单行(含 children 缩进 + 编辑/归档/拖拽手柄) |
| CategoryForm | `src/components/settings/category-form.tsx` | 新增/编辑共享表单(modal 内) |
| EmojiPicker | `src/components/settings/emoji-picker.tsx` | 分类 tabs + 搜索 + grid + 选中 |
| CategorySelect | `src/components/category/category-select.tsx` | 008 交易表单用,层级分组下拉 |
| useCategoryReorder | `src/components/category/use-category-reorder.ts` (hook) | 拖拽逻辑(optimistic + 间隔耗尽检测) |

## 组件契约

### `<CategoryManager />`(US1-5 容器)

```tsx
<CategoryManager />  // 无 props,内部管理 state
```

**内部 state**:
- `type: "expense" | "income"`(默认 "expense")
- `includeArchived: boolean`(默认 false)
- `showCreateForm: boolean`
- `editingCategoryId: string | null`

**tRPC queries/mutations**:
- `trpc.category.list.useQuery({ type, includeArchived })`
- `trpc.category.create.useMutation({ onSuccess: invalidate })`
- `trpc.category.update.useMutation({ onSuccess: invalidate })`
- `trpc.category.archive.useMutation({ onMutate: optimistic, onError: rollback })`
- `trpc.category.unarchive.useMutation({ onMutate: optimistic, onError: rollback })`

**渲染**:
- type radio (支出/收入切换)
- "显示已归档" checkbox
- "新增分类"按钮(达 200 上限时禁用 + tooltip)
- `<CategoryItem />` 列表(顶级,children 嵌套)
- 空状态提示(无自定义分类时)
- `<Dialog>` 含 `<CategoryForm />`(create/edit mode)

---

### `<CategoryItem />`(US1, US3, US4, US5)

```tsx
type CategoryItemProps = {
  node: CategoryTreeNode;
  isChild?: boolean;       // true = 二级(缩进 + 无拖拽手柄)
  onEdit: (id: string) => void;
  onArchive: (id: string, childCount: number) => void;
  onUnarchive: (id: string, childCount: number) => void;
};
```

**渲染**:
- 拖拽手柄(⋮⋮,仅 active-custom 顶级;内置/二级/已归档无)
- `${icon} ${name}` + 二级缩进(isChild 时)
- 内置:🔒 图标 + 无编辑/归档按钮
- active-custom:"编辑" + "归档" 按钮
- archived-custom:灰显 + "反归档" 按钮
- `children` 递归渲染(缩进)

---

### `<CategoryForm />`(US2, US3)

```tsx
type CategoryFormProps = {
  mode: "create" | "edit";
  defaultValues?: Partial<CategoryFormValues>;  // edit 预填
  categories: CategoryTreeNode[];               // 用于 parent select 选项
  editingCategory?: CategoryTreeNode;           // edit 模式,用于判断限制(type 切换/parent 变更)
  onSubmit: (values: CategoryFormValues) => Promise<void>;
  onCancel: () => void;
};
```

**字段**:
- type radio(支出/收入;选 parent 后锁定为 parent.type)
- name input(1-30 字,trim)
- `<EmojiPicker value onChange />`(白名单)
- parent select(仅顶级分类;过滤:同 type + active + 同家庭)
- sortOrder input(可选,默认 100)

**edit 模式限制**(FR-011..FR-013):
- 已归档 → type + parent 置灰 + 提示
- 已被交易引用 → type 置灰 + 提示
- 已有子分类 → parent 置灰 + 提示

**提交**: zod 校验 → onSubmit → 成功关闭 modal / 失败 toast + 保留表单

---

### `<EmojiPicker />`(US2, US3, Clarify Q2)

```tsx
type EmojiPickerProps = {
  value: string;
  onChange: (emoji: string) => void;
};
```

**渲染**(Popover shell):
- 搜索 input(实时过滤跨所有 group)
- Tabs(食物/交通/购物/... ~10 个,沿用 CATEGORY_EMOJI_GROUPS)
- Grid(8 col × N row,选中 emoji 高亮 ring-2)
- 点击 emoji → onChange + 关闭 popover

---

### `<CategorySelect />`(US6,008 transaction-form 用)

```tsx
type CategorySelectProps = {
  value: string;
  onChange: (categoryId: string) => void;
  type: "income" | "expense";  // 按 type 过滤
};
```

**内部**:
- `trpc.category.list.useQuery({ type })`(返回 tree,archived 已过滤)
- 渲染(Combobox 模式,shadcn `command`):
  - 分组 "内置"(所有 isBuiltIn=true 的顶级)
  - 分组 "自定义"(所有 isBuiltIn=false 的顶级 + 其 children 缩进)
- 受控(value + onChange)

---

### `useCategoryReorder()`(US5 hook)

```tsx
function useCategoryReorder(opts: {
  type: "income" | "expense";
  parentId: string | null;  // 当前拖拽的层级
}): {
  onDragEnd: (event: DragEndEvent) => Promise<void>;
  sensors: SensorConfig;  // @dnd-kit sensors
};
```

**逻辑**:
1. 接收 @dnd-kit `DragEndEvent`(含 active.id + over.id)
2. 计算新位置(prev / next 兄弟的 sortOrder)
3. `computeSortOrder(prev, next)`(018 已有):
   - 返回数字 → 调 `category.update({ id, sortOrder })`(optimistic)
   - 返回 NaN → 调 `category.reorder({ items: renumberSortOrders(N) })`(optimistic)
4. 失败 → react-query `onError` 回滚 + toast

---

## 008 transaction-form 更新(US6)

```diff
- <select {...register("categoryId")}>
-   {categories?.map((c) => <option value={c.id}>{c.icon} {c.name}</option>)}
- </select>
+ <CategorySelect
+   type={selectedType}
+   value={watchCategoryId}
+   onChange={(id) => setValue("categoryId", id, { shouldValidate: true })}
+ />
```

**008 测试更新**:mock `trpc.category.list` 返回**新 shape**(含 children 数组),既有测试逻辑不变。

---

## 不实现的组件 (Out of Scope)

- ❌ `<CategoryDeleteDialog />` —— 不实现硬删除 UI (018 FR-019)
- ❌ `<CategoryMergeDialog />` —— 不实现合并 UI (018 FR-029)
- ❌ `<IconUploader />` —— 不实现图标上传 (018 FR-030)
- ❌ `<CategoryAiSuggest />` —— 不实现 AI 推荐 (V2)
- ❌ `<HideBuiltinToggle />` —— 不实现隐藏内置 (内置永远可见)
