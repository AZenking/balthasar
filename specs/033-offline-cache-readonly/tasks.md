---

description: "Task list for 033-offline-cache-readonly — 离线可读 + 写入队列同步(B 级离线)"
---

# Tasks: 033 离线可读 + 写入队列同步(B 级离线)

**Input**: Design documents from `/specs/033-offline-cache-readonly/`

**Prerequisites**: [plan.md](./plan.md)(required), [spec.md](./spec.md)(required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/cache-strategy.md](./contracts/cache-strategy.md), [contracts/sync-queue.md](./contracts/sync-queue.md), [contracts/idempotency.md](./contracts/idempotency.md), [quickstart.md](./quickstart.md)

**Tests**: 宪章原则四"测试优先";纯函数(序列化/保留期/版本/队列状态机)+ procedure 幂等(createCaller + testcontainers)先红后绿;SW/真机 NEEDS-MANUAL。

**Organization**: 按 research 的 **PR 拆分 + 耦合顺序**(R3 幂等先于 R4 sync):
- Phase 1 Setup → Phase 2 Foundational(IDB 基础设施)
- Phase 3 = PR-1:R3 幂等(服务器侧,无 UI,最先做)
- Phase 4 = PR-2:R1+R2 读缓存(US1 + US3 network-first)
- Phase 5 = PR-3:R4 写入队列(US2 SW sync + iOS 降级)
- Phase 6 = PR-4:US4 空间管理 + Polish

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可并行(不同文件,无依赖)
- **[Story]**: US1..US4,映射 spec.md
- **路径**: `src/lib/offline/`(新 slice)+ `src/server/`(幂等)+ `public/`(SW)+ `src/tests/`(测试)

---

## Phase 1: Setup

**Purpose**: 验证分支干净 + 查 heroui-react(UI 组件准备)+ baseline。

