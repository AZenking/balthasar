# Contracts: 018-custom-category

**状态**: T3 Stack v2.0.0 —— 本目录不维护 REST 契约文件。tRPC 类型自动推断,本文档仅描述 procedure shape 供 plan/tasks 参考。

## 入口端点 (7 个 procedure)

| 功能 | tRPC 路径 | 类型 | 鉴权 | 来源 |
|---|---|---|---|---|
| 列出分类(内置 + 自定义,层级展开) | `trpc.category.list.useQuery({ type?, parentId?, includeArchived? })` | query | protectedProcedure | 003 + 018 扩展 |
| 查询单个分类 | `trpc.category.get.useQuery({ id })` | query | protectedProcedure | 003 + 018 扩展 |
| 新增自定义分类 | `trpc.category.create.useMutation()` | mutation | protectedProcedure | 018 新增 |
| 编辑自定义分类 | `trpc.category.update.useMutation()` | mutation | protectedProcedure | 018 新增 |
| **批量重排序(同级,单事务原子)** | `trpc.category.reorder.useMutation()` | mutation | protectedProcedure | **018 新增 (FR-031d)** |
| 归档自定义分类(级联子) | `trpc.category.archive.useMutation()` | mutation | protectedProcedure | 018 新增 |
| 反归档自定义分类(级联子) | `trpc.category.unarchive.useMutation()` | mutation | protectedProcedure | 018 新增 |

## Procedure 详细契约

### `category.list` (扩展 003)

**Input**:
```ts
{
  type?: "income" | "expense";          // 类型过滤 (内置 + 自定义同 type)
  parentId?: string;                    // 指定后:返回该父的直接子分类 (平铺,不嵌套)
  includeArchived?: boolean;            // 默认 false (隐藏归档);true 含归档 (带 archivedAt)
}
```

**Output**:
```ts
// 默认 (无 parentId): 顶级分类数组,二级作为 children 嵌套
Array<{
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  sortOrder: number;
  familyId: string | null;              // 内置 = null, 自定义 = 家庭 ID
  isBuiltIn: boolean;
  parentId: null;                       // 顶级
  archivedAt: string | null;            // ISO timestamp 或 null
  createdAt: string;
  updatedAt: string;
  children: Array<{                     // 二级分类 (嵌套时)
    id: string;
    name: string;
    type: "income" | "expense";
    icon: string;
    sortOrder: number;
    familyId: string | null;
    isBuiltIn: boolean;
    parentId: string;                   // 父 ID
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}>;

// 传 parentId 时:返回该父的直接子分类 (平铺,无 children 嵌套)
Array<{
  id: string;
  name: string;
  type: "income" | "expense";
  // ... 同上顶层字段
  parentId: string;
}>;
```

**行为**:
- 默认仅返回 `archivedAt IS NULL` 的分类(内置 + 当前家庭自定义)
- 排序: `(parentId NULL FIRST, sortOrder ASC, createdAt ASC)`
- 003 向后兼容:旧调用方(无参)拿到的字段是 003 旧字段的超集,无破坏
- 跨家庭隔离:WHERE `family_id IS NULL OR family_id = currentFamilyId`

**错误**: 401 (未登录)

---

### `category.get` (扩展 003)

**Input**: `{ id: string }` (UUID)

**Output**: 同 list 单项 (无 children)

**行为**:
- 内置分类 (isBuiltIn=true): 任意家庭可读
- 自定义分类 (isBuiltIn=false): 必须 `family_id = currentFamilyId`,否则 404

**错误**: 401 (未登录), 404 (不存在 / 跨家庭)

---

### `category.create` (018 新增)

**Input**:
```ts
{
  type: "income" | "expense";           // 必填
  name: string;                         // 1-30 字符,前后端 trim
  icon: string;                         // MUST ∈ CATEGORY_EMOJIS 白名单
  parentId?: string;                    // 可选;提供则校验:存在 + 同家庭/内置 + 是顶级 + type 一致
  sortOrder?: number;                   // 可选;不传默认 100
}
```

