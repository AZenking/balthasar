# Research: 033 离线可读 + 写入队列同步(B 级离线)

**Branch**: `033-offline-cache-readonly` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

本文件解决 plan Technical Context 的 4 个未知项,给出 Decision / Rationale / Alternatives。
调研依据:MDN、web.dev、tRPC 官方文档、Stripe Idempotency、Can I Use,以及对项目代码的
实地核查(tRPC client.ts / dashboard.ts / transaction.ts / sw.js / api/v1/transactions/route.ts)。

---

## R1. 客户端存储库 — `idb`(Jake Archibald 的 Promise 封装)

### Decision
采用 **`idb`**(~3KB min+gz,Promise 风格 IndexedDB 封装)。单一数据库 `balthasar-offline`,
多 object store(transactions / dashboard / queue / meta)。schemaVersion 从 1 起,用
`version()` upgrade hook,永不改既有版本号。

### Rationale
- 宪章原则六 YAGNI 主导:数据量小(< 10MB,~500 记录 + 1 summary + 小队列),访问模式简单
  (按 key 取/存、按 `(familyId, occurredAt)` 范围查)。`idb` 给完整 IndexedDB 能力 + Promise
  工效学,仅 ~3KB。
- **Dexie**(~22-30KB)提供 live queries / dexie-react-hooks / 复杂 where-clause,本 app 用不上
  → 过早引入。**localforage**(~19KB)是 key-value store,无法按 `(familyId, occurredAt)` 建
  index → 模型不对。**raw IndexedDB** 回调繁琐,`idb` 正是为消除它而生。
- TypeScript:`idb` 的 `openDB<T>` 一流泛型。
- SSR 安全:IndexedDB 不存在于服务器,必须在 `'use client'` 模块内 `typeof indexedDB !==
  'undefined'` 守卫后**动态 import**,绝不在模块顶层从 Server Component 导入。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| Dexie | live queries / react-hooks 用不上;体积 7-10 倍;YAGNI |
| localforage | key-value 模型,无法范围索引 |
| raw IndexedDB | 回调地狱,`idb` 已解决 |
| 单 DB per store | 连接管理复杂;用单 DB 多 store |

### Gotchas
- 单 DB(`balthasar-offline`)多 store,不要一 store 一 DB。
- version() upgrade hook,版本 1 起;未来 schema 变化递增版本号(但本 feature 策略是
  "不匹配则丢弃重建",见 R-cache-version)。

---

## R2. tRPC 离线兜底 — React Query defaults + IDB hydrator(**不用** custom link)

### Decision
用 React Query 的 `QueryClient` defaults + 每个 `useQuery` 旁挂一个**轻量 IDB hydrator**。
**不**写 custom tRPC link。

### Rationale
- Custom terminating-link 包装需重实现 superjson envelope 解析(逐 operation),且只看到
  序列化后的 `TRPCClientError`——无法干净区分"网络断开"(offline)与"服务器业务错误"
  (需 brittle 的 `error.shape?.data?.code` 嗅探)。更糟:它绕过 React Query 自己的缓存,
  "是否陈旧"信号丢失。
- React Query 本就拥有缓存(`@trpc/react-query` 建其上),有一流工具:`initialData` /
  `placeholderData`(hydrate)、`retry`(断网时停 hammer)、`useQuery().isPending/error`(UI)。
- 这是 tRPC v11 文档化的心智模型:**tRPC links 管传输,React Query 管缓存**。

### 实现骨架
```ts
// queryClient defaults
new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, err) =>
        navigator.onLine && !(err instanceof TRPCClientError)
          ? failureCount < 3 : false,  // 断网时不重试
      staleTime: 60_000,
    },
  },
});

// 每个需要离线兜底的 hook(dashboard / transaction.list)
const q = trpc.transaction.list.useQuery(cursor, {
  placeholderData: () => readFromIDB(`tx-list:${cursor}`) ?? undefined,
});
useEffect(() => {
  if (q.data) writeToIDB(`tx-list:${cursor}`, q.data);  // 网络成功 → 刷新缓存
}, [q.data, q.dataUpdatedAt]);
```

### "离线模式" banner 怎么取信号(关键 gotcha)
**不要**从 link 取。用一个小型 module-scope signal,由三源喂入:
- `navigator.onLine`
- `online` / `offline` 事件
- `q.error instanceof TRPCClientError && navigator.onLine === false`

`useSyncExternalStore` hook 读它。banner 读这个 store,**不读 React Query state**——避免每个
query 都触发 re-render 风暴。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| Custom tRPC link | 与 React Query 打架;仅当"所有 hook 都要兜底且不想 per-call 配置"才值,表面积大 |
| `persistQueryClient` + `createIDBPersister` | 自动持久化缓存,但缓存**一切**(含 auth-only query),无"离线读新鲜度 TTL"概念;v2 再考虑 |

