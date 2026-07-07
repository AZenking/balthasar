# Phase 0 Research: 004-transaction

**Date**: 2026-07-07
**Status**: Complete
**Source spec**: [spec.md](./spec.md)
**Source plan**: [plan.md](./plan.md)

本 feature 复用 001/002/003 的技术栈 (T3 + Drizzle + Better-Auth + PostgreSQL),Phase 0 决策聚焦于 004-transaction 特有的设计点。宪章 v2.0.0 是权威约束。

3 项 Clarification 已在 spec 阶段确认 (Q1 signed bigint / Q2 UTC / Q3 LWW),本文件细化实施层面决策。

---

## Q1: amount 符号转换的代码位置 — procedure vs domain

### Decision
**Domain 纯函数 `applySign(type, amount) → signedAmount`**,procedure 在 create/update 时调用,把前端传的正数 amount 按 type 转为 signed 后存 DB。

### Rationale
- **可测试**: 纯函数无 IO,Vitest 单元测试覆盖 (income→正、expense→负、zero 边界)。
- **明确性**: 符号转换逻辑单一真相源,不分散在 create + update procedure。
- **与 002 currency/validate 模式一致**: domain 层是纯函数,procedure 是 orchestration。
- **响应时反向转换**: `serializeTransaction` 把 DB 中的 signed amount 转 `abs()` 返回正数 (前端不感知 signed 语义)。

### Implementation
```typescript
// src/server/domain/transaction/validate.ts
export function applySign(type: 'income' | 'expense', amount: number): number {
  // amount is guaranteed > 0 by zod; expense → negative for DB storage
  return type === 'expense' ? -amount : amount;
}

// procedure
const signedAmount = applySign(input.type, input.amount);
await tx.insert(transaction).values({ ..., amount: signedAmount });

// serialize (response)
function serializeTransaction(row) {
  return { ..., amount: Math.abs(row.amount), type: row.type, ... };
}
```

### Alternatives Considered
- **DB trigger 自动加符号**: 拒绝。增加迁移复杂度,且 trigger 与 001 决策 (应用层 $onUpdate) 不一致。
- **procedure 内 inline 转换**: 拒绝。create + update 重复代码,domain 纯函数更可测。

---

## Q2: type 与 categoryId 匹配的校验位置

### Decision
**procedure 内显式查询 + 校验**,在 create/update mutation 中:
1. 查 categoryId 行,确认 `category.type === input.type`
2. 查 accountId 行,确认 `account.familyId === currentFamilyId` 且 `archivedAt IS NULL`

### Rationale
- **单一查询**: 一次 SELECT 拿到 category.type,与应用 type 对比。
- **明确错误**: 不匹配 → BAD_REQUEST "分类类型与交易类型不匹配";family/account 校验失败 → BAD_REQUEST "账户不存在或已归档"。
- **与 002 update 校验模式一致**: 单查询取行 + 应用层断言。
- **避免 JOIN 副作用**: 创建时不需要 JOIN,只读校验。

### Alternatives Considered
- **DB 复合外键 / CHECK 约束**: 拒绝。type 与 categoryId 类型匹配是业务规则,不是 schema 约束 (categoryId 引用 categories.id 是 FK,但 type 与 category.type 匹配不能简单用约束表达)。
- **zod refine + 异步查 DB**: 拒绝。zod 是同步,不能查 DB;改为 procedure 内显式校验更直接。

---

## Q3: transaction.get 的 JOIN 策略 — 单查询 vs 多查询

### Decision
**单查询 Drizzle JOIN** —— `SELECT t.*, a.name as accountName, c.name as categoryName, c.icon as categoryIcon FROM transactions t LEFT JOIN accounts a ON ... LEFT JOIN categories c ON ... WHERE t.id = $id AND t.family_id = $familyId`。

### Rationale
- **单 round-trip**: 一次 DB 查询返回所有字段,避免 N+1。
- **Drizzle 原生支持**: `db.select({ ...transaction, accountName: account.name, ... }).from(transaction).leftJoin(...)`.
- **索引利用**: PK `transactions.id` + FK 索引覆盖 JOIN。
- **LEFT JOIN**: 即使 account 被硬删除 (本 MVP 不允许,但 V2 评估时可能),仍能返回交易记录 + null accountName。
- **跨家庭隔离**: WHERE `t.id AND t.family_id` 单条件,与 002 update 模式一致。

### Alternatives Considered
- **3 次独立 SELECT**: 拒绝。N+1 风险,延迟累积。
- **GraphQL-style 嵌套 resolver**: 拒绝。tRPC 不需要这种复杂度,MVP 单 JOIN 足够。

---

