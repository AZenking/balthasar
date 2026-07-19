# Data Model: 033 离线可读 + 写入队列同步(B 级离线)

**Branch**: `033-offline-cache-readonly` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

## 服务器持久化实体

**可能新增 1 列**(取决于 research Q3 决策):

### transactions 表(既有,可能加列)

若 Q3 选 `clientRequestId` 方案(幂等去重):

| 列 | 类型 | 说明 |
|---|---|---|
| `client_request_id` | `uuid` (nullable, **新增**) | 客户端生成的 UUID,用于幂等去重。(family_id, client_request_id) UNIQUE INDEX,重复提交返回既有交易而非新建。 |

**不变量**:本列是**技术去重字段**,非领域概念(用户/家庭不感知它)。procedure 层强制:若
提交带 `clientRequestId` 且 (familyId, clientRequestId) 已存在,返回既有 transaction(幂等),
不新建。不带 `clientRequestId` 时(向后兼容,如 API Key 走 `/api/v1/`),走原逻辑。

依据宪章原则三:`clientRequestId` 不破坏 Family 聚合根(Family 仍是唯一聚合根,Transaction
仍在其内),只是 Transaction 多了一个技术性自增字段。

其它服务器表无变更。

## 客户端持久化实体(IndexedDB,非服务器 DB)

存在浏览器 IndexedDB,~< 10MB,带版本号(schema 演进时丢弃重建)。4 个 object store:

### CE-1: CachedTransaction(缓存交易)

- **职责**:近期交易的本地副本,断网时流水页兜底显示。
- **字段**:服务器返回的交易字段(id / type / amount / accountId / categoryId / remark /
  occurredAt / createdAt / updatedAt + toAccountId/isRefund)+ `cachedAt`(写入时间戳)+
  `familyId`(用于 scope 隔离)。
- **主键**:`id`(服务器 UUID)。
- **索引**:`occurredAt`(排序)、`familyId + occurredAt`(范围查询)。
- **保留期**:`occurredAt` 在保留期内(默认 30 天)的才保留;过旧由清理任务移除。
- **关系**:属于一个家庭。

### CE-2: CachedDashboardSummary(缓存月摘要)

- **职责**:当前月份 Dashboard 聚合数据的本地副本,断网时 Dashboard 兜底显示。
- **字段**:服务器 `dashboard.summary` 返回的全部字段(本月收入/支出/预算进度/趋势等)+
  `cachedAt` + `familyId` + `year` + `month`。
- **主键**:`familyId + year + month`(复合)。
- **保留**:当前月份 + 上月(可选,实现决定);跨月时新月度覆盖。
- **关系**:属于一个家庭 + 年月。

### CE-3: PendingTransaction(待同步队列项)

- **职责**:断网记账产生的待提交交易,联网后台同步。
- **字段**:
  - `clientRequestId`(客户端生成 UUID,主键,**同时作为服务器幂等键**,见 Q3)
  - `formPayload`(完整表单数据:type/amount/accountId/categoryId/remark/occurredAt/toAccountId)
  - `createdAt`(入队时间戳,排序用)
  - `status`:`pending` / `syncing` / `failed`
  - `retryCount`(重试次数,达上限转 failed)
  - `lastError`(最后一次失败原因,用于 UI 提示)
  - `familyId`(scope 隔离)
- **主键**:`clientRequestId`。
- **索引**:`status + createdAt`(查询 pending 队列,按入队顺序)。
- **状态机**:`pending → syncing → (success: 出队) | (fail: retryCount++ → pending,或达上限 → failed)`。
- **语义区分**:与 031 `draft-storage` 的草稿**不同**——草稿是"用户未点提交",PendingTransaction
  是"用户已点提交但断网未达服务器"。两者独立 object store,不合并。

### CE-4: CacheMeta(缓存元数据)

- **职责**:缓存版本号、最后同步时间、保留期配置等。
- **字段**:
  - `schemaVersion`(整数,当前 1;不匹配时整个 IDB 丢弃重建)
  - `lastSyncedAt`(最后成功同步时间,UI 可选展示)
  - `retentionDays`(保留期,默认 30,上限 90,内部参数不暴露用户)
- **主键**:singleton(`id: "meta"`)。
- **关系**:全局单例。

## 关系图

```text
IndexedDB (balthasar-offline, schemaVersion: 1)
  ├─ transactions          (CE-1)  [keyPath: id,        index: occurredAt, familyId+occurredAt]
  ├─ dashboard_summaries   (CE-2)  [keyPath: family+ym, 单例 per family+month]
  ├─ pending_queue         (CE-3)  [keyPath: clientRequestId, index: status+createdAt]
  └─ meta                  (CE-4)  [singleton]

服务器 PostgreSQL(可能加列,取决于 Q3)
  └─ transactions
       └─ client_request_id  (新,nullable,UNIQUE per family) ← 幂等去重键
```

## 验证规则(从 spec FR 提取)

- **保留期过滤**(FR-001/FR-010):`CachedTransaction.occurredAt >= now - retentionDays`,
  超出的清理;`PendingTransaction` 不受保留期影响(必须同步成功才出队)。
- **版本检查**(FR-014):读写前检查 `CacheMeta.schemaVersion`,不匹配则 `deleteDatabase` 重建。
- **scope 隔离**:所有读写按 `familyId` 过滤(多家庭场景不串数据)。
- **队列顺序**(FR-006):按 `createdAt` 升序逐条提交。
- **失败上限**(FR-007):`retryCount` 达上限(建议 5)转 `failed`,提醒用户;401 认证失效
  立即转 `failed` 不重试。
- **幂等**(FR-008,若 Q3 选):`clientRequestId` 全局唯一,服务器去重。
