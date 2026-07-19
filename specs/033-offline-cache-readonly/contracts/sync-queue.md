# 同步队列契约: 状态机 + Background Sync

**Branch**: `033-offline-cache-readonly` | **Date**: 2026-07-18
**Spec**: [spec.md](../spec.md) | **Research**: [research.md](../research.md) R4

本文件是"写入路径"(断网记账 → 队列 → 后台同步)的**唯一行为契约**。

## C1. 队列项结构(PendingTransaction)

```ts
{
  clientRequestId: string  // UUIDv7,主键 + 服务器幂等键(见 idempotency.md)
  formPayload: {           // 完整表单数据(与 transaction.create input 对齐)
    type: "income" | "expense" | "transfer"
    amount: string         // RHF 格式
    accountId: string
    categoryId: string
    remark: string
    occurredAt: string
    toAccountId?: string   // transfer
  }
  familyId: string
  createdAt: number        // 入队时间戳(排序)
  status: "pending" | "syncing" | "failed"
  retryCount: number       // 达上限(5)转 failed
  lastError?: string       // 最后失败原因
}
```

**store**:`pending_queue`,keyPath `clientRequestId`,index `status+createdAt`。
**语义区分**:与 031 `draft-storage` 草稿**不同**(草稿=未点提交;队列=已点提交但断网未达),
独立 store,不合并。

满足: spec FR-004、FR-008。

## C2. 状态机

```text
点"确认记账"(断网)
    ↓ clientRequestId = uuidv7()  ← 入队时生成,每次 retry 复用
  pending ──────────► syncing(开始 flush)
    ↑                     │
    │ retryCount < 5      ├─► success → 出队(delete)
    │ 5xx/transient       │
    └─────────────────────┘
                          │
                          ├─► 4xx(永久:400/422) → 出队 + log(数据问题,不重试)
                          ├─► 401(认证失效) → failed(**立即**,不重试)→ 提示重登录
                          └─► retryCount >= 5 → failed → 提示用户手动重试/丢弃
```

| 转移 | 触发 | 动作 |
|---|---|---|
| pending → syncing | flush 开始 | status=syncing |
| syncing → 出队 | 2xx 或 409(去重命中) | delete |
| syncing → pending | 5xx / transient / network | retryCount++ |
| syncing → 出队 | 4xx 永久(400/422) | delete + log(不重试坏数据) |
| syncing → failed | 401 | status=failed(立即,不重试) |
| syncing → failed | retryCount >= 5 | status=failed,lastError 记录 |

满足: spec FR-006(顺序)、FR-007(失败上限 + 401 不重试)。

## C3. flush 触发(R4)

| 触发源 | 平台 | 实现 |
|---|---|---|
| Background Sync(`sync` event, tag `balthasar-flush-queue`) | Android Chrome / 桌面 Chrome/Edge | SW `sync` handler |
| `online` 事件 | 全平台(含 iOS) | 前台 flush |
| `visibilitychange`(可见) | 全平台 | 前台 flush |
| 入队后立即注册 | 全平台 | `'sync' in reg ? reg.sync.register : flushInForeground` |

**iOS 降级**:不支持 Background Sync → 仅前台 flush(`online` + `visibilitychange`)。已知限制。

满足: spec FR-005、FR-009(iOS 降级)。

## C4. flush 逻辑(R4 SW sync handler 骨架)

```js
async function flushQueue() {
  const db = await openIDB();
  const items = await db.getAllFromIndex('pending_queue', 'status+createdAt');
  // 仅 pending,按 createdAt 升序逐条
  for (const item of items.filter(i => i.status === 'pending')) {
    item.status = 'syncing'; await db.put('pending_queue', item);
    try {
      const res = await fetch('/api/v1/transactions/sync', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json',
                   'X-Client-Request-Id': item.clientRequestId },
        body: JSON.stringify(item.formPayload),
      });
      if (res.ok || res.status === 409) await db.delete('pending_queue', item.clientRequestId);
      else if (res.status === 401) { item.status='failed'; item.lastError='auth'; await db.put(...); }
      else if (res.status >= 400 && res.status < 500) await db.delete(...);  // 永久,drop
      else { item.retryCount++; item.status = res.status>=500||retryOver ? 'failed':'pending'; ... }
    } catch (e) { item.retryCount++; item.status = item.retryCount>=5?'failed':'pending'; ... throw e; }
  }
}
```

**端点**:新增 `src/app/api/v1/transactions/sync/route.ts`(session-authed,见 R4——既有
`/api/v1/transactions` 用 API Key auth,SW 无法复用 cookie)。
**SW 模板**:改 `scripts/generate-service-worker.mjs`,不直接改 `public/sw.js`。
**共享 IDB**:`public/sw-idb.js` 经 `importScripts()` 引入,SW 与 page 一致 store 名。

满足: spec FR-005、FR-006、FR-007。

## C5. 幂等保证(关键,R3 耦合)

每条 retry 带同一 `clientRequestId`(`X-Client-Request-Id` header)。服务器去重(见
[idempotency.md](./idempotency.md))使双 flush(SW retry + 前台 flush 竞态)安全——
重复提交返回既有 transaction,不新建。

满足: spec FR-008。

## C6. UI 提示

| 场景 | UI |
|---|---|
| 断网记一笔成功入队 | 轻量 toast "已记录,联网后自动同步"(< 1s,SC-003) |
| 队列有 failed 项 | "待同步"徽标 + "有 N 笔交易未能同步,点击查看" |
| 手动重试/丢弃 | failed 项提供操作入口 |

**触及 JSX/className** → 宪章原则七触发,查 `/heroui-react`。

满足: spec FR-007、SC-003、SC-004。
