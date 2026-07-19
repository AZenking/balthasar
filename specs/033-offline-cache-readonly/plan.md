# Implementation Plan: 033 离线可读 + 写入队列同步(B 级离线)

**Branch**: `033-offline-cache-readonly` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/033-offline-cache-readonly/spec.md`

## Summary

为 BALTHASAR PWA 增加 B 级离线能力:断网时可查看 Dashboard 摘要 + 近期 30 天交易列表
(只读兜底),断网记账写入本地待同步队列、联网后台静默同步。读取采用 network-first
(缓存仅在服务器请求失败时兜底,弱网仍是服务器优先,不显示陈旧数据)。不做 C 级双写/
冲突解决/离线编辑删除。这是 032 P4 排除的大工程,承接既有 PWA 外壳(029/031/032)。

## Technical Context

**Language/Version**: TypeScript 5.x + Next.js App Router(RSC + client components)

**Primary Dependencies**(待 research 定):
- **客户端存储**:IndexedDB 封装库(Q1 候选:`idb` / `dexie` / `localforage`,net-new,项目
  当前无此类依赖)
- **tRPC v11**(`@trpc/react-query` + `@trpc/client`):`createTRPCReact<AppRouter>()` +
  `httpBatchLink`(url `/api/trpc`,superjson transformer)。离线兜底需在 link 或 React Query
  层拦截(Q2)
- **React Query**(tRPC 底层):`queryClient` 的 retry/placeholderData/initialData 选项
- **Background Sync API**(浏览器原生):SW `sync` 事件(Q4);iOS 不支持需降级
- **既有 PWA**:`public/sw.js`(手写,非 Workbox)+ `service-worker-client.ts` + `pwa-provider.tsx`
- **既有 031**:`draft-storage`(localStorage 草稿,本 feature 不合并,语义不同)

**Storage**:
- **客户端**:IndexedDB(浏览器持久化,~< 10MB)。存:30 天交易 + 当前月摘要 + 待同步队列 +
  缓存元数据。带版本号(schema 演进时丢弃重建)。
- **服务器**:**可能新增** `transactions.clientRequestId` 列(Q3 research 决策,幂等去重,
  需 Drizzle migration)。否则无服务器表变更。

**Testing**: Vitest(宪章原则四)。本 feature 以**纯函数 + hook + 集成**为主:
- 缓存读写纯函数(从 tRPC response 抽取/序列化、保留期过滤、版本检查)→ node 单测。
- tRPC link/React Query fallback 行为 → jsdom 组件测(mock fetch 失败 → 回退 IDB)。
- 队列状态机(入队/重试/出队/失败上限)→ 纯函数单测(类似 031 controller 模式)。
- 幂等去重(若 Q3 选 `clientRequestId`)→ procedure 测 + 集成测(createCaller + testcontainers)。
- SW `sync` handler + 前台降级 → 较难单测,主要靠真机/DevTools 走查(NEEDS-MANUAL)。

**Target Platform**: PWA / 移动浏览器(iOS Safari、Android Chrome)+ 桌面 Chrome/Edge。
Background Sync 以 Android Chrome + 桌面 Chrome 为主;iOS Safari 降级为前台重试(已知限制)。

**Project Type**: 全栈 Web 应用(Next.js App Router + tRPC + Drizzle)。本 feature 触及:
客户端(`src/lib/offline/` 新模块、`src/components/pwa/` UI、`src/lib/trpc/client.ts` link
层)、SW(`public/sw.js` 加 sync handler)、服务器(若 Q3:`transactions` migration +
procedure 幂等)。跨全栈。

**Performance Goals**: 宪章五"10 秒记账"——离线记账入队列 < 1 秒(SC-003);缓存读 <
2 秒(SC-001);后台同步 < 30 秒(SC-004)。不增加正常网络下的查询延迟(network-first
不引入额外往返)。

**Constraints**:
- 宪章原则四:测试优先,纯函数先测。
- 宪章原则六 YAGNI:不引入双写/冲突解决(C 级);缓存版本号丢弃重建不迁移。
- 宪章原则七:触及 UI(离线模式提示、待同步徽标),MUST 先查 `/heroui-react` skill。
- 不破坏既有 PWA 功能(SW/离线 offline.html/安装/更新/031 草稿)—— 回归 0 缺陷。
- **数据完整性**(财务):幂等去重必须可靠,重复记账 = 余额错。

**Scale/Scope**: 大 feature(4 US + 16 FR)。建议分多 PR 交付(PR-1 读缓存 US1+US3 →
PR-2 写入队列 US2+幂等 → PR-3 空间管理 US4 + Polish)。

**NEEDS CLARIFICATION(交 Phase 0 research)**:
- Q1: IDB 封装库选型(idb / dexie / localforage)
- Q2: tRPC query 拦截方案(custom link vs React Query default options)
- Q3: 幂等去重方案(clientRequestId 列 vs 客户端乐观检查)— **关键**,影响服务器 migration
- Q4: Background Sync 与既有手写 SW 集成 + SW 内调用 tRPC 的复杂度(既有 `/api/v1/transactions`
  用 API Key auth 不适用 session-cookie 场景,可能需新增 session 友好端点或 SW 复用 fetch 带 cookie)

## Constitution Check

*GATE: Phase 0 研究前必过。Phase 1 设计后复查。*

| 原则 | 状态 | 说明 |
|---|---|---|
| 一、MVP 范围 | ✅ 通过 | 离线能力服务既有 MVP(记账/查看)的可靠性,非投机功能。Q3 若新增 `clientRequestId` 列,是对既有 Transaction 聚合的增强(幂等去重),可追溯至 MVP"编辑/删除"的可靠性。 |
| 二、Feature-Sliced | ✅ 通过 | 客户端集中在 `src/lib/offline/`(新 feature slice)+ 触及 transaction/dashboard slice 的读取层 + SW(public/)。不引入跨 slice 抽象。 |
| 三、领域驱动 | ⚠️ 条件 | Q3 若加 `clientRequestId` 列:它是**技术去重字段**(非领域概念),不破坏 Family 聚合根;但需在 procedure 强制幂等不变量。Family 仍是唯一聚合根。Phase 1 复查。 |
| 四、测试优先 | ✅ 通过 | 纯函数(序列化/保留期/版本/队列状态机)先测;procedure 幂等用 createCaller + testcontainers;SW/真机 NEEDS-MANUAL。 |
| 五、性能与极速录入 | ✅ 通过 | 直接服务"10 秒记账"(断网不阻断);SC-003 入队 < 1s。network-first 不增正常网络延迟。 |
| 六、简单(YAGNI) | ✅ 通过 | 严格排除 C 级(双写/冲突/离线编辑删除);缓存版本号丢弃重建不迁移;保留期不暴露用户调;不引入 Workbox(既有手写 SW 延续)。 |
| 七、UI 调整纪律 | ⚠️ 条件 | 触及 UI(离线模式提示、待同步徽标),MUST 先查 `/heroui-react`。Phase 1 决定 UI 改动范围。 |

**无硬违反。原则三/七为条件触发,Phase 1 复查。Complexity Tracking 表暂空。**

## Project Structure

### Documentation (this feature)

```text
specs/033-offline-cache-readonly/
├── plan.md              # This file
├── research.md          # Phase 0: Q1-Q4 技术决策(存储/拦截/幂等/SW sync)
├── data-model.md        # Phase 1: 4 个客户端实体 + 可能的服务器 clientRequestId 列
├── quickstart.md        # Phase 1: DevTools Offline + 真机走查验证指南
├── contracts/
│   ├── cache-strategy.md       # network-first + 缓存兜底契约
│   ├── sync-queue.md           # 待同步队列状态机契约
│   └── idempotency.md          # clientRequestId 幂等契约(若 Q3 选此)
└── checklists/
    └── requirements.md  # /speckit-specify 产出
