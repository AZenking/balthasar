# Contracts: 003-category

**状态**: T3 Stack v2.0.0 —— 本目录不维护 REST 契约文件。tRPC 类型自动推断。

## 入口端点 (2 个 procedure)

| 功能 | tRPC 路径 | 类型 | 鉴权 |
|---|---|---|---|
| 查询分类列表 | `trpc.category.list.useQuery({ type?: 'income' \| 'expense' })` | query | protectedProcedure |
| 查询单个分类 | `trpc.category.get.useQuery({ id: string })` | query | protectedProcedure |

## Input / Output 类型 (示例)

```typescript
// list (无参数 → 返回全部)
// list ({ type: 'expense' }) → 仅支出
{
  type?: 'income' | 'expense';
}
// → 返回 Category[],按 sortOrder ASC, name ASC
//    [{ id, name, type, icon, sortOrder, isBuiltIn, createdAt }, ...]

// get
{ id: string }  // UUID v5
// → 返回 Category | NOT_FOUND
```

## 跨家庭一致性

所有家庭看到同一份内置分类 (无 family_id 字段,research.md Q6)。用户 A 与用户 B 调 list 返回完全相同的数据。

## 详细 procedure schema

见 `src/server/api/routers/category.ts`。输入/输出 zod schema 在 procedure 处声明,TS 类型自动派生到 client。

研究决策见 [research.md](../research.md)。