## Q4: 硬删除审计 — before/after 字段填充策略

### Decision
**`transaction_deleted` 审计事件的 `before` jsonb 填充被删行的可变字段快照**,`after` 为 null。

### Rationale
- **审计完整性**: 删除时记录"删了什么",便于事后追溯 (虽然 MVP 不暴露审计查询,但 V2 用)。
- **before 非空**: 删除 = 状态从"存在"变为"不存在",before 记录"存在时的最后状态"。
- **after null**: 删除后没有"新状态",与 create (before null) 对称。
- **不存 amount 等数值**: 仅可变字段快照 (type/accountId/categoryId/amount/remark/occurredAt),不存 id/createdAt/familyId 等元字段。

### Alternatives Considered
- **before/after 都 null**: 拒绝。失去审计意义,V2 无法追溯被删内容。
- **完整 row 快照 (含所有字段)**: 拒绝。冗余,familyId/createdAt 等不变字段无意义。

---

## Q5: `transaction.list` 是否在本 feature 实现

### Decision
**本 feature 实现** `transaction.list({ limit?: number, cursor?: string })` **基础查询** (FR-010),按 `occurredAt DESC` 排序,提供 limit + cursor 分页 (避免一次性返回大量行)。

### Rationale
- **US2 get 之外需要 list**: dashboard / 流水页 (005/006) 都需要,本 feature 先实现基础版本,避免后续 feature 重复造轮子。
- **分页必须**: MVP 家庭规模 ~1200 行/年,不分页会拖慢首屏 (违反 SC-001 10s 目标的延伸 —— 列表也要快)。
- **cursor 分页**: 用 `occurredAt` 作为 cursor (天然有序,且新插入不会影响旧页);比 offset 分页高效。
- **limit 默认 50**: 平衡首屏速度与数据量。

### Implementation
```typescript
list: protectedProcedure
  .input(z.object({ limit: z.number().min(1).max(100).default(50), cursor: z.string().datetime().optional() }).optional())
  .query(async ({ input, ctx }) => {
    const familyId = await loadFamilyIdByUserId(ctx.session.user.id);
    const limit = input?.limit ?? 50;
    const cursor = input?.cursor ? new Date(input.cursor) : undefined;
    const rows = await db.select({ ...transaction, accountName: account.name, ... })
      .from(transaction)
      .leftJoin(account, eq(transaction.accountId, account.id))
      .leftJoin(category, eq(transaction.categoryId, category.id))
      .where(and(
        eq(transaction.familyId, familyId),
        cursor ? lt(transaction.occurredAt, cursor) : undefined,
      ))
      .orderBy(desc(transaction.occurredAt))
      .limit(limit + 1);  // +1 to detect hasMore
    // ...
  });
```

### Alternatives Considered
- **延后到 005-transactions-list**: 拒绝。dashboard 也需要基础查询,延后会导致 006 也要等 005。本 feature 实现基础版本,YAGNI。
- **不分页 (一次返回全部)**: 拒绝。~1200 行 JSON ~ 500KB,首屏 > 1s,违反 SC 延伸。
- **offset 分页**: 拒绝。新插入会影响 offset 翻页稳定性,cursor 更鲁棒。

---

## Q6: 创建/编辑事务的复合校验顺序

### Decision
按以下顺序校验,**任一失败立即返回对应错误** (短路):

1. **zod input 校验** (type ∈ enum、amount > 0 整数、remark ≤ 200、occurredAt 范围)
2. **familyId 派生** (`loadFamilyIdByUserId`)
3. **account 校验**: `accountId` 属于当前家庭 + 未归档 (FR-005)
4. **category 校验**: `categoryId` 存在 + `category.type === input.type` (FR-006)
5. **DB 写入** (transaction + transaction_event 同事务)

### Rationale
- **短路避免无效 DB 写入**: 任一校验失败,事务不开始。
- **顺序由代价递增**: zod < familyId 查询 < account 查询 < category 查询 < 写入。前面失败就不做后面的。
- **明确错误码**: zod 失败 BAD_REQUEST,account 校验失败 BAD_REQUEST,跨家庭 transaction NOT_FOUND。

### Alternatives Considered
- **批量校验后统一返回错误**: 拒绝。返回多个字段错误用户体验略好,但增加 procedure 代码复杂度。短路更符合 RESTful 单错误码惯例。

---

## 总结

6 项决策,均对齐宪章 v2.0.0。无 NEEDS CLARIFICATION 残留,可进入 Phase 1 设计。

**核心模式**: signed bigint amount (domain 层符号转换) + cursor 分页 list + JOIN get + 短路校验链 + 硬删除审计 before-only。
