# Data Model: UI 一致性补齐 (024-ui-consistency)

**Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 概述

本 feature **不引入新数据实体**(纯前端 + UI 基础设施,spec FR-019 锁定)。本文档记录:
1. **9 个 shadcn 原语清单**(US1 输出)
2. **`components.json` 配置**(US1 前置)
3. **`globals.css` token 补全清单**(US1 clarify Q1 决议)
4. **023 4 个组件迁移状态机**(US2)
5. **BottomNav 数据结构**(US3)

## 一、9 个 shadcn 原语清单(US1 沉淀)

每个原语文件位于 `src/components/ui/<name>.tsx`,导出与 shadcn 官方 API 一致:

| 文件 | 主组件 | 子组件 / 导出 |
|---|---|---|
| `dialog.tsx` | `Dialog` | `DialogTrigger` / `DialogContent` / `DialogHeader` / `DialogFooter` / `DialogTitle` / `DialogDescription` / `DialogClose` |
| `select.tsx` | `Select` | `SelectGroup` / `SelectValue` / `SelectTrigger` / `SelectContent` / `SelectLabel` / `SelectItem` / `SelectSeparator` / `SelectScrollUpButton` / `SelectScrollDownButton` |
| `tabs.tsx` | `Tabs` | `TabsList` / `TabsTrigger` / `TabsContent` |
| `popover.tsx` | `Popover` | `PopoverTrigger` / `PopoverContent` |
| `radio-group.tsx` | `RadioGroup` | `RadioGroupItem` |
| `checkbox.tsx` | `Checkbox` | (单组件) |
| `command.tsx` | `Command` | `CommandDialog` / `CommandInput` / `CommandList` / `CommandEmpty` / `CommandGroup` / `CommandItem` / `CommandShortcut` / `CommandSeparator` |
| `tooltip.tsx` | `TooltipProvider` / `Tooltip` / `TooltipTrigger` / `TooltipContent` |
| `alert-dialog.tsx` | `AlertDialog` | `AlertDialogTrigger` / `AlertDialogContent` / `AlertDialogHeader` / `AlertDialogFooter` / `AlertDialogTitle` / `AlertDialogDescription` / `AlertDialogAction` / `AlertDialogCancel` |

**注**:Command/Tooltip/AlertDialog 三个 024 自身不消费,但**沉淀完整**(clarify Q1 025 反哺决议)。

## 二、components.json(US1 前置配置)

新建于仓库根,shadcn CLI 标准格式:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**关键决策**:
- `tailwind.config: ""`(空)—— Tailwind v4 不需要 `tailwind.config.js`(用 `@theme` block)
- `tailwind.css: "src/app/globals.css"` —— 项目 globals.css 路径
- `tailwind.cssVariables: true` —— 项目用 CSS 变量 token(已存在)
- `aliases.ui: "@/components/ui"` —— 与既有 5 个原子组件路径一致
- `iconLibrary: "lucide"` —— 与 023 已用的 lucide-react 一致

## 三、globals.css token 补全清单(US1,clarify Q1)

**当前已有**(不修改):

```css
@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0 0);
  --color-primary-foreground: oklch(0.985 0 0);
  --color-muted: oklch(0.97 0 0);
  --color-muted-foreground: oklch(0.556 0 0);
  --color-accent: oklch(0.97 0 0);
  --color-accent-foreground: oklch(0.205 0 0);
  --color-border: oklch(0.922 0 0);
  --color-input: oklch(0.922 0 0);
  --color-ring: oklch(0.708 0 0);
  --color-card: oklch(1 0 0);
  --color-card-foreground: oklch(0.145 0 0);
  --color-destructive: oklch(0.577 0.245 27.325);
  --color-destructive-foreground: oklch(0.985 0 0);
  --font-sans: ui-sans-serif, system-ui, ...;
}
```

**需新增**(对照 shadcn 9 原语源码 `bg-*` / `text-*` 引用):

| Token | 值(light oklch) | 用途 |
|---|---|---|
| `--color-popover` | `oklch(1 0 0)`(同 background) | Popover / Dialog / Tooltip 内容背景 |
| `--color-popover-foreground` | `oklch(0.145 0 0)`(同 foreground) | 同上文字色 |
| `--color-secondary` | `oklch(0.97 0 0)`(同 muted) | Select option hover / Tabs active 背景 |
| `--color-secondary-foreground` | `oklch(0.205 0 0)` | 同上文字色 |
| `--color-separator`(若 shadcn 引用) | `oklch(0.922 0 0)`(同 border) | Select separator |

**Dark 值不引入**(独立 dark mode feature scope)。

**最终 globals.css 形态**(US1 后):

```css
@import "tailwindcss";
@import "tw-animate-css";

@theme {
  /* 既有(不变)*/
  --color-background: oklch(1 0 0);
  /* ... 略 ... */

  /* US1 新增 */
  --color-popover: oklch(1 0 0);
  --color-popover-foreground: oklch(0.145 0 0);
  --color-secondary: oklch(0.97 0 0);
  --color-secondary-foreground: oklch(0.205 0 0);
}

html, body { ... }  /* 不变 */
```

