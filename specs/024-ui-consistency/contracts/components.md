# Component Contracts: UI 一致性补齐 (024-ui-consistency)

**Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 概述

本文档定义 11 个改造/新建文件的契约 —— **改前 → 改后 → 行为差异 → a11y 提升 → 测试 selector 调整**。

按 US 分组:
- **US1 沉淀**(9 契约):components.json / globals.css / button.tsx destructive / 9 个新 ui/ 原语
- **US2 迁移**(4 契约):emoji-picker / category-form / category-manager / category-item(无 modal.tsx)
- **US3 图标统一**(1 契约):bottom-nav.tsx

---

# US1: 沉淀契约

## C1: components.json(新建)

**Path**: `components.json`(仓库根,新建)

**内容**: 见 [data-model.md §二](./data-model.md#二componentsjsonus1-前置配置) 完整 JSON。

**关键决策**:
- `style: "default"`(非 new-york,与既有 5 个原子组件风格一致)
- `tailwind.config: ""`(Tailwind v4 不需要)
- `tailwind.css: "src/app/globals.css"`
- `aliases.ui: "@/components/ui"`

**验证**:`pnpm dlx shadcn@latest add dialog`(R1 路径)成功后 `components.json` 应自动创建;手动路径时直接 `Write` 该 JSON。

---

## C2: globals.css token 扩展(US1)

**Path**: `src/app/globals.css`

**Migration scope**: 在 `@theme { ... }` block **末尾**(现有 19 行 token 之后)加新 token。

**Before**: 见 [data-model.md §三](./data-model.md#三globalscss-token-补全清单us1clarify-q1) "当前已有"部分(19 个 token + 1 个 font)。

**After**: 既有 + 4 个新 token(`--color-popover` / `--color-popover-foreground` / `--color-secondary` / `--color-secondary-foreground`)。

**Behavior diff**: 无 —— Tailwind v4 自动从 `--color-X` 生成 `bg-X` / `text-X` / `border-X` class,既有页面**未引用** `bg-popover` 等(因为 023 是手写 popover,用 `bg-card` / `bg-background`),所以补 token 不影响现有视觉。

**a11y lift**: 无(纯 CSS 变量)。

**Test selectors**: 无需调整(globals.css 不被 RTL 直接测试)。

---

## C3: button.tsx destructive variant 扩展

**Path**: `src/components/ui/button.tsx`(42 行)

**Migration scope**: `buttonVariants` map 加一条 destructive。

**Before**:
```tsx
const buttonVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};
```

**After**:
```tsx
const buttonVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};
```

**Behavior diff**:
- ✅ 既有 4 个 variant 不变,API 完全向后兼容
- ⚠️ 新增 destructive:用于 025 AlertDialog `AlertDialogAction asChild`(本 feature 不消费,但沉淀就绪)

**a11y lift**: `focus-visible:ring-destructive` 让键盘聚焦 destructive 按钮时红色 ring(已有 ring token),视觉强化危险操作。

**Test selectors**: 既有 button tests(若有)无需调整(`variant="default"` 仍是 default)。

---

## C4-C12: 9 个新 ui/ 原语文件

每个文件由 shadcn CLI 自动生成(R1 路径)或手动从官方源码复制。契约**统一**:

| 文件 | Path | 导出主组件 | Radix 依赖 |
|---|---|---|---|
| C4 | `src/components/ui/dialog.tsx` | `Dialog` + 7 子组件 | `@radix-ui/react-dialog` |
| C5 | `src/components/ui/select.tsx` | `Select` + 9 子组件 | `@radix-ui/react-select` |
| C6 | `src/components/ui/tabs.tsx` | `Tabs` + 3 子组件 | `@radix-ui/react-tabs` |
| C7 | `src/components/ui/popover.tsx` | `Popover` + 2 子组件 | `@radix-ui/react-popover` |
| C8 | `src/components/ui/radio-group.tsx` | `RadioGroup` + 1 子组件 | `@radix-ui/react-radio-group` |
| C9 | `src/components/ui/checkbox.tsx` | `Checkbox` | `@radix-ui/react-checkbox` |
| C10 | `src/components/ui/command.tsx` | `Command` + 8 子组件 | `cmdk` + `@radix-ui/react-dialog` |
| C11 | `src/components/ui/tooltip.tsx` | `TooltipProvider` / `Tooltip` + 2 子组件 | `@radix-ui/react-tooltip` |
| C12 | `src/components/ui/alert-dialog.tsx` | `AlertDialog` + 7 子组件 | `@radix-ui/react-alert-dialog` |

**统一契约**(适用于所有 9 个文件):

- **Source**: shadcn 官方源码(`https://ui.shadcn.com/docs/components/<name>`,版本 = 拉取时最新)
- **Imports**: `import { cn } from "@/lib/utils"`(已有)+ 对应 Radix 包
- **CSS className**: 沿用 shadcn 默认(如 `bg-popover text-popover-foreground` for PopoverContent),不修改
- **Token 依赖**: 全部依赖 `@theme { --color-* }` 中已有的 token + C2 补的 4 个新 token
- **TypeScript**: 严格模式(项目 tsconfig),`import * as React from "react"`
- **Export style**: 命名 export(非 default export),与既有 5 个原子组件风格一致
- **Behavior**: 与 shadcn 官方完全一致(零定制),保证 future 升级路径

**a11y lift**(自动获得):
- Dialog/AlertDialog: `role="dialog"` / `aria-labelledby` / `aria-describedby` / 焦点陷阱 / Esc / 点击遮罩关闭
- Select: `role="combobox"` / `aria-expanded` / `aria-controls` / 键盘 ↓↑ Enter Esc
- Tabs: `role="tablist"` / `role="tab"` / `aria-selected` / 键盘 ←→ 切换
- Popover: `role="dialog"`(non-modal)/ 焦点陷阱 / Esc
- RadioGroup: `role="radiogroup"` / `role="radio"` / `aria-checked` / 键盘 ↓↑ 切换
- Checkbox: `role="checkbox"` / `aria-checked` / 键盘 Space 切换
- Command: 基于 cmdk 自带 ARIA
- Tooltip: `role="tooltip"` / 显示延迟 / 屏幕阅读器读出

**Test selectors**(全局,适用于所有 023 迁移后测试):
- 既有 `getByRole('button', { name: 'X' })` 多数保持
- 新可用 `getByRole('dialog')` / `getByRole('combobox')` / `getByRole('tab')` / `getByRole('option')`(Select Content 打开后)等

---

# US2: 023 迁移契约

## C13: emoji-picker.tsx —— Popover + Tabs

**Path**: `src/components/settings/emoji-picker.tsx`(143 行)

**Migration scope**: 整体重构 — 用 shadcn `Popover` 替代手写 `<button aria-expanded>` + `useState open`,用 shadcn `Tabs` 替代 group 切换的 `<button>` 数组。

**Before**(摘要):
```tsx
<button aria-expanded={open} onClick={() => setOpen(!open)}>...</button>
{open && (
  <div className="popover">
    <input placeholder="搜索 emoji..." />
    <div className="tabs">
      {CATEGORY_EMOJI_GROUPS.map(g => <button>{g.label}</button>)}
    </div>
    <div className="grid">{filteredEmojis.map(...)}</div>
  </div>
)}
```

**After**:
```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <button>{value || "选图标"}</button>
  </PopoverTrigger>
  <PopoverContent className="w-80">
    <Input placeholder="搜索 emoji..." value={search} onChange={...} />
    <Tabs value={activeGroup} onValueChange={setActiveGroup}>
      <TabsList className="flex-wrap">
        {CATEGORY_EMOJI_GROUPS.map(g => <TabsTrigger key={g.id} value={g.id}>{g.label}</TabsTrigger>)}
      </TabsList>
      {CATEGORY_EMOJI_GROUPS.map(g => (
        <TabsContent key={g.id} value={g.id}>
          <div className="grid grid-cols-8 gap-1">{g.emojis.map(...)}</div>
        </TabsContent>
      ))}
    </Tabs>
  </PopoverContent>
</Popover>
```

**Behavior diff**:
- ✅ 选 emoji 关闭 popover(不变)
- ✅ 搜索跨 tab 全局过滤(不变)
- ⚠️ Tab 切换:之前点击 button 切换 active group,现在点击 TabsTrigger 切换 Tabs active
- ⚠️ Esc / 点外部关闭:之前手写 onClick + useState,现在 Radix 自动

**a11y lift**:
- Popover: `role="dialog"` + 焦点陷阱 + Esc
- Tabs: `role="tablist"` / `role="tab"` / `aria-selected` + 键盘 ←→
- 搜索框 `aria-label` 保持

**Test selectors**:
- `getByRole('button', { name: '选图标' })` 触发 → `getByRole('dialog')`(Popover 打开后)
- `getByRole('tab', { name: '食物' })` 切换 group
- `getByRole('option', ...)`(若 grid item 设 `role="option"`,否则保持 `getAllByRole('button')`)

---

## C14: category-form.tsx —— RadioGroup + Select

**Path**: `src/components/settings/category-form.tsx`(216 行)

**Migration scope**: type 字段(裸 radio × 2)→ RadioGroup;parent 字段(裸 `<select>`)→ shadcn Select。

**Before**(摘要):
```tsx
<label><input type="radio" value="expense" {...register("type")} /> 支出</label>
<label><input type="radio" value="income" {...register("type")} /> 收入</label>

<select {...register("parentId")}>
  <option value="">(顶级分类)</option>
  {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
</select>
```

**After**:
```tsx
<Controller control={control} name="type" render={({ field }) => (
  <RadioGroup value={field.value} onValueChange={field.onChange}>
    <div className="flex gap-4">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="expense" id="type-expense" />
        <Label htmlFor="type-expense">支出</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="income" id="type-income" />
        <Label htmlFor="type-income">收入</Label>
      </div>
    </div>
  </RadioGroup>
)} />

<Controller control={control} name="parentId" render={({ field }) => (
  <Select value={field.value ?? ""} onValueChange={field.onChange}>
    <SelectTrigger><SelectValue placeholder="(顶级分类)" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="">(顶级分类)</SelectItem>
      {candidates.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
    </SelectContent>
  </Select>
)} />
```

**Behavior diff**:
- ✅ 编辑模式预填(不变,RHF 控制)
- ✅ 校验失败保留值(不变)
- ⚠️ FR-011 限制(已归档 / 有子分类)通过 `<SelectItem disabled>` 或 `isDisabled` 实现(具体在 plan/tasks 阶段决定)
- ⚠️ Submit 语义不变(RHF field.onChange)

**a11y lift**:
- RadioGroup: `role="radiogroup"` + `role="radio"` + `aria-checked` + 键盘 ↓↑ 切换
- Select: `role="combobox"` + 键盘 ↓↑ Enter + 焦点陷阱

**Test selectors**:
- `getByRole('radio', { name: '支出' })`(原 `getByLabelText('支出')` 仍可用)
- Select 打开后 `getByRole('option', { name: '现金' })`

---

## C15: category-manager.tsx —— Dialog + Checkbox + Modal 删除

**Path**: `src/components/settings/category-manager.tsx`(390 行)

**Migration scope**: `<Modal>` → `<Dialog>`;"显示已归档"`<input type="checkbox">` → `<Checkbox>`。**同 commit** 删除 `src/components/ui/modal.tsx`(R7)。

**Before**(摘要):
```tsx
import { Modal } from "@/components/ui/modal";
// ...
<label><input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} /> 显示已归档</label>
// ...
<Modal open={showCreateForm} onClose={() => setShowCreateForm(false)} title="新增分类">
  <CategoryForm mode="create" ... />
</Modal>
```

**After**:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// ...
<div className="flex items-center gap-2">
  <Checkbox id="include-archived" checked={includeArchived} onCheckedChange={(v) => setIncludeArchited(v === true)} />
  <Label htmlFor="include-archived">显示已归档</Label>
</div>
// ...
<Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
  <DialogContent>
    <DialogHeader><DialogTitle>新增分类</DialogTitle></DialogHeader>
    <CategoryForm mode="create" ... />
  </DialogContent>
</Dialog>
```

**Behavior diff**:
- ✅ Dialog open/close 语义与 Modal 一致(open + onClose → open + onOpenChange)
- ✅ Title 渲染(原 Modal 的 title prop → DialogTitle 子组件)
- ⚠️ Modal 的"点击遮罩关闭"与"Esc 关闭"行为 Dialog 都有(由 Radix 提供)
- ⚠️ Dialog 默认有 fade-in 动画(`tw-animate-css`),Modal 无动画。spec FR-012 要求"行为零回归",动画是否算"行为"?

**关于动画**:024 spec US2 AS1 锁定"焦点自动落到表单首字段、Esc 关闭、点击遮罩关闭、body 滚动锁定"——**未提及动画**。Radix Dialog 默认 fade-in ~150ms,无视觉错乱,反而是体验提升。默认保留 Radix 动画。

**a11y lift**:
- Dialog: `role="dialog"` + `aria-labelledby`(DialogTitle 自动 id)+ `aria-describedby` + 焦点陷阱
- Checkbox: `role="checkbox"` + `aria-checked` + 键盘 Space

**Test selectors**:
- 既有 `getByRole('dialog')` 或 `getByText('新增分类')` 保持
- `getByRole('checkbox', { name: '显示已归档' })`(原 `getByLabelText`)

---

## C16: category-item.tsx —— 引用更新

**Path**: `src/components/settings/category-item.tsx`(114 行)

**Migration scope**: 通常无迁移(不直接使用 Modal/Popover/Select);若有相对路径 import 或共享类型,可能微调。

**Before**: 引用 `Button` from `@/components/ui/button`(已有)+ 内联 lucide icons。

**After**: 同 Before(category-item 本身不直接用 Dialog/Popover/Select/Checkbox/RadioGroup/Tabs)。

**Behavior diff**: 无。

**a11y lift**: 无。

**Test selectors**: 既有保持。

> 注:C16 列入契约清单为完整性,**实际改动可能在 0 行**(除非 plan 阶段发现具体引用需调整)。

---

# US3: BottomNav 契约

## C17: bottom-nav.tsx —— emoji 字符 → lucide-react

**Path**: `src/components/bottom-nav.tsx`(37 行)

**Migration scope**: `tabs` 数组的 `icon: string`(emoji)→ `Icon: LucideComponent`;渲染层换。

**Before**:
```tsx
const tabs = [
  { href: "/dashboard", label: "首页", icon: "📊" },
  { href: "/transactions", label: "流水", icon: "📋" },
  { href: "/transaction/new", label: "记账", icon: "✏️" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];

{tabs.map(tab => (
  <Link href={tab.href} className={cn(...)}>
    <span className="text-lg">{tab.icon}</span>
    <span>{tab.label}</span>
  </Link>
))}
```

**After**:
```tsx
import { LayoutDashboard, ReceiptText, PencilLine, Settings, type LucideIcon } from "lucide-react";

const tabs: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/dashboard", label: "首页", Icon: LayoutDashboard },
  { href: "/transactions", label: "流水", Icon: ReceiptText },
  { href: "/transaction/new", label: "记账", Icon: PencilLine },
  { href: "/settings", label: "设置", Icon: Settings },
];

{tabs.map(({ href, label, Icon }) => (
  <Link href={href} className={cn(...)}>
    <Icon className="h-5 w-5" aria-hidden />
    <span>{label}</span>
  </Link>
))}
```

**Behavior diff**:
- ✅ active state 颜色逻辑不变(`text-primary` vs `text-muted-foreground`)
- ✅ tap target ≥ 44×44px(已有 `flex-1 h-14`,不变)
- ✅ 4 个 tab 等分宽度(已有 `flex-1`,不变)
- ⚠️ 图标尺寸:`text-lg`(emoji 默认 ~24px)→ `h-5 w-5`(20px),略小但更标准
- ⚠️ 图标对齐:`flex flex-col items-center justify-center gap-0.5` 保持

**a11y lift**:
- ✅ `aria-hidden` 让屏幕阅读器跳过图标(emoji 字符会被读出"图形"或忽略,影响可预测性)
- ✅ `<span>{label}</span>` 已有,提供 readable name
- ✅ 跨平台视觉一致(emoji 在 macOS / Windows / Android 渲染差异消除)

**Test selectors**: 既有 `getByText('首页')` / `getByRole('link', { name: '首页' })` 保持(因 label 仍是 readable name)。

---

## 测试 selector 调整汇总(US2 + US3)

| 文件 | 既有 selector | 新 selector(若有变化) |
|---|---|---|
| `emoji-picker.test.tsx` | `getByRole('button', { name: '选图标' })` + `getByRole('button', { name: '食物' })`(tab) | 触发后 `getByRole('dialog')` + `getByRole('tab', { name: '食物' })` |
| `category-form.test.tsx` | `getByLabelText('支出')` | `getByRole('radio', { name: '支出' })`(等价) |
| `category-select.test.tsx` | (不动,008 transaction-form 用) | (不动) |
| `category-manager.test.tsx`(若有) | `getByText('新增分类')` 或自定义 | `getByRole('dialog')` + `getByRole('checkbox', { name: '显示已归档' })` |

**注**:023 实际有哪些 component test 文件需在 US2 实施时 `ls src/tests/unit/components/settings/` 确认;若发现非本契约覆盖的 selector 失败,在 US2 内同步调整。
