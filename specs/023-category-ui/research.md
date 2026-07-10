# Research: 自定义分类管理 UI (023-category-ui)

**Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 决策清单

### D1: 拖拽库 —— @dnd-kit/core + @dnd-kit/sortable

**Decision**: `@dnd-kit/core` + `@dnd-kit/sortable`(modern,React 19 兼容,内置 a11y / 键盘 / 触屏支持)。

**Rationale**:
- React 19 兼容(`react-beautiful-dnd` 已停止维护,React 19 有 peer dep 警告)
- 内置键盘导航(Tab + 方向键,FR-021 a11y 要求)
- 触屏支持(onDragStart 长按触发,FR-021 mobile 要求)
- 包大小 ~15KB gzipped,可接受
- sortable preset 提供列表重排的标准模式

**Alternatives Rejected**:
- ❌ `react-beautiful-dnd`:已停维护(2023 起),React 19 兼容性差
- ❌ 原生 HTML5 DnD:无触屏支持(需手动 polyfill)+ 无键盘 a11y
- ❌ `react-dnd`:更底层,需自己写 sortable 逻辑,YAGNI

### D2: 表单库 —— react-hook-form + zod(沿用 010)

**Decision**: `react-hook-form` + `@hookform/resolvers/zod`(已安装)+ `zod` schema 在 `src/lib/validators/category.ts`。

**Rationale**: 010/008 已用此组合,模式一致。zod schema 可前后端共享(后端 procedure 的 input schema 已有,前端 import 同一份)。

### D3: Modal/Dialog —— shadcn Dialog(Radix-based)

**Decision**: shadcn `dialog` 组件(基于 Radix UI)用于新增/编辑分类表单的 modal。

**Rationale**:
- Radix 提供 a11y(focus trap / Escape 关闭 / aria 属性)
- 桌面 modal + 移动端 bottom sheet 通过 CSS 响应式实现
- 与既有 shadcn components(button/input/card)风格统一

### D4: Toast —— sonner

**Decision**: `sonner`(shadcn 推荐的 toast 库)用于操作反馈(创建/编辑/归档/反归档/重排 + 错误)。

**Rationale**:
- shadcn/ui 官方推荐 toast 方案(替代 deprecated `react-hot-toast`)
- 轻量(~5KB),API 简洁(`toast.success("已创建")`)
- 支持 promise / loading / error 状态
- 与 Next.js App Router 兼容(`<Toaster />` 在 root layout)

**Alternatives Rejected**:
- ❌ `react-hot-toast`:shadcn 已弃用
- ❌ 自建 toast:YAGNI,重复造轮子

### D5: Select —— shadcn Select(简单) + 自建 CategorySelect(层级)

**Decision**:
- **简单 select**(type 切换支出/收入):shadcn `select`(Radix-based,styled)
- **分类下拉**(008 transaction-form):自建 `<CategorySelect />`,用 shadcn `command`(cmdk-based Combobox)展示分组(内置/自定义)+ 层级缩进

**Rationale**:
- shadcn Select 原生不支持 optgroup / 嵌套分组
- CategorySelect 用 Combobox 模式(cmdk)可自由渲染分组 + 缩进 + 搜索
- 与 spec FR-022(内置+自定义分组 + 二级缩进)一致

### D6: Emoji Picker —— 自建组件(popover + tabs + grid + search)

**Decision**: 自建 `<EmojiPicker />`(shadcn `popover` + `tabs` + `input` + grid)。

**Rationale**(Clarify Q2):
- emoji 常量文件(018 已交付)按 ~10 大类组织(食物/交通/...)
- tabs 沿用常量文件分类,搜索跨类别
- 无合适的现成 emoji picker 包满足"白名单限定 + 中文分类 tab"需求
- 自建简单:Popover shell + Tabs + Grid (button × N) + Input search

**Layout**:
```
┌─────────────────────────────┐
│ 🔍 搜索 emoji...            │
├─────────────────────────────┤
│ [食物] [交通] [购物] ...     │  ← Tabs (scrollable)
├─────────────────────────────┤
│ 🍔 🍜 ☕ 🍷 🍻 🍕 ...        │  ← Grid (8 col × 4 row)
│ 🍱 🍣 🍚 🥘 🍳 🥗 ...       │
│ ...                         │
└─────────────────────────────┘
```

### D7: Optimistic 更新 —— react-query onMutate/onError 模式

**Decision**(Clarify Q1):
- **create / update**: server-first(await → 成功 invalidate + 关闭表单 / 失败 toast + 保留表单)
- **archive / unarchive / reorder**: optimistic(react-query `onMutate` 本地先更新 cache → API 失败时 `onError` 回滚)

**Implementation pattern**(react-query v5 / tRPC v11):
```ts
const archiveMutation = trpc.category.archive.useMutation({
  onMutate: async ({ id }) => {
    await utils.category.list.cancel();
    const prev = utils.category.list.getData();
    // 乐观:本地从 list 移除该分类
    utils.category.list.setData(undefined, (old) =>
      old?.filter((c) => c.id !== id && c.parentId !== id)
    );
    return { prev };
  },
  onError: (_err, _vars, ctx) => {
    // 回滚
    if (ctx?.prev) utils.category.list.setData(undefined, ctx.prev);
    toast.error("操作失败,已恢复");
  },
  onSettled: () => utils.category.list.invalidate(),
});
```

### D8: 路由结构 —— `/settings/categories` 独立页

**Decision**: 新建 `src/app/(app)/settings/categories/page.tsx`,`/settings` 页加"分类管理"入口卡片(类似 010 已有的账户管理 + API Key 管理)。

**Rationale**:
- 分类管理是独立流程,不用塞进 /settings 主页(避免主页过长)
- 独立路由便于深链 / 分享 URL
- 入口卡片保持 /settings 的导航一致性

### D9: 008 transaction-form categoryId 下拉更新 —— 最小侵入

**Decision**: 新建 `<CategorySelect />` 组件(`src/components/category/category-select.tsx`),在 008 transaction-form 中替换既有 categoryId `<select>`。组件内部:
- 调 `trpc.category.list.useQuery({ type })` 获取层级树
- 渲染分组("内置" / "自定义")+ 二级缩进 + 隐藏归档(后端已过滤)
- 受控组件(value + onChange),与 RHF 兼容

**008 既有测试影响**:
- 008 的 transaction-form 测试 mock `trpc.category.list` 返回**旧结构**(扁平数组)
- 新组件期望**树结构**(含 children)
- **需更新 008 测试 mock** 适配新返回结构(018 backend list procedure 现在返回 tree)
- 008 既有测试逻辑不变,只改 mock 数据 shape

### D10: 200 上限 + drag 跨 type/级 拒绝 —— 前端校验 + 后端兜底

**Decision**:
- 前端在"新增"按钮处检查 list 长度(达 200 时禁用按钮 + tooltip)
- 前端在拖拽时检查目标位置(跨 type / 跨级时阻止 drop + toast)
- 后端兜底(018 已实现 advisory lock + 校验)

**Rationale**: 前端校验提升 UX(避免无意义 API 调用),后端是真相源(防 race / 篡改)。

## 总结:无 NEEDS CLARIFICATION 残留

10 个技术决策已锁定,Phase 1 可直接落地组件结构 + 契约。