## 四、button.tsx destructive variant 扩展(R6)

**Before**(当前):
```ts
const buttonVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "...",
  ghost: "...",
  link: "...",
};
```

**After**(US1 后):
```ts
const buttonVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",  // 新增
  outline: "...",
  ghost: "...",
  link: "...",
};
```

**注**:既有 API 不破坏(`variant` prop 默认仍是 default);025 AlertDialog `AlertDialogAction asChild` + `Button variant="destructive"` 直接可用。

## 五、023 4 组件迁移状态机(US2)

### 5.1 emoji-picker.tsx —— Popover + Tabs

**Before** 状态机(023 当前):
```
[idle] popover closed
  │ 点击 trigger button
  ▼
[open] useState open=true + aria-expanded
  │ 点外部 / Esc / 选 emoji
  ▼
[idle]
```

**After** 状态机(shadcn Popover):
```
[idle]
  │ 点 PopoverTrigger
  ▼
[open] Radix 控制(open state onValueChange)
  ├─ Popover 内 Tabs 切换 activeGroup(原 useState 保留)
  ├─ Esc / 点外部 → Radix 自动关闭
  └─ 点 emoji → onChange(emoji) + 手动 close popover
  ▼
[idle]
```

**关键变化**:`aria-expanded` / focus trap / Esc 关闭由 Radix 自动管理。

### 5.2 category-form.tsx —— RadioGroup + Select

**Before**: 裸 `<input type="radio">` × 2(支出/收入)+ 裸 `<select>` for parent。

**After**:
- `<RadioGroup value={field.value} onValueChange={field.onChange}>` + `<RadioGroupItem value="expense">` × 2
- `<Select value={field.value ?? ""} onValueChange={field.onChange}>` + `<SelectItem value={c.id}>` × N

无新 state machine,RHF `<Controller>` 包裹。

### 5.3 category-manager.tsx —— Dialog + Checkbox

**关键状态机变化**:`Modal` 切换为 `Dialog`,API 几乎 1:1(`open` / `onClose` → `open` / `onOpenChange`)。

```
[idle] Dialog closed, showCreateForm=false, editingCategoryId=null
  │ 点"新增分类"
  ▼
[create-open] showCreateForm=true + Dialog open
  │ submit / cancel
  ▼
[idle]
  │ 点 CategoryItem 的"编辑"
  ▼
[edit-open] editingCategoryId=X + Dialog open
  │ submit / cancel
  ▼
[idle]
```

**Checkbox** 切换"显示已归档":`<Checkbox checked={includeArchived} onCheckedChange={setIncludeArchived} />`,无新状态机。

### 5.4 category-item.tsx —— 引用更新(若 import path 变)

无新状态机。如果有从 `modal.tsx` 引用(已 grep 确认无),清理;否则只更新 import 路径以匹配新原语(若有相对路径引用)。

## 六、BottomNav tabs 数据结构(US3)

**Before**:
```ts
const tabs = [
  { href: "/dashboard", label: "首页", icon: "📊" },  // emoji 字符
  { href: "/transactions", label: "流水", icon: "📋" },
  { href: "/transaction/new", label: "记账", icon: "✏️" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];
```

**After**:
```tsx
import { LayoutDashboard, ReceiptText, PencilLine, Settings } from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "首页", Icon: LayoutDashboard },
  { href: "/transactions", label: "流水", Icon: ReceiptText },
  { href: "/transaction/new", label: "记账", Icon: PencilLine },
  { href: "/settings", label: "设置", Icon: Settings },
];

// 渲染
{tabs.map(({ href, label, Icon }) => (
  <Link key={href} href={href} className={cn(...)}>
    <Icon className="h-5 w-5" aria-hidden />
    <span>{label}</span>
  </Link>
))}
```

**关键变化**:
- `icon: string`(emoji 字符)→ `Icon: LucideIcon`(组件引用)
- 渲染 `<span>{tab.icon}</span>` → `<Icon className="h-5 w-5" />`
- a11y:`aria-hidden` 让屏幕阅读器跳过图标(已有 `<span>{label}</span>` 提供 readable name)
- tap target:Link 容器 `flex-1 + h-14` 保持 ≥ 44×44px(已有,不变)

## 七、不变项确认

- **不动 server**:`src/server/api/routers/*` + `src/server/db/schema/*` + `src/server/domain/*` 全部不变。
- **不动 008 transaction-form**:`src/components/transaction/transaction-form.tsx`(025 负责)。
- **不动 009/010**:`src/components/transactions/*` + `src/app/(app)/{transactions,settings}/page.tsx`(025 负责)。
- **不动 023 category-select**:`src/components/category/category-select.tsx`(008 消费,chip-grid 而非 select,不需迁移)。
- **不动既有 5 个原子组件**(`card.tsx` / `input.tsx` / `label.tsx` / `skeleton.tsx` + `button.tsx` 只扩展不破坏 API)。
- **不动 i18n**:中文硬编码沿用现状。
- **不引入 dark mode**:globals.css 只补 light 值;dark 值留独立 dark mode feature。