- [ ] T001 验证当前分支 `033-offline-cache-readonly` 基于 main 最新(含 1.1.2 + PR #19 cleanup),`pnpm install` + `pnpm test:unit` 通过(确认 337 既有测试绿)
- [ ] T002 [P] 先调 `/heroui-react` skill 取 HeroUI v3 关于 Toast/Badge/banner 的官方文档(为 US2 入队提示 + failed 徽标 + offline-banner 做准备,宪章原则七)。把要点缓存到会话上下文
- [ ] T003 [P] 创建 `specs/033-offline-cache-readonly/baseline.md`,记录修复前 4 项现状(沿用 029/031/032 模式):(a) 完全断网能否看 Dashboard(预期:否,offline.html)(b) 能否记账(预期:报错)(c) IDB 使用(预期:无)(d) 后台同步(预期:无)。作为 after 对照

---

## Phase 2: Foundational — IDB 基础设施(R1,Blocking Prerequisites)

**Purpose**: 实现 `idb` 封装 + 4 个 object store 打开/迁移 + 版本号检查,作为所有后续 PR 的客户端存储基础。

**⚠️ CRITICAL**: Phase 3+ 的缓存读写 + 队列都依赖此 Phase。

### Tests for Foundational(test-first)

- [ ] T004 [P] 写 `src/tests/unit/offline/db-schema.test.ts`(node,fake-indexeddb 或纯函数抽 `buildSchema(version)`):断言 4 个 store 名(transactions/dashboard_summaries/pending_queue/meta)+ keyPath + index;断言 schemaVersion 不匹配时返回"丢弃重建"信号(纯函数 `shouldRebuild(metaVersion, currentVersion)`)
- [ ] T005 写 `src/lib/offline/db.ts`(**FR-014 版本号**):动态 import `idb`(SSR 安全:`typeof indexedDB !== 'undefined'` 守卫);`openOfflineDB()` 打开 `balthasar-offline` v1,建 4 store + keyPath + index;`shouldRebuild()` + `deleteDatabase()` 流程(版本不匹配先删再开)
- [ ] T006 跑 `pnpm test:unit src/tests/unit/offline/db-schema.test.ts` 确认 T004 转绿(纯函数层);T005 的 IDB 打开靠真机/jsdom 走查

**Checkpoint**: IDB 基础设施就位,Phase 3+ 可用。

---

## Phase 3: User Story 0(PR-1)— R3 幂等去重(服务器侧,最先做)

**Goal**: 新增 `transactions.clientRequestId` 列 + unique index + tRPC procedure + REST 去重逻辑 + 测试。**无 UI**。这是财务完整性的基石,research R3 标 CRITICAL——必须先于 R4(SW sync)实现,否则双 flush 会重复记账。

**Independent Test**: `transaction.create` 同 clientRequestId 两次提交 → 第二次返回与第一次同 id,DB 仍只 1 行;并发漏 SELECT 触发唯一索引兜底。

**⚠️ Why first**: research R3/R4 耦合——R4 的 SW retry + 前台 flush 竞态会重复提交,只有服务器幂等能保证安全。R3 先做,R4 才安全。

### Tests for US0(R3,test-first)

- [X] T007 [P] [US0] 写 `src/tests/integration/transaction/create-idempotency.test.ts`(testcontainers 真实 PG):同 familyId + 同 clientRequestId 两次 `createCaller(ctx).create({...})` → 断言第二次返回的 id === 第一次;断言 DB `SELECT count(*) FROM transactions WHERE family_id=?` 仅 +1(非 +2)
- [X] T008 [P] [US0] 写并发兜底测试(同文件):两个并发 create(漏 SELECT,Promise.all)→ 断言最终 DB 仅 1 行(唯一索引触发,catch 后回退返回既有,不抛错给客户端)
- [X] T009 [P] [US0] 写向后兼容测试:`create` 不带 clientRequestId → 走原逻辑成功(既有 API Key `/api/v1/` 路径不破);断言 clientRequestId 为 NULL 的行可正常建
- [X] T010 跑 `pnpm test:integration src/tests/integration/transaction/create-idempotency.test.ts` 确认 T007-T009 **红**(clientRequestId 未实现)

### Implementation for US0(R3)

- [X] T011 [US0] 改 `src/server/db/schema/transaction.ts`:新增 `clientRequestId: text("client_request_id")`(nullable)
- [X] T012 [US0] 生成 Drizzle migration:`pnpm drizzle-kit generate` → 新 migration 文件(加列 + 部分唯一索引 `CREATE UNIQUE INDEX transactions_family_client_request_idx ON transactions(family_id, client_request_id) WHERE client_request_id IS NOT NULL`)。验证 `pnpm drizzle-kit migrate` 在干净 DB + 既有 DB 都通过(既有行回填 NULL)
- [X] T013 [US0] 改 `src/server/api/routers/transaction.ts` 的 `createInput`(**FR-008 幂等**):加 `clientRequestId: z.string().uuid().optional()`;`create` procedure insert **前** `SELECT id WHERE family_id=? AND client_request_id=?` → 命中返回 `getTransactionById(既有 id)`(**不报错**,retry 幂等);未命中正常 insert 带字段。并发 catch 唯一约束错 → 回 SELECT 返回既有
- [X] T014 [US0] 跑 `pnpm test:integration src/tests/integration/transaction/create-idempotency.test.ts` 确认 T007-T009 **转绿**(宪章红 → 绿)
- [X] T015 [P] [US0] 全量 `pnpm test:unit && pnpm test:procedure && pnpm test:integration` 确认既有 transaction 测试无回归(尤其 create/list/get)
- [ ] T016 [US0] 提 PR-1:`feat(server): 033 R3 clientRequestId 幂等去重`(无 UI,纯服务器 + migration)

**Checkpoint**: 幂等就位——R4 SW sync 可安全实现。

---

## Phase 4: User Story 1 + 3(PR-2)— R1+R2 读缓存(离线可读 + network-first)

**Goal**: 客户端 IDB 缓存层(CE-1 transactions + CE-2 dashboard_summaries)+ React Query hydrator(network-first:服务器成功刷新 IDB,失败回退 IDB)+ offline-banner。断网可看 Dashboard 摘要 + 近期交易(US1),弱网仍是服务器最新(US3)。

**Independent Test**: DevTools Offline → Dashboard/流水显示缓存 + "离线模式" banner;取消 Offline 刷新 → 服务器最新;DevTools 拦 `/api/trpc` 500 → 回退缓存。

### Tests for US1/US3(test-first)

- [ ] T017 [P] [US1] 写 `src/tests/unit/offline/cache-write.test.ts`(node,纯函数):`extractTransactionsForCache(trpcResponse)` 从 tRPC `transaction.list` 响应抽取交易数组 + 标 `cachedAt`;`filterByRetention(transactions, retentionDays, now)` 过滤 30 天外(纯函数)。断言边界(恰好 30 天/跨年/空数组)
- [ ] T018 [P] [US1] 写 `src/tests/unit/offline/cache-read.test.ts`(node):`pickCachedSummary(familyId, year, month)` 与 `pickCachedTransactions(familyId, sinceDate)` 返回 IDB 数据或 null;断言 scope 隔离(不同 familyId 不串)
- [ ] T019 [P] [US3] 写 `src/tests/unit/offline/offline-signal.test.ts`(node/jsdom):`useOfflineMode` 信号模块的三源逻辑(`navigator.onLine` + online/offline 事件 + TRPCClientError 嗅探)→ 断言各组合下 signal 值
- [ ] T020 跑 `pnpm test:unit src/tests/unit/offline/cache-write.test.ts src/tests/unit/offline/cache-read.test.ts src/tests/unit/offline/offline-signal.test.ts` 确认 T017-T019 **红**(模块未实现)

### Implementation for US1/US3

- [ ] T021 [US1] 实现 `src/lib/offline/cache-write.ts`(**FR-001 缓存范围**):`writeCachedTransactions(familyId, list)` / `writeCachedSummary(familyId, year, month, summary)`(纯函数抽取 + IDB put);含 `extractTransactionsForCache` + `filterByRetention`
- [ ] T022 [US1] 实现 `src/lib/offline/cache-read.ts`(**FR-002 断网回退、FR-003 network-first**):`readCachedTransactions(familyId, sinceDate)` / `readCachedSummary(familyId, year, month)`(IDB get,无缓存返回 null)
- [ ] T023 [US3] 实现 `src/lib/offline/offline-signal.ts`(**FR-002 离线提示**):module-scope signal + `useOfflineMode()`(useSyncExternalStore)+ 三源喂入(`navigator.onLine`/online/offline/TRPCClientError 嗅探)
- [ ] T024 [US1] 改 `src/lib/trpc/client.ts` 或 query 使用点(`src/app/(app)/dashboard/page.tsx` + `src/app/(app)/transactions/page.tsx`):给 `dashboard.summary` + `transaction.list` useQuery 加 `placeholderData: () => readCached...()`;`useEffect` on `q.data` → `writeCached...()`。`QueryClient` defaults 加 `retry: 断网时停`(research R2)
- [ ] T025 [US3] 实现 `src/components/pwa/offline-banner.tsx`:读 `useOfflineMode()`,显示"离线模式"轻量提示。**宪章原则七**:先查 `/heroui-react`(T002),用 HeroUI Toast/banner slot
- [ ] T026 [US1] 在 Dashboard / 流水页布局挂载 `<OfflineBanner />`
- [ ] T027 跑 `pnpm test:unit src/tests/unit/offline/` 确认 T017-T019 转绿;`pnpm exec tsc --noEmit` + `pnpm build` 0 错
- [ ] T028 [US1] DevTools 走查(NEEDS-MANUAL):联网打开 Dashboard+流水(建缓存)→ Network Offline → 刷新,确认显示缓存 + banner;取消 Offline 刷新确认服务器最新;拦 `/api/trpc` 500 确认回退
- [ ] T029 [US1] 提 PR-2:`feat(pwa): 033 离线可读 + network-first 兜底(US1/US3)`

**Checkpoint**: 离线可读 + network-first 就位。

---

## Phase 5: User Story 2(PR-3)— R4 写入队列 + Background Sync(离线记账)

**Goal**: 断网记账入 pending_queue(含 clientRequestId)→ SW `sync` handler flush 到新 session-authed REST 端点 → iOS 前台降级。复用 PR-1 的 clientRequestId 保证幂等。

**Independent Test**: Offline 记 3 笔 → IDB pending_queue 3 条 → 取消 Offline + 触发 sync → 全部提交成功、队列清空、流水出现 3 笔;401/500 处理;iOS 前台降级。

### Tests for US2(test-first)

- [ ] T030 [P] [US2] 写 `src/tests/unit/offline/queue-state.test.ts`(node,纯函数):状态机 `nextState(item, fetchResult)` —— 2xx/409→出队;5xx/transient→retry++(pending);4xx永久→drop;401→failed 立即;retryCount>=5→failed。断言各转换 + retryCount 累加 + lastError 记录
- [ ] T031 [P] [US2] 写 `src/tests/unit/offline/queue-store.test.ts`(node):`enqueue(clientRequestId, payload, familyId)` / `getAllPending()` / `markSyncing(id)` / `deleteItem(id)` / `markFailed(id, err)` 的 IDB CRUD(纯函数抽 `serializePendingItem` / `deserialize`)
- [ ] T032 [P] [US2] 写 `src/tests/integration/api-v1-transactions-sync.test.ts`(testcontainers):新端点 `/api/v1/transactions/sync` session-authed POST 带 `X-Client-Request-Id` → 创建成功;重复 header → 返回既有(去重);401 未登录 → 401;验证 body 校验
- [ ] T033 跑测试确认 T030-T032 **红**

### Implementation for US2(R4)

- [ ] T034 [US2] 实现 `src/lib/offline/queue-store.ts`(**FR-004 入队、FR-006 顺序、FR-007 失败上限**) + `queue-state.ts`(纯函数,见 T030/T031)
- [ ] T035 [US2] 新增 `src/app/api/v1/transactions/sync/route.ts`:session-authed(Better-Auth)POST,读 `X-Client-Request-Id` header + body → 复用既有 create 业务逻辑(含 R3 去重)。返回 201 新建 / 409 dedup 命中(或 200 返回既有,research R4)
- [ ] T036 [US2] 改 `src/components/transaction/transaction-form.tsx`(**FR-004 断网入队**):onSubmit 若 `navigator.onLine === false`(或 catch network error),不抛错 → 生成 `clientRequestId = uuidv7()` → `enqueue(...)` → toast"已记录,联网后自动同步";不关 Drawer(或轻关)。**保留**在线正常提交路径
- [ ] T037 [US2] 改 `scripts/generate-service-worker.mjs`(**FR-005 后台同步**):加 `sync` event handler(tag `balthasar-flush-queue`)→ `flushQueue()`(research R4 骨架:IDB 读 pending → fetch `/api/v1/transactions/sync` credentials:include + X-Client-Request-Id → 按 queue-state 更新 IDB)。**不**直接改 `public/sw.js`(每次 build 重新生成)
- [ ] T038 [US2] 新增 `public/sw-idb.js`:共享 IDB schema(openDB + 4 store + keyPath/index),SW 经 `importScripts('/sw-idb.js')` 引入,与 page 一致
- [ ] T039 [US2] 客户端注册同步(**FR-009 iOS 降级**):入队后 `navigator.serviceWorker.ready` → `'sync' in reg ? reg.sync.register('balthasar-flush-queue') : flushInForeground()`;前台降级监听 `online` + `visibilitychange`
- [ ] T040 [US2] 实现 `src/components/pwa/pending-sync-badge.tsx`:读 pending_queue 中 status=failed 的数量,显示"待同步"徽标 + "有 N 笔未同步,点击查看";提供手动重试/丢弃入口。**宪章原则七**:先查 `/heroui-react`
- [ ] T041 跑测试 + tsc + build 确认全绿
- [ ] T042 [US2] DevTools 走查(NEEDS-MANUAL):Offline 记 3 笔 → IDB pending_queue 3 条 → 取消 Offline + Manual sync trigger → 全部提交、队列空、流水出 3 笔;拦 500 看重试;改 cookie 无效看 401 立即 failed;幂等(拦第一次响应 + 重试)看 DB 不重复
- [ ] T043 [US2] iOS 走查(NEEDS-MANUAL):iPhone Safari PWA → 飞行模式记 1 笔 → 关飞行模式不操作(不立即同步,已知)→ 打开 app → 前台 flush → 提交成功
- [ ] T044 [US2] 提 PR-3:`feat(pwa): 033 断网记账队列 + Background Sync(US2)`

**Checkpoint**: 离线可读 + 可写 + 同步就位。feature 主体完成。

---

## Phase 6: User Story 4 + Polish(PR-4)

**Goal**: 缓存空间管理(30 天保留期 + < 10MB)+ 全量校验 + baseline after 回填 + 发版准备。

### Implementation for US4

- [ ] T045 [P] [US4] 写 `src/tests/unit/offline/retention.test.ts`(node):`pruneOldTransactions(allTx, retentionDays, now)` 删除 occurredAt < now-retentionDays;断言边界(恰好保留期/全过/全留);`pruneOldSummaries(keepMonths)` 跨月清理
- [ ] T046 [US4] 实现 `src/lib/offline/cleanup.ts`(**FR-010 空间管理**):`cleanupCache(retentionDays)` 调用 prune 函数 + IDB delete;触发时机:每次 app 启动 + 每次成功同步后(轻量)
- [ ] T047 [US4] 跑测试确认 T045 转绿;tsc/build 0 错
- [ ] T048 [US4] DevTools 走查(NEEDS-MANUAL):脚本灌 100+ 笔跨 60 天 → IDB < 10MB;30 天外的不在缓存

### Polish & Cross-Cutting

- [ ] T049 [P] 全量 `pnpm test:unit && pnpm test:procedure && pnpm test:integration` 确认既有 337 + 新增测试全绿
- [ ] T050 [P] `pnpm build` + `pnpm lint` 0 error;Bundle 体积核查(idb ~3KB 增量 acceptable)
- [ ] T051 [P] 既有 PWA 回归(spec FR-015):SW 注册 / offline.html / 安装引导 / 更新流程 / 031 草稿 draft-storage 不破
- [ ] T052 [P] 桌面端回归(SC-008):桌面 Chrome 网络切换/Offline 同样可用
- [ ] T053 [P] 隐私回归(**FR-016 隐私一致**)(spec FR-016):privacy-lock 启用时,缓存数据在流水/Dashboard 同样不可见(不绕过)
- [ ] T054 把 quickstart.md §3-7 走查结果回填 `specs/033-offline-cache-readonly/baseline.md` after 区块
- [ ] T055 [P] 文档同步:`docs/AGENTS.md` 若需提离线能力则补;`docs/MVP.md` / ROADMAP 不改(离线是既有 MVP 可靠性增强)
- [ ] T056 [US4] 提 PR-4:`feat(pwa): 033 缓存空间管理 + Polish(US4)`(收尾,可发版)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,立即开始。T002/T003 与 T001 并行。
- **Foundational IDB (Phase 2)**: 依赖 Phase 1。阻塞 Phase 4/5(客户端缓存与队列都基于 IDB)。
- **Phase 3 (PR-1 R3 幂等)**: 依赖 Phase 1(不依赖 Phase 2,纯服务器侧)。**MUST 先于 Phase 5**(R4 sync 依赖 R3 幂等保证)。可与 Phase 2 并行(不同领域)。
- **Phase 4 (PR-2 读缓存)**: 依赖 Phase 2(IDB 基础)。可与 Phase 3 并行。
- **Phase 5 (PR-3 写队列)**: 依赖 Phase 2(IDB)+ **Phase 3(R3 幂等,关键)**。不可与 Phase 3 倒序。
- **Phase 6 (PR-4 Polish)**: 依赖 Phase 3+4+5 全部完成。

### Within Each Phase

- Tests(若含)**MUST** 先写并观察红,再实现转绿(宪章原则四)
- 纯函数 → IDB/hook → 组件 → 集成 → 真机走查
- 每个 Checkpoint 可独立验证、独立 PR

### Parallel Opportunities

- Phase 1: T002 ∥ T003(T001 完成后)
- Phase 2: T004(纯函数 schema)独立
- Phase 3: T007 ∥ T008 ∥ T009(不同测试用例,同文件可同 PR)
- Phase 4: T017 ∥ T018 ∥ T019(不同测试文件)
- Phase 5: T030 ∥ T031 ∥ T032(不同测试文件)
- Phase 6: T049 ∥ T050 ∥ T051 ∥ T052 ∥ T053 ∥ T055(不同关注点)

---

## Implementation Strategy

### Incremental Delivery(4 PR,按 research 耦合顺序)

1. **Phase 1-2 Setup + IDB 基础** → 客户端存储就位
2. **Phase 3 PR-1 R3 幂等**(服务器侧,无 UI)→ **先发,解锁 R4**。可独立发 patch
3. **Phase 4 PR-2 读缓存**(US1/US3)→ 离线可读,用户可感知价值。可发 minor
4. **Phase 5 PR-3 写队列**(US2)→ 离线记账,feature 主体完成。发 minor
5. **Phase 6 PR-4 空间管理 + Polish**(US4)→ 长期可用性 + 收尾。发 patch/minor

### Critical Path

**R3(Phase 3)是关键路径**:R4(Phase 5)的 SW sync 双 flush 竞态依赖 R3 幂等保证安全。
若 R3 拖延,R4 无法安全实现。**强烈建议 PR-1 最先合并**。

---

## Notes

- **测试落点约定**: `src/tests/unit/offline/`(纯函数,node)+ `src/tests/integration/transaction/` + `src/tests/integration/api-v1-transactions-sync.test.ts`(testcontainers 真 PG)+ `src/tests/procedure/`(createCaller)。沿用 031/032 模式,不用 `__tests__/` 目录。
- **真机走查为 NEEDS-MANUAL**: T028 / T042 / T043 / T048 / T052 涉及 GUI/SW/真机,沿用 baseline.md 模式,不阻塞 PR 但 MUST 在合并前完成。
- **宪章原则七**: T002(查 skill)+ T025/T026/T040(UI 组件)显式要求;任何额外 JSX/className/props 改动同此。
- **YAGNI**: 不引入 Dexie/Workbox(R1);不暴露 retentionDays 给用户调;缓存版本号丢弃重建不迁移;不做离线编辑/删除(C 级)。
- **NEEDS-MANUAL 关键路径**: Background Sync 真机验证(T042 Android + T043 iOS)无法自动化,iOS 不支持 Background Sync 是已知降级。
- **服务器侧影响**: R3 涉及 Drizzle migration + procedure + REST 新端点(T011-T015, T035)—— 是本 feature 唯一的服务器改动,与既有 tRPC `/api/v1/` 不冲突(API Key 路径走原逻辑,向后兼容)。
- **PR 顺序硬约束**: PR-1(R3)→ PR-3(R4),不可倒序(research R3/R4 耦合)。