```

### Source Code (repository root)

```text
src/
├── lib/offline/                      # ← 新 feature slice(客户端离线层)
│   ├── db.ts                         #   IDB 打开/迁移(Q1 选型)
│   ├── cache-read.ts                 #   读缓存(summary / transactions 兜底)
│   ├── cache-write.ts                #   写缓存(从 tRPC response 抽取 + 保留期过滤)
│   ├── cache-meta.ts                 #   版本号 / 最后同步时间 / 保留期
│   ├── queue-store.ts                #   待同步队列 CRUD(纯函数核心)
│   ├── queue-state.ts                #   队列状态机(入队/重试/出队/失败上限)
│   └── __tests__/                    #   纯函数单测(node)
├── lib/trpc/
│   └── client.ts                     # ← 加 offline-fallback link(Q2 决策)
├── components/pwa/
│   ├── offline-banner.tsx            # ← 新:"离线模式"轻量提示
│   └── pending-sync-badge.tsx        # ← 新:待同步徽标(可选)
├── app/
│   ├── providers.tsx                 # ← 可能加 offline 状态 provider
│   └── (app)/...                     # ← Dashboard / 流水页接 offline banner
└── server/
    ├── db/schema/transaction.ts      # ← Q3 若选:加 clientRequestId 列 + unique index
    ├── db/migrations/                # ← 新 migration
    └── api/routers/transaction.ts    # ← Q3:create procedure 幂等去重

