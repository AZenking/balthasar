# 幂等契约: clientRequestId 去重

**Branch**: `033-offline-cache-readonly` | **Date**: 2026-07-18
**Spec**: [spec.md](../spec.md) | **Research**: [research.md](../research.md) R3

本文件是"重复提交不重复记账"的**唯一保证**。财务数据完整性(余额不能因 retry 错算),
**最高优先级**契约。

## 为什么必须做(R3 决策)

Background Sync 的 at-least-once 投递语义:网络断/响应丢 → retry。若服务器收到并建了
交易但响应丢失,客户端会 retry → **第二次提交若无幂等键,会建第二笔**→ Dashboard 总额错。

唯一正确解法:**服务器端唯一约束**(HTTP `Idempotency-Key` 标准,Stripe/fintech 通用)。

## C1. Schema 变更(服务器,Drizzle migration)

```ts
// src/server/db/schema/transaction.ts
clientRequestId: text("client_request_id"),  // nullable

// migration:
// CREATE UNIQUE INDEX transactions_family_client_request_idx
//   ON transactions(family_id, client_request_id)
//   WHERE client_request_id IS NOT NULL
```

| 项 | 契约 |
|---|---|
| 列 | `client_request_id` text,nullable |
| 唯一约束 | 部分唯一索引 `(family_id, client_request_id) WHERE client_request_id IS NOT NULL` |
| 兼容性 | nullable → 既有行回填 NULL,migration 非破坏 |
| 域语义 | **技术去重字段**,非领域概念(用户/家庭不感知);Family 仍是唯一聚合根(宪章原则三合规) |

满足: spec FR-008;宪章原则三(Family 聚合根不变)。

## C2. clientRequestId 生成与生命周期

| 时机 | 动作 |
|---|---|
| 生成 | 用户点"确认记账"那一刻(`transaction-form.tsx` onSubmit 起点),`uuidv7()`(时间有序,便于排查) |
| 持久化 | 存入 PendingTransaction envelope(R4 入队),**每次 retry 复用同一值**(不重新生成) |
| 提交 | 通过 `X-Client-Request-Id` header(SW REST)+ tRPC input 字段(在线直提)两路都带 |
| 出队 | 同步成功后与 PendingTransaction 一起 delete |

**关键**:绝不在 retry 时重新生成——否则去重失效。

满足: spec FR-008。

## C3. 服务器去重逻辑(tRPC + REST 两处)

```ts
// transaction.create(tRPC)
.input(z.object({ ..., clientRequestId: z.string().uuid().optional() }))
.mutation(async ({ input, ctx }) => {
  if (input.clientRequestId) {
    const existing = await tx.select({ id: transactions.id })
      .from(transactions)
      .where(and(
        eq(transactions.familyId, familyId),
        eq(transactions.clientRequestId, input.clientRequestId),
      )).limit(1);
    if (existing[0]) {
      // 命中 → 返回既有 transaction(相同响应,不报错——retry 必须幂等)
      return getTransactionById({ id: existing[0].id, familyId });
    }
  }
  // 正常 insert,带 clientRequestId
  ...
})
```

REST `/api/v1/transactions/sync`(R4 新端点,session-authed)同样逻辑:读
`X-Client-Request-Id` header → 命中返回既有,否则 insert。

| 项 | 契约 |
|---|---|
| 检查时机 | insert **前** SELECT |
| 命中行为 | 返回既有 transaction(**不报错**,相同响应) |
| 未命中 | 正常 insert,写 clientRequestId |
| 并发兜底 | 唯一索引——两个并发 retry 漏过 SELECT 时,第二个 INSERT 触发唯一约束 → 返回 409(或 catch 后回 SELECT) |

满足: spec FR-008、FR-006(部分成功:已成功的 retry 命中既有,不重复)。

## C4. 测试覆盖(宪章原则四)

| 测试 | 路径 | 断言 |
|---|---|---|
| retry 返回原 transaction | `src/tests/integration/transaction/create.test.ts` | 同 clientRequestId 两次 create → 第二次返回与第一次同 id,DB 仍只 1 行 |
| 并发唯一约束 | 同上 | 两个并发(漏 SELECT)→ 第二个触发唯一索引 → 回退返回既有 |
| 不带 clientRequestId(向后兼容) | `src/tests/procedure/transaction.test.ts` | 既有 API Key `/api/v1/` 路径无 clientRequestId → 走原逻辑,不报错 |
| SW REST 端点去重 | `src/tests/integration/api-v1-transactions-sync.test.ts` | `X-Client-Request-Id` 重复 → 409 或返回既有,不新建 |

满足: 宪章原则四(测试优先,先红后绿)。

## C5. 耦合关系(关键)

| 耦合点 | 说明 |
|---|---|
| R3 → R4 | R3 去重使 R4 的双 flush(SW retry + 前台 flush 竞态)安全——这是 R3 标 CRITICAL 的原因 |
| 实现顺序 | **R3 先于 R4**:先有幂等键,再接 SW sync(否则双 flush 会重复记账) |
| Q3 服务器影响 | Drizzle migration + tRPC procedure + REST 新端点 + 4 处测试 |

满足: research.md "Q3 与 Q4 耦合"。
