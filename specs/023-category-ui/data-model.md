# Data Model: 自定义分类管理 UI (023-category-ui)

**Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

> Phase 1 产物:UI 层类型定义。本 feature 无新 DB schema(纯前端),仅定义前端类型 + 共享 schema。

## UI 层类型一览

| 类型 | 来源 | 说明 |
|---|---|---|
| `CategoryTreeNode` | 来自 018 `category.list` 返回 | 树结构(顶级数组 + children 嵌套) |
| `CategoryFormValues` | 本 feature 新建 (zod) | 新增/编辑表单值 |
| `EmojiGroup` | 本 feature 新建 | emoji picker tab 元数据 |
| `DragItem` | @dnd-kit | 拖拽 item 类型 |
| `ReorderPlan` | 本 feature 新建 | 拖拽计算结果(中位 vs 全重排) |

## 类型定义

### CategoryTreeNode(来自 018 backend 返回)

```ts
// 来自 trpc.category.list 的返回,前端直接消费
type CategoryTreeNode = {
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  sortOrder: number;
  familyId: string | null;       // 内置 = null
  isBuiltIn: boolean;
  parentId: string | null;       // 顶级 = null
  archivedAt: string | null;     // ISO timestamp
  createdAt: string;
  updatedAt: string;
  children: CategoryTreeNode[];  // 二级(三级禁止,018 已保证)
};
```

### CategoryFormValues(zod schema,前后端共享)

```ts
// src/lib/validators/category.ts
import { z } from "zod";
import { CATEGORY_EMOJI_SET } from "@/lib/constants/category-emojis";

const categoryTypeSchema = z.enum(["income", "expense"]);

export const categoryCreateSchema = z.object({
  type: categoryTypeSchema,
  name: z.string().trim().min(1, "分类名不能为空").max(30, "不能超过 30 字"),
  icon: z.string().refine((v) => CATEGORY_EMOJI_SET.has(v), {
    message: "icon 必须来自内置 emoji 库白名单",
  }),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

export const categoryUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(30).optional(),
  icon: z.string().refine((v) => CATEGORY_EMOJI_SET.has(v)).optional(),
  sortOrder: z.number().int().min(0).optional(),
  parentId: z.union([z.string().uuid(), z.null()]).optional(),
  type: categoryTypeSchema.optional(),
}).strict();

export type CategoryFormValues = z.infer<typeof categoryCreateSchema>;
```

> **注**: 后端 018 procedure 的 zod schema 已存在(在 `src/server/api/routers/category.ts`)。前端可 import 同一份 schema(re-export from router or duplicate)。前者更 DRY,后者更解耦。tasks 阶段决定。

### EmojiGroup(emoji picker tab 元数据)

```ts
// src/lib/constants/category-emojis.ts (018 已有 CATEGORY_EMOJIS 数组)
// 本 feature 新增分组元数据(用于 picker tab):

export const CATEGORY_EMOJI_GROUPS = [
  { id: "food", label: "食物", emojis: ["🍔", "🍜", "☕", "🍷", ...] },
  { id: "transport", label: "交通", emojis: ["🚗", "🚇", "🚌", ...] },
  { id: "shopping", label: "购物", emojis: ["🛍️", "🛒", "👕", ...] },
  // ... ~10 groups
] as const;

export type EmojiGroup = (typeof CATEGORY_EMOJI_GROUPS)[number];
```

### ReorderPlan(拖拽计算)

```ts
// src/components/category/use-category-reorder.ts
type ReorderPlan =
  | { kind: "single-update"; id: string; newSortOrder: number }
  | { kind: "full-renumber"; items: Array<{ id: string; sortOrder: number }> };
```

由 `computeSortOrder()` (018 已有,在 `src/server/domain/category/rules.ts`)计算:
- `mid > prev` → single-update(调 `category.update`)
- `mid === NaN` → full-renumber(调 `category.reorder` 批量端点)

## 状态机

### Category 行状态(影响 UI)

| 状态 | 条件 | UI 表现 |
|---|---|---|
| **built-in** | isBuiltIn=true | 🔒 + 无编辑/归档/拖拽按钮 |
| **active-custom** | isBuiltIn=false AND archivedAt=null | 编辑 / 归档 / 拖拽手柄 + 完整字段可编辑 |
| **archived-custom** | isBuiltIn=false AND archivedAt≠null | 灰显 + 反归档按钮 + 编辑仅 name/icon/sortOrder 可改(type/parent 置灰) |

### Mutation 状态(Clarify Q1 混合策略)

| Mutation | 策略 | 失败行为 |
|---|---|---|
| create | server-first | toast 错误 + 保留表单(不关 modal) |
| update | server-first | toast 错误 + 保留表单 |
| archive | optimistic | 回滚列表 + toast "已恢复" |
| unarchive | optimistic | 回滚列表 + toast "已恢复" |
| reorder (single) | optimistic | 回滚 + toast |
| reorder (full-renumber) | optimistic | 回滚 + toast |

## 容量/性能预算(前端)

| 维度 | 估值 | 验证点 |
|---|---|---|
| 单页 list 行数 | < 122 (22 内置 + 200 自定义上限,典型 < 50) | SC-002 P95 < 500ms 渲染 |
| emoji picker grid | ~120 emoji,~10 tabs | SC-003 P95 < 100ms |
| 拖拽响应(间隔足够) | 单 `category.update` API call | SC-004 P95 < 300ms |
| 拖拽响应(全重排) | 单 `category.reorder` 批量,N < 50 | SC-004 P95 < 800ms |
| React 19 渲染 | list 用 key=id,emoji picker 用 React.memo | 无 jank |

## 008 transaction-form 适配

008 的 categoryId 下拉当前:
- 调 `trpc.category.list.useQuery({ type })`(返回扁平 Category[],003 时代)
- 用原生 `<select>` 渲染

018 backend 已扩展 `category.list` 返回 `CategoryTreeNode[]`(含 children)。008 既有测试 mock 旧 shape,需更新。

本 feature 新建 `<CategorySelect />` 替换:
- 内部调 `trpc.category.list.useQuery({ type })`(返回 tree)
- 渲染分组("内置" / "自定义")+ 二级缩进
- 隐藏归档(后端 includeArchived 默认 false 已过滤)
- 受控组件(value + onChange + type prop)