**Output**: 新建的 Category 完整对象 (同 list 顶层单项,parentId 字段反映是否二级)

**服务端派生**(客户端不可传):
- `id` ← uuidv7()
- `familyId` ← session.currentFamilyId
- `isBuiltIn` ← false (强制)
- `archivedAt` ← null
- `createdAt` / `updatedAt` ← now()

**校验顺序**(短路):
1. session 鉴权 → 401
2. zod schema (type/name/icon/parentId/sortOrder 类型 + 长度 + 白名单) → 400
3. 200 上限检查 (advisory lock + count,见 research.md D7) → 400 "自定义分类数已达上限 200"
4. parentId 校验:存在 + 同家庭 + 是顶级 + type 一致 → 400
5. 唯一性 (family_id, type, parent_id, LOWER(name)) → 409
6. INSERT category + INSERT category_event(category_created, after=snapshot)

**错误**: 401, 400 (校验失败 / 上限), 409 (重名), 500 (infrastructure)

---

### `category.update` (018 新增)

**Input**:
```ts
{
  id: string;                           // 目标分类 ID (必须 isBuiltIn=false 且属于当前家庭)
  name?: string;                        // 1-30 字符
  icon?: string;                        // 白名单
  sortOrder?: number;
  parentId?: string | null;             // null = 改为顶级;string = 改为某父;校验循环 + 深度 + type
  type?: "income" | "expense";          // 受限 (见下)
}
```

**Output**: 更新后的 Category 完整对象

**校验顺序**:
1. session → 401
2. id 存在 + isBuiltIn=false + family_id 匹配 → 404 (不存在或跨家庭或内置)
3. zod schema → 400
4. **type 切换限制** (FR-013): 若 type 变化且(已被 transactions 引用 OR 有子分类 OR 已归档) → 400
5. **parentId 变化限制** (FR-010): 若当前分类已有子分类,不允许设 parentId → 400
6. **parentId 校验** (FR-005): 若提供 parentId:存在 + 同家庭/内置 + 是顶级 + 不自引用 + type 一致 → 400
7. **已归档分类限制** (FR-014): 若 archivedAt ≠ null,只允许改 name/icon/sortOrder → 400
8. 唯一性 (排除自身) → 409
9. UPDATE category + INSERT category_event(category_edited, before/after)

**Last-Write-Wins**: 无版本号 (与 004 一致),并发覆盖

**错误**: 401, 400, 404, 409, 500

---

### `category.reorder` (018 新增 — 批量重排,满足 FR-031(d) 原子性)

**Input**:
```ts
{
  items: Array<{
    id: string;                         // UUID,必须 isBuiltIn=false 且属于当前家庭
    sortOrder: number;                  // 新 sortOrder 整数值
  }>;
}
```

**Output**: `{ success: true, updated: string[] }` — 实际更新的 id 列表 (按 items 顺序)

**事务** (单一 DB 事务内,保证 FR-031(d) 原子性):
1. 校验所有 id 存在 + 同家庭 (跨家庭 → 404) + 全 isBuiltIn=false (含内置 → 403)
2. 校验所有 id **同 parentId** (即同级,跨级批量 → 400 "reorder 仅支持同级分类")
3. 校验 items 内 sortOrder 值合法 (整数 + 数组内唯一 + ≥ 0)
4. `SELECT FOR UPDATE` 锁定所有目标行 (防并发编辑)
5. `UPDATE categories SET sort_order = $new, updated_at = now() WHERE id = $id` × N
6. `writeCategoryEventsBatch` 写 N 条 `category_edited` 事件 (before={sortOrder:旧值}, after={sortOrder:新值},其他可变字段不写入,因未变)
7. 任一步失败 → 整事务回滚,所有 sortOrder 不变

**用途**: 前端拖拽触发 FR-031(d) 全重排 (整数间隔耗尽) 时,客户端先用 `renumberSortOrders(count)` (T002) 算出 N 个新 sortOrder `[10, 20, ..., N*10]`,再一次性调用 reorder。**避免** N 次独立 `category.update` (非原子,中途失败留脏数据,违反 FR-031(d))。