---

## R3. 幂等去重 — 服务器端 `clientRequestId` 列 + unique index(**必须**)

### Decision
方案 (a):新增 `transactions.clientRequestId`(text,nullable)列 + 部分唯一索引
`(family_id, client_request_id) WHERE client_request_id IS NOT NULL`,服务器端去重。
clientRequestId 用 **UUIDv7**(时间有序,便于排查)。

### Rationale(数据完整性,财务场景不可妥协)
- 财务数据重复 = Dashboard 总额错,是用户最不能容忍的失败。方案 (b) 客户端乐观检查有
  TOCTOU 竞态:Background Sync flush + 在途 React Query retry 可能同时 POST,或两个队列
  项匹配同一既有行。**唯一正确修法是服务器唯一约束**——这是不可靠网络上 at-least-once
  投递的标准模式(HTTP `Idempotency-Key` 是 web 标准,Stripe/ fintech 都依赖)。
- 既有 `id`(UUIDv7)是服务器生成的(`$defaultFn(uuidv7)`),不能复用作幂等键(否则
  需客户端生成 id,把实体身份与去重语义耦合)。`remark`/`amount`/`occurredAt` 是用户数据
  会合法变化,不可复用。**专用 nullable 列最小且正确**。

### Schema(procedure + REST 两处都改,见 R4)
```ts
// src/server/db/schema/transaction.ts
clientRequestId: text("client_request_id"),  // nullable
// + migration:CREATE UNIQUE INDEX ... ON transactions(family_id, client_request_id)
//   WHERE client_request_id IS NOT NULL
```

### Procedure 变更(scope = 服务器)
1. `createInput` 加 `clientRequestId: z.string().uuid().optional()`。
2. `transaction.create` 在 insert **前**:`SELECT id FROM transactions WHERE family_id = ?
   AND client_request_id = ?` → 命中则**返回既有行**(返回相同响应,不是错误——retry 必须
   幂等,不报错)。
3. 唯一索引是硬兜底(两个并发 retry 漏过 SELECT 检查时)。
4. REST `/api/v1/transactions` POST 也加同样去重(R4 SW 走这条)。

### 在客户端哪里生成 UUIDv7
在 `transaction-form.tsx` 点"确认记账"那一刻生成,存入 PendingTransaction envelope,
**每次 retry 复用同一个**(不重新生成)。生成时机:入队时,不是同步时。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| (b) 客户端乐观匹配 | TOCTOU 竞态,财务不可接受;仅可作次要 UX("看起来重复,确认?") |
| 复用 `id` 作幂等键 | `id` 服务器生成;客户端生成会耦合身份与去重语义 |

### Gotchas
- migration 非破坏(nullable 列),既有行回填 NULL。
- 测试:`src/tests/integration/transaction/create.test.ts` + `src/tests/procedure/transaction.test.ts`
  加"retry 返回原 transaction"用例。
- **Q4 的双 flush(SW retry + 前台 flush 竞态)依赖 Q3 去重才安全**——这是 Q3 标 CRITICAL 的原因。

---

## R4. Background Sync — 复用既有 `/api/v1/transactions` REST(**不**在 SW 里调 tRPC)

### Decision
SW 加 `sync` handler,POST 到**既有 `/api/v1/transactions` REST 路由**(不调 `/api/trpc`)。
iOS 降级为前台 flush。**需新增一个 session-authed 的 sibling 端点**(`/api/v1/transactions/sync`
或同路由 session 分支),因为既有 `/api/v1/transactions` 用 API Key auth,SW 无法复用
session cookie。

### Rationale — 为什么不从 SW 调 tRPC
- 从 SW 调 `mutation.create` 要重建 tRPC 的 batch envelope(`POST /api/trpc?batch=1&input=...`),
  用 superjson 序列化(Date → `{$__date:...}`),解析 batched 响应 envelope。`@trpc/client`
  的 link 栈跑在 `fetch` 提供的传输上,假设 React/`window` 上下文。SW 里要手搓全部——
  脆弱且无文档支持。
- 项目**已有** `src/app/api/v1/transactions/route.ts` 做相同业务逻辑(validate → insert →
  audit),flat JSON body。**复用它**。

### 关键 gotcha — auth 不匹配
`/api/v1/transactions` POST 用 `validateApiKey(req)`(API Key in header)认证,**不**用 session
cookie。SW 无法用用户的 cookie-authed session。三选项:
1. **新增 session-authed 变体**(推荐)——新 POST 分支或 sibling 路由 `/api/v1/transactions/sync`,
   接受 session cookie via Better-Auth。约 15 LOC。**选此**。