public/
└── sw.js                             # ← 加 sync handler(Q4)+ 前台降级钩子
```

**Structure Decision**: 客户端集中在新 `src/lib/offline/` slice(纯函数 + hook + store),
遵循 031 的"纯函数抽出来便于单测"模式。服务器侧改动最小(仅 Q3 若选 clientRequestId)。
SW 在既有 `public/sw.js` 上加 `sync` 事件 handler(不替换为 Workbox,YAGNI)。

## Complexity Tracking

> Phase 0 前:无硬违反。Phase 1 后复查(research R1-R4 已决)。
> **Post-design 复查(research R3/R4 后)**:R3 服务器列 + R4 session-authed REST 端点是
> **必要复杂度**(财务完整性 + iOS 可用性),非违反。逐条登记如下:

| 复杂度 | Why Needed(必要理由) | Simpler Alternative Rejected Because(为何简方案不够) |
|---|---|---|
| R3:`clientRequestId` 列 + unique index + migration | 财务数据完整性——重复记账 = 余额错,用户最不能容忍;Background Sync at-least-once 投递必然有 retry | 客户端乐观检查(b)有 TOCTOU 竞态(SW retry + 前台 flush + 在途 React Query retry 同时 POST);财务不可接受 |
| R3:tRPC procedure + REST 双处去重 | 两条提交路径都要幂等(tRPC 在线直提 + REST SW 同步) | 只改一处会留另一条路径重复风险 |
| R4:新增 session-authed REST 端点(`/api/v1/transactions/sync`) | SW 无法用 API Key(既有 `/api/v1` auth),也无法干净调 tRPC(batch envelope + superjson 手搓脆弱) | 复用既有 API Key 端点 = auth 不匹配;SW 内调 tRPC = 手搓 envelope 脆弱无文档 |
| R4:共享 `public/sw-idb.js`(importScripts) | SW 与 page 不同 scope,需一致 store 名/schema | 各写一份会漂移 |

**宪章原则三复查(clientRequestId)**:它是**技术去重字段**(非领域概念),Family 仍是唯一
聚合根,不破坏领域模型。procedure 层强制幂等不变量(命中返回既有,不报错)。**原则三通过**。
**宪章原则七复查**:offline-banner / pending-sync-badge 触及 JSX/className,实现前查
`/heroui-react`(已在 contracts/ 标注)。**原则七条件触发,合规**。

无其它违反。
