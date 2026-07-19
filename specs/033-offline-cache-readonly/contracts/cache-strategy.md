# 缓存策略契约: network-first + IDB 兜底

**Branch**: `033-offline-cache-readonly` | **Date**: 2026-07-18
**Spec**: [spec.md](../spec.md) | **Research**: [research.md](../research.md) R1/R2

本文件是"读取路径"的**唯一行为契约**。tasks.md 实现任务 MUST 遵守;代码审查据此核对。

## C1. 存储库:`idb`(R1)

| 项 | 契约 |
|---|---|
| 库 | `idb`(Jake Archibald,~3KB),**不**用 Dexie/localforage/raw IDB |
| DB 名 | `balthasar-offline`(单 DB 多 store) |
| schemaVersion | 从 1 起,`version()` upgrade hook |
| store | `transactions` / `dashboard_summaries` / `pending_queue` / `meta` |
| SSR 安全 | IndexedDB 仅客户端;`'use client'` 模块内 `typeof indexedDB !== 'undefined'` 守卫后动态 import;绝不在 Server Component 顶层导入 |

满足: spec FR-001(缓存范围)、FR-014(版本号)。

## C2. 读取策略:network-first(R2)

| 场景 | 行为 |
|---|---|
| 服务器可达 + 成功 | 用服务器最新数据;**同时**异步刷新 IDB 缓存(`useEffect` on `q.data`) |
| 服务器请求失败(网络/超时) | 回退 IDB 缓存(`placeholderData`);UI 显示"离线模式"banner |
| 无缓存 + 断网 | offline.html 或"无缓存,请联网首次加载"提示(不空白/崩溃) |
| 弱网(慢但可达) | 等服务器响应(加载态),**不**立即显示缓存旧数据 |

**实现**:React Query `placeholderData: () => readFromIDB(...)` + `retry` 断网时停。
**不用** custom tRPC link(R2)。

满足: spec FR-002(断网回退)、FR-003(network-first)、FR-011(无缓存提示)、SC-005(总是最新)。

## C3. 缓存范围(R1 + spec Q1)

| store | 保留 | 清理 |
|---|---|---|
| `transactions` | `occurredAt >= now - retentionDays`(默认 30,上限 90) | 过旧由清理任务移除 |
| `dashboard_summaries` | 当前月 + 上月(实现决定) | 跨月时新月度覆盖 |
| `pending_queue` | 不受保留期影响(必须同步成功才出队) | 同步成功后出队 |
| `meta` | 永久(retentionDays 配置) | schemaVersion 不匹配时整个 DB 丢弃重建 |

满足: spec FR-001、FR-010(空间管理)、FR-012(范围外提示)、SC-006(< 10MB)。

## C4. "离线模式" banner 信号源(R2 gotcha)

| 项 | 契约 |
|---|---|
| 信号源 | module-scope signal,由三源喂入:`navigator.onLine` + `online/offline` 事件 + `q.error instanceof TRPCClientError && navigator.onLine === false` |
| 读取 | `useSyncExternalStore` hook(避免直接读 React Query state 导致 re-render 风暴) |
| banner 组件 | `src/components/pwa/offline-banner.tsx`,读这个 store |
| 触及 JSX/className | **宪章原则七触发**,实现前查 `/heroui-react` skill |

满足: spec FR-002(离线提示)、FR-016(隐私一致——banner 不泄露缓存内容)。

## C5. 缓存版本号(R1 + spec FR-014)

| 项 | 契约 |
|---|---|
| 字段 | `meta.schemaVersion`(整数,初始 1) |
| 检查时机 | 每次 DB 打开 |
| 不匹配行为 | `deleteDatabase('balthasar-offline')` 后重建(**不**迁移,YAGNI) |
| schema 演进流程 | 递增 schemaVersion;旧客户端自动丢弃重建(下次联网重新填充) |

满足: spec FR-014。

## C6. 隐私一致性(spec FR-016)

| 项 | 契约 |
|---|---|
| 隐私锁定时 | 缓存中的交易数据同样不可见(不绕过既有 privacy-lock) |
| 实现 | offline-banner / 流水页 / Dashboard 渲染前过 privacy-lock 检查,与既有模式一致 |

满足: spec FR-016。