**调用示例**:
```ts
// 前端拖拽耗尽间隔时
const newOrders = renumberSortOrders(siblings.length); // [10, 20, ..., N*10]
await trpc.category.reorder.mutateAsync({
  items: siblings.map((s, i) => ({ id: s.id, sortOrder: newOrders[i] })),
});
```

**错误**: 401 (未登录), 403 (含内置), 404 (跨家庭/不存在), 400 (跨级 / sortOrder 不合法 / 数组空 / 数组超 200), 500 (infrastructure)

---

### `category.archive` (018 新增)

**Input**: `{ id: string }` (必须 isBuiltIn=false 且属于当前家庭)

**Output**: `{ success: true, archivedChildren: string[] }` — archivedChildren 是被级联归档的子分类 ID 列表

**事务** (单一 DB 事务内):
1. 校验 id 存在 + isBuiltIn=false + family_id 匹配 → 404 (跨家庭/内置)
2. SELECT parent + children (WHERE parent_id = id) FOR UPDATE (锁)
3. UPDATE parent SET archived_at = now()
4. UPDATE children SET archived_at = now() WHERE parent_id = id AND archived_at IS NULL
   - 注: 已归档的子不变 (但 archived_at 仍是 timestamp;若需保留原 timestamp,加 `AND archived_at IS NULL`)
5. INSERT 1 + N 条 category_event(category_archived)

**级联行为**:
- 父归档 → 子同步归档 (子失去父失去意义)
- 子被独立归档过的,父归档时不变 (已是 timestamp);反归档父时统一复活 (Clarify Q2)

**错误**: 401, 403 (内置), 404 (跨家庭), 500

---

### `category.unarchive` (018 新增)

**Input**: `{ id: string }` (必须 isBuiltIn=false 且属于当前家庭)

**Output**: `{ success: true, unarchivedChildren: string[] }` — unarchivedChildren 是被强制复活的子分类 ID 列表

**事务**:
1. 校验 id 存在 + isBuiltIn=false + family_id 匹配 → 404
2. SELECT parent + children FOR UPDATE
3. UPDATE parent SET archived_at = NULL
4. UPDATE children SET archived_at = NULL WHERE parent_id = id — **强制级联复活** (Clarify Q2)
5. INSERT 1 + N 条 category_event(category_unarchived)

> **强制复活语义**: 子无论 prior archived state,统一 archived_at = NULL。若用户希望某子保持归档,反归档父后手动 archive 该子。

**错误**: 401, 403 (内置), 404, 500

## 客户端调用示例 (前端参考)

```ts
// 列表 (内置 + 自定义,层级)
const { data } = trpc.category.list.useQuery({ type: "expense" });
// data: [{ id, name, icon, ..., children: [...] }]

// 创建二级分类
const create = trpc.category.create.useMutation();
await create.mutateAsync({
  type: "expense",
  name: "狗粮",
  icon: "🐶",
  parentId: parentCategory.id,  // 父 type 必须为 expense
});

// 拖拽排序 (插中位或触发全重排)
const update = trpc.category.update.useMutation();
const mid = Math.floor((prev.sortOrder + next.sortOrder) / 2);
if (mid > prev.sortOrder) {
  await update.mutateAsync({ id: draggedId, sortOrder: mid });
} else {
  // 触发同级全重排 (调用 batch endpoint,TBD in tasks)
}

// 归档父 + 自动级联子
const archive = trpc.category.archive.useMutation();
const { archivedChildren } = await archive.mutateAsync({ id: parentId });
```

## 不实现的 procedure (Out of Scope)

- ❌ `category.delete` (硬删) — V1.5 不实现 purge,延后 V2
- ❌ `category.merge` — V2 评估
- ❌ `category.purge` — V2 评估 (需"未被引用 + 已归档 + 二次确认")

## 类型导出 (供前端 import)

```ts
// src/server/api/routers/category.ts 末尾
export type CategoryRouter = typeof categoryRouter;
// 客户端自动通过 tRPC 推断 input/output 类型,无需手写
```
