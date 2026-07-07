# Contracts: 004-transaction

**状态**: T3 Stack v2.0.0 —— 本目录不维护 REST 契约文件。tRPC 类型自动推断。

## 入口端点 (5 个 procedure)

| 功能 | tRPC 路径 | 类型 | 鉴权 |
|---|---|---|---|
| 创建交易 | `trpc.transaction.create.useMutation()` | mutation | protectedProcedure |
| 查询交易详情 (含 JOIN) | `trpc.transaction.get.useQuery({ id })` | query | protectedProcedure |
| 列出交易 (cursor 分页) | `trpc.transaction.list.useQuery({ limit?, cursor? })` | query | protectedProcedure |
| 编辑交易 | `trpc.transaction.update.useMutation()` | mutation | protectedProcedure |
| 删除交易 | `trpc.transaction.delete.useMutation()` | mutation | protectedProcedure |

## Input / Output 类型 (示例)

```typescript
// create
{
  type: 'income' | 'expense';
  accountId: string;       // UUID v7, 必须属于当前家庭 + 未归档
  categoryId: string;      // UUID v5, 必须存在 + type 匹配
  amount: number;          // > 0, 整数 (单位"分"),后端按 type 加符号
  remark?: string;         // 1-200 字符, 默认 ""
  occurredAt?: string;     // ISO 8601 with offset, 默认 now
}
// → 返回 Transaction (含 accountName, categoryName, categoryIcon via JOIN)

// list
{
  limit?: number;          // 1-100, 默认 50
  cursor?: string;         // ISO 8601 (上一页最后一笔 occurredAt)
}
// → 返回 { items: Transaction[], nextCursor: string | null }

// get
{ id: string }
// → 返回 Transaction + accountName + categoryName + categoryIcon

// update
{
  id: string;
  type?: 'income' | 'expense';  // 改 type 时同步校验 categoryId 匹配
  accountId?: string;
  categoryId?: string;
  amount?: number;              // > 0, 整数
  remark?: string;
  occurredAt?: string;
}
// → 返回更新后的 Transaction (LWW,无版本号)

// delete
{ id: string }
// → 返回 { success: true };硬删除;重复删除 → 404
```

## 跨家庭隔离 (FR-014/015)

- **account 校验** (create/update): account 不属于当前家庭 → **400 BAD_REQUEST** (字段级错误,在 input 校验阶段)
- **transaction 校验** (get/update/delete): transaction 不属于当前家庭 → **404 NOT_FOUND** (不暴露存在性)
- 两种策略不对称 —— account 是 input 字段,transaction 是操作目标。

## amount signed 语义 (Clarification Q1)

- **前端**: 始终传**正数** amount (zod 强制 > 0)
- **后端**: 按 `type` 自动加符号 —— `income` 存正,`expense` 存负
- **响应**: 后端 `Math.abs(dbAmount)` 返回正数 + 保留 `type` 字段;前端不感知 signed

## 详细 procedure schema

见 `src/server/api/routers/transaction.ts`。输入/输出 zod schema 在 procedure 处声明,TS 类型自动派生到 client。

研究决策见 [research.md](../research.md)。
