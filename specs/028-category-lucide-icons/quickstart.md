# Quickstart: 分类图标迁移开发者指南

**Feature**: 028-category-lucide-icons | **Date**: 2026-07-15

## 1. 使用 CategoryIcon 组件

```tsx
import { CategoryIcon } from "@/components/category/category-icon";

// 基本用法(默认 20px)
<CategoryIcon name="utensils" />

// 自定义尺寸
<CategoryIcon name="car" size={16} />

// 带 className(继承文本色)
<CategoryIcon name="wallet" className="text-[var(--success)]" />

// 语义性图标(屏幕阅读器读出)
<CategoryIcon name="gift" aria-label="人情分类" />

// 装饰性图标(屏幕阅读器忽略,默认行为)
<CategoryIcon name="shopping-bag" />
```

## 2. 替换渲染点

### Before (emoji 文本渲染)
```tsx
<span className="text-xl">{cat.icon}</span>
```

### After (矢量图标渲染)
```tsx
<CategoryIcon name={cat.icon} size={20} />
```

### 各调用点尺寸参考

| 组件 | 位置 | 推荐 size |
|------|------|----------|
| `category-select.tsx` | 分类选择器 chip | 16 |
| `category-item.tsx` | 分类管理列表 | 20 |
| `transaction-list-item.tsx` | 流水列表项 | 20 |
| `recent-transactions.tsx` | 首页最近交易 | 20 |
| `category-breakdown.tsx` | 首页分类分解 | 18 |
| `top-category-card.tsx` | 首页 Top 分类卡 | 18 |
| `category-top-list.tsx` | 首页 Top4 进度条 | 16 |
| `category-breakdown-card.tsx` | 报表分类列表 | 20 |
| `category-form.tsx` | 父分类下拉 | 16 |

## 3. 校验层更新

### 前端 zod (`lib/validators/category.ts`)
```typescript
// Before
import { CATEGORY_EMOJI_SET } from "@/lib/constants/category-emojis";
const iconSchema = z.string().refine((v) => CATEGORY_EMOJI_SET.has(v), { ... });

// After
import { CATEGORY_ICON_SET } from "@/lib/constants/category-icons";
const iconSchema = z.string().refine((v) => CATEGORY_ICON_SET.has(v), {
  message: "图标必须来自内置图标库",
});
```

### 后端 procedure (`server/api/routers/category.ts`)
```typescript
// Before
import { isCategoryEmoji } from "@/server/domain/category/rules";
const iconSchema = z.string().refine((v) => isCategoryEmoji(v), { ... });

// After
import { isCategoryIcon } from "@/lib/constants/category-icons";
const iconSchema = z.string().refine((v) => isCategoryIcon(v), {
  message: "图标必须来自内置图标库",
});
```

### 领域规则 (`server/domain/category/rules.ts`)
```typescript
// Before
export function isCategoryEmoji(value: string): boolean {
  return typeof value === "string" && CATEGORY_EMOJI_SET.has(value);
}

// After
export function isCategoryIcon(value: string): boolean {
  return typeof value === "string" && CATEGORY_ICON_SET.has(value);
}
// 注:isCategoryEmoji 可保留为 deprecated alias 过渡,或直接删除(T6 阶段)
```

## 4. 新增图标

只需在 `src/lib/constants/category-icons.ts` 中:

```typescript
// 1. 添加 lucide import
import { NewIcon } from "lucide-react";

// 2. 在 CATEGORY_ICON_MAP 中加一条
export const CATEGORY_ICON_MAP = {
  // ... 既有 ...
  "new-icon": NewIcon,
};

// 3. 在对应分组中加图标名
export const CATEGORY_ICON_GROUPS = [
  { id: "food", label: "食物", icons: [..., "new-icon"] },
  // ...
];
```

白名单(`CATEGORY_ICON_SET`)和校验自动更新(从 map keys 派生)。

## 5. 数据迁移验证

```bash
# 1. 执行迁移
pnpm db:migrate

# 2. 验证无 emoji 残留
psql -c "SELECT id, icon FROM categories WHERE icon ~ '[^\x00-\x7F]';"
# 预期: 0 行

# 3. 验证兜底行
psql -c "SELECT id, name FROM categories WHERE icon = 'circle-help';"
# 预期: 0 行(所有 emoji 均命中映射)

# 4. 验证行数不变
psql -c "SELECT count(*) FROM categories;"
# 迁移前后一致
```

## 6. 测试更新

### 既有测试 icon 断言

```typescript
// Before
expect(category.icon).toBe("🍔");

// After
expect(category.icon).toBe("utensils");
```

### 新增 CategoryIcon 渲染测试

```typescript
import { render } from "@testing-library/react";
import { CategoryIcon } from "@/components/category/category-icon";

test("renders known icon as svg", () => {
  const { container } = render(<CategoryIcon name="utensils" />);
  expect(container.querySelector("svg")).toBeInTheDocument();
});

test("renders fallback for unknown name", () => {
  const { container } = render(<CategoryIcon name="nonexistent" />);
  expect(container.querySelector("svg")).toBeInTheDocument(); // 兜底图标也是 svg
});

test("aria-hidden by default", () => {
  const { container } = render(<CategoryIcon name="car" />);
  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});
```