2. 签发 per-user sync API key,SW 同步时从 IDB 读——复用既有 auth,但 key material 在 IDB
   有轻微风险。
3. Cookie-attach 同源 fetch——SW `fetch` 到 `/api/trpc/transaction/create` 确实带 cookie,
   但迫使"tRPC from SW"复杂度(已否决)。

### SW sync handler 骨架(加到 `scripts/generate-service-worker.mjs`,不直接改 public/sw.js)
```js
self.addEventListener('sync', (event) => {
  if (event.tag === 'balthasar-flush-queue') event.waitUntil(flushQueue());
});

async function flushQueue() {
  const db = await openIDB();
  const items = await db.getAll('queue');
  for (const item of items) {
    try {
      const res = await fetch('/api/v1/transactions/sync', {
        method: 'POST',
        credentials: 'include',                    // session cookie
        headers: { 'Content-Type': 'application/json',
                   'X-Client-Request-Id': item.clientRequestId },  // R3 幂等
        body: JSON.stringify(item.payload),
      });
      if (res.ok || res.status === 409) await db.delete('queue', item.id);  // 409 = dedup 命中
      else if (res.status >= 400 && res.status < 500) await db.delete('queue', item.id);  // 永久失败,drop
      else throw new Error('transient');                                       // 5xx → 保留,SW 重试
    } catch (e) { throw e; }  // re-throw → SW 自动 reschedule
  }
}
```

### 客户端注册(入队后,如 transaction-form.tsx onSubmitted 分支)
```ts
const reg = await navigator.serviceWorker.ready;
if ('sync' in reg) await reg.sync.register('balthasar-flush-queue');
else flushInForeground();  // iOS
```

### iOS 前台降级(实际多数 iOS 用户的路径)
```ts
function flushInForeground() {
  if (navigator.onLine) void doFlush();  // postMessage 给 SW 跑同一 flushQueue,或直接 client fetch
}
window.addEventListener('online', flushInForeground);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') flushInForeground();
});
```

### Gotchas
- **Background Sync 在 iOS Safari 全版本不支持**,Firefox 桌面也不支持 → 必须 feature-detect
  `'sync' in ServiceWorkerRegistration.prototype` 且**始终**接前台降级。SW sync 路径仅
  Android Chrome / Edge。
- SW 自己开 IDB(与 page 不同 scope)——schema/upgrade 代码放共享 `public/sw-idb.js`,
  经 `importScripts()` 引入,SW 与 page 一致 store 名。
- 一个 `sync` 事件 = 一个 `waitUntil`;throw 内部触发自动 backoff 重试;吞错则禁用重试。
- **去重(R3)使双 flush(SW retry + 前台 flush 竞态)安全**——这是 Q3/Q4 耦合点。
- 既有 `sw.js` 由 `scripts/generate-service-worker.mjs` 生成——**改 generator 模板**,
  不直接改 `public/sw.js`(每次 build 重新生成)。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| SW 内调 tRPC | 需手搓 batch envelope + superjson;脆弱无文档 |
| 复用既有 API Key `/api/v1/transactions` | auth 不匹配,SW 无 API Key |
| 持久化 sync API key 到 IDB | key material 风险;不如 session-authed 端点干净 |

---

## 总结:4 决策 + 服务器侧影响

| Q | Decision | 服务器影响 |
|---|---|---|
| R1 | `idb`(3KB,YAGNI) | 无 |
| R2 | React Query defaults + IDB hydrator(无 custom link) | 无 |
| R3 | `clientRequestId` 列 + unique index + tRPC/REST 双处去重 | **Drizzle migration + tRPC procedure + REST 路由 + 测试** |
| R4 | 复用 REST `/api/v1/transactions`;新增 session-authed sibling;iOS 前台降级 | **新 session-authed POST 路由 + SW generator 模板** |

**Q3 与 Q4 耦合**:R3 去重使 R4 的双 flush 安全。**实现顺序:R3 先于 R4**。

## 需回写 plan.md 的修正

- Technical Context 的"可能新增 clientRequestId 列" → 确认**新增**(R3)。
- Project Structure 加:`src/app/api/v1/transactions/sync/route.ts`(session-authed 新端点,
  R4)+ `public/sw-idb.js`(共享 IDB schema,R4)+ `scripts/generate-service-worker.mjs` 改动。
- Constitution Check 原则三:clientRequestId 是技术去重字段(非领域概念),Family 仍是唯一
  聚合根,不破坏领域模型——post-check 通过。
- Complexity Tracking:R3 服务器列 + R4 session-authed 端点是必要复杂度(财务完整性 + iOS
  可用性),非违反;记录理由。

无 [NEEDS CLARIFICATION] 残留。Phase 0 完成,可进入 Phase 1 设计。
