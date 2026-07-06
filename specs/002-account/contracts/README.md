# Contracts: 002-account

**状态**: T3 Stack v2.0.0 —— 本目录不维护 REST 契约文件。tRPC 类型自动推断。

## 入口端点 (5 个 procedure)

| 功能 | tRPC 路径 | 类型 | 鉴权 |
|---|---|---|---|
| 创建账户 | `trpc.account.create.useMutation()` | mutation | protectedProcedure (FR-006 自动派生 familyId) |
| 列出账户 | `trpc.account.list.useQuery({ includeArchived?: boolean })` | query | protectedProcedure |
| 编辑账户 | `trpc.account.update.useMutation()` | mutation | protectedProcedure (FR-009 不可改 initialBalance) |
| 归档账户 | `trpc.account.archive.useMutation()` | mutation | protectedProcedure (FR-010) |
| 取消归档 | `trpc.account.unarchive.useMutation()` | mutation | protectedProcedure (FR-010) |

## Input / Output 类型 (示例)

```typescript
// create
{
  name: string;                  // 1-50 字符,zod 强制
  currency: 'CNY' | 'USD' | 'EUR' | 'JPY' | 'HKD' | 'GBP' | 'AUD' | 'CAD' | 'SGD';
  initialBalance: number;        // 单位"分",允许负数
}
// → 返回 { id, familyId, name, currency, initialBalance, archivedAt: null, createdAt, updatedAt }

// list
{ includeArchived?: boolean }    // 默认 false
// → 返回 Account[],按 createdAt 倒序

// update (注意: initialBalance 字段不在 input,服务端忽略)
{
  id: string;
  name?: string;
  currency?: Currency;
}
// → 返回更新后的 Account

// archive / unarchive
{ id: string }
// → 返回 { id, archivedAt: Date | null }
```

## 跨家庭隔离 (FR-012, SC-003)

所有 `update` / `archive` / `unarchive` 在 WHERE 加 `family_id = $currentFamilyId`,本家庭外的账户 ID 一律返回 `NOT_FOUND` (不暴露"存在但无权限")。

## 详细 procedure schema

见 `src/server/api/routers/account.ts`。输入/输出 zod schema 在 procedure 处声明,TS 类型自动派生到 client (无需手写契约)。
