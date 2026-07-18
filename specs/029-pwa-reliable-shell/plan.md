# Implementation Plan: 可靠 PWA 外壳

**Branch**: `codex/029-pwa-reliable-shell` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-pwa-reliable-shell/spec.md`

## Summary

在现有 Next.js 16 App Router 应用上补齐可靠 PWA 外壳，不改变 tRPC、Better-Auth、Drizzle、PostgreSQL 或 Docker 架构。实现由五条互相约束的链路组成：

1. 以稳定 `/sw.js` 注册自定义、版本化 Service Worker；只缓存自包含离线页、静态图标、manifest 与可明确识别的公共静态资源，所有导航 HTML、`/api/**`、认证和账务响应保持 network-only。
2. 在全局 PWA runtime 中统一管理在线状态、由真实 React Query query/mutation 结果驱动的服务可达性、安装状态、waiting worker 和本地隐私锁；更新采用用户确认后 `SKIP_WAITING`，不在表单输入期间强制刷新。
3. 新增账单表单对完整输入做 300ms 去抖自动草稿保存；草稿按用户隔离、24 小时过期、恢复前确认，提交成功/丢弃/退出/账号切换立即删除。
4. 离线退出先写入持久隐私锁、清空内存查询与草稿、通知其他标签页；恢复联网后复用现有 Better-Auth 退出端点，成功前不解除锁定或渲染账号内容。服务器确认的 `session.user.id` 或 Better Auth 会话缺失同时作为账号 scope 真相，账号变化/认证失效时立即清除前一账号草稿及私有临时状态。
5. 使用 Vitest 覆盖纯状态机、存储适配器和失败降级；安装、真实离线启动、worker 更新及 iOS Home Screen 行为通过当前/前一主要版本的真实浏览器发布验收。

不引入离线账本、后台同步、推送、私有响应缓存、自动重试或新的服务端业务契约。

## Technical Context

**Language/Version**: TypeScript 5.7+、JavaScript Service Worker、React 19、Node.js 22（Docker 运行时）

**Primary Dependencies**:

- 保留：Next.js 16 App Router、React 19、`@tanstack/react-query`、tRPC v11、Better-Auth、Zod、React Hook Form、HeroUI v3、Sonner。
- 浏览器原生能力：Service Worker、Cache API、Web App Manifest、`beforeinstallprompt`（仅支持平台）、`matchMedia('(display-mode: standalone)')`、BroadcastChannel、Web Storage、online/offline events。
- **不新增 PWA 库**：自定义 worker 避免 `@serwist/next` 的 webpack 构建依赖，保持 Next.js 16 默认 Turbopack 和现有 standalone Docker 输出。

**Storage**:

- PostgreSQL 16：无 schema、migration 或数据访问变更。
- Cache API：仅 `balthasar-pwa-*` 前缀的公共离线壳/静态资源缓存。
- localStorage：一份版本化新增账单草稿、安装提示偏好和本地隐私锁；所有读取均校验 schema、用户范围与 TTL。
- 非 HttpOnly 标记 cookie：只保存 `pending_logout=1` 这一非敏感 SSR 防护标志；不保存凭据或财务数据。

**Testing**: Vitest 3（Node 环境 + 内存 fake 覆盖存储/状态机/计时器；`jsdom` + 现有 `@testing-library/react` 覆盖安装、连接提示、隐私锁、草稿恢复和更新提示等关键 React 交互）、现有全量 procedure/integration 回归、生产构建验证、Chrome/Edge DevTools 与真实 Android/iOS/桌面手工验收。`jsdom` 仅补齐既有 Vitest/Testing Library 的 DOM 运行时，不引入新测试框架；因宪章冻结测试栈，本 feature 不新增 Playwright。

**Target Platform**: Android Chrome、桌面 Chrome/Edge、iOS Safari 的发布时当前及前一个主要版本；生产为 HTTPS 下的 Docker standalone Node 服务，localhost 仅供开发验证。

**Project Type**: 单仓全栈 Web 应用（Next.js App Router）

**Performance Goals**:

- 已成功在线加载过的设备断网启动后 3 秒内显示自包含离线页。
- online/offline 事件后 5 秒内更新可见状态。
- 草稿写入采用 300ms 去抖，小于 2KB 的单记录写入不得阻塞表单交互。
- 保持宪章“手机 10 秒完成一笔账”；草稿和安装逻辑不得新增网络往返。

**Constraints**:

- 不缓存认证后 HTML、RSC/Flight、`/api/**`、tRPC、Better-Auth、账务查询或错误响应。
- 不为服务健康状态增加探活请求；`serviceReachability` 只由现有 React Query query/mutation 的真实成功、超时、网络错误和 5xx 结果更新，4xx 业务/权限错误不得误报为服务不可达。
- 所有当前存在的账务写入口共用离线写 guard；新增/编辑 TransactionForm 与预算删除在调用 mutation 前拒绝，保留本地输入并明确说明未保存且不会排队。
- 不自动重试创建交易；响应不明时保留草稿并引导用户核对交易列表。
- 不无条件 `skipWaiting()`；只在用户确认且草稿已持久化后激活新 worker。
- localStorage 被视为不可信、非保密临时存储；严禁会话凭据、token 或服务端财务响应进入其中。
- Service Worker 仅生产注册；`/sw.js` 必须 `no-cache, no-store, must-revalidate` 且根 scope。
- UI 实现必须使用 HeroUI v3 原生组合 API；计划阶段已核对 Alert、AlertDialog、Button、Card 文档，实现前仍需再次调用 `/heroui-react`。
- iOS 无可编程安装提示，必须提供 Share → Add to Home Screen 指引并真机验收。

**Scale/Scope**:

- 新增：1 个 worker 源/生成脚本、1 个自包含离线页、3 个静态 manifest 图标、约 6 个 PWA 组件、约 8 个 PWA 工具模块、1 份 UI/状态契约。
- 修改：root providers/layout、app/auth layouts、AppShell、设置页退出/安装区、TransactionForm、manifest、Next headers、Docker 构建验证和 Vitest 单测。
- 删除：现有动态 `/pwa-icons/[size]` 路由（静态图标替代后）。
- 无新表、migration、tRPC procedure、REST endpoint 或领域实体。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| 原则 | Phase 0 Gate | Post-Design | 说明 |
|------|--------------|-------------|------|
| 一、MVP 范围 | ✅ Pass | ✅ Pass | PWA 提升现有登录与 10 秒记账可靠性；AI/OCR/导入导出/投资/多币种、推送和离线账本均明确排除。 |
| 二、Feature-Sliced Architecture | ✅ Pass | ✅ Pass | PWA 横切能力集中在 `components/pwa` 与 `lib/pwa`；既有交易表单和认证流程只接入公开 helper/context，不新增消息队列或服务端分层。 |
| 三、领域驱动设计 | ✅ Pass | ✅ Pass | PostgreSQL 与 Family 聚合不变；草稿是可丢失的客户端输入快照，不是 Transaction 或业务真相源。 |
| 四、测试优先 | ✅ Pass | ✅ Pass | tasks 必须先为状态机、草稿校验/TTL、存储失败、隐私锁、更新 reducer 写失败测试，并用 Vitest + Testing Library 为安装、连接提示、隐私锁、草稿恢复和更新提示关键交互写红测，再实现；真实 worker/OS 安装生命周期由发布验收补充覆盖。 |
| 五、性能与极速录入 | ✅ Pass | ✅ Pass | 草稿本地去抖保存、不增加网络请求；不改变创建交易或 Dashboard 服务端热路径。 |
| 六、简单 (YAGNI) | ✅ Pass | ✅ Pass | 自定义小型 worker，零新 PWA 依赖；拒绝完整 Next chunk 预缓存、IndexedDB、多草稿库、离线同步与幂等 API 扩展。 |
| 七、UI 调整纪律 | ✅ Pass | ✅ Pass | 已调用 `/heroui-react` 并核对 v3 Alert/AlertDialog/Button/Card；计划限定原生 compound API、`onPress` 与语义 variant。 |
| 技术栈冻结 | ✅ Pass | ✅ Pass | 保留 Next.js/Turbopack、tRPC、Better-Auth、Drizzle、PostgreSQL、HeroUI、Docker、Vitest；不新增 Playwright 或切换 webpack。 |

**Gate 结论**: 所有原则通过，无需 Complexity Tracking。数据库迁移、tRPC 契约和 DOMAIN/DATABASE 文档更新均为 N/A，因为本 feature 不改变持久化或领域语义；测试与本 feature 文档必须更新。

## Project Structure

### Documentation (this feature)

```text
specs/029-pwa-reliable-shell/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── pwa-client-contracts.md
└── tasks.md                    # 由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
scripts/
└── generate-service-worker.mjs       # 构建输入哈希 → public/sw.js

public/
├── manifest.webmanifest              # 增加 id，改用静态图标
├── offline.html                      # 自包含、无账号数据的离线页
├── sw.js                             # 构建生成，稳定 URL
└── pwa/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png

src/
├── app/
│   ├── layout.tsx                    # PwaRuntime + 预 hydration 隐私锁
│   ├── providers.tsx                 # PwaProvider 接入现有 Query/tRPC provider
│   ├── (app)/layout.tsx              # pending_logout cookie gate
│   ├── (auth)/layout.tsx             # pending logout 时允许进入公开退出完成流
│   ├── (app)/settings/page.tsx       # 安装入口 + 统一退出动作
│   └── pwa-icons/[size]/route.ts     # 删除；静态图标取代
├── components/
│   ├── layout/app-shell.tsx          # 全局 ConnectivityAlert
│   ├── pwa/
│   │   ├── pwa-provider.tsx          # 注册、安装、更新、online、隐私锁状态
│   │   ├── connectivity-alert.tsx    # HeroUI Alert
│   │   ├── update-alert.tsx          # HeroUI Alert + 用户确认更新
│   │   ├── install-section.tsx       # 设置页安装/平台指引
│   │   ├── privacy-lock-screen.tsx   # 退出待完成全屏安全态
│   │   └── draft-recovery-dialog.tsx # HeroUI AlertDialog
│   └── transaction/transaction-form.tsx # create 模式草稿接入
├── lib/
│   └── pwa/
│       ├── contracts.ts              # 版本化客户端类型与 Zod 校验
│       ├── draft-storage.ts           # 单草稿 TTL/用户隔离/失败降级
│       ├── install-state.ts           # install/dismiss/standalone 判定
│       ├── account-scope.ts           # session scope 变化/失效清理
│       ├── privacy-lock.ts            # 本地锁、marker cookie、跨标签通知
│       ├── service-reachability.ts    # React Query 结果 → 服务可达性
│       ├── write-guard.ts             # 离线新增/编辑/删除前置拒绝
│       └── service-worker-client.ts   # 注册、waiting、SKIP_WAITING 协议
└── tests/unit/pwa/
    ├── draft-storage.test.ts
    ├── install-state.test.ts
    ├── account-scope.test.ts
    ├── privacy-lock.test.ts
    ├── service-reachability.test.ts
    ├── write-guard.test.ts
    └── service-worker-client.test.ts

next.config.js                         # /sw.js 安全与缓存响应头
package.json                           # build 前生成 worker；不加依赖
Dockerfile                             # 确认生成后的 public/sw.js 进入 standalone 镜像
```

**Structure Decision**: 采用现有单项目 feature-sliced 结构。浏览器状态与 UI 分别落在 `lib/pwa`、`components/pwa`；交易草稿通过 `TransactionForm` 接入，从而同时覆盖移动 Drawer 与桌面 `/transaction/new`。公共离线页与图标放在 `public/`，避免离线 fallback 依赖尚未缓存的 Next chunk。

## Implementation Phases

### Phase 0 — Research ✅

- 自定义 worker vs Serwist/webpack 决策。
- 严格静态白名单、navigation fallback 与私有响应 network-only 策略。
- waiting worker + 用户确认更新生命周期。
- 单草稿本地存储、账号隔离、TTL 与不可信输入校验。
- HttpOnly session 下离线退出的本地锁/联网撤销边界。
- Android/桌面/iOS 当前与前一版本测试矩阵及自动化边界。

详见 [research.md](./research.md)。

### Phase 1 — Design ✅

- 客户端实体与状态迁移见 [data-model.md](./data-model.md)。
- 缓存、worker 消息、草稿、安装、隐私锁和 UI 行为契约见 [contracts/pwa-client-contracts.md](./contracts/pwa-client-contracts.md)。
- 端到端验证流程见 [quickstart.md](./quickstart.md)。

### Phase 2 — Tasks（由 `/speckit-tasks` 生成）

建议依赖顺序：

1. 纯函数契约/状态机红测 → 草稿、安装偏好、隐私锁、worker client。
2. 静态图标、manifest、自包含离线页与 worker 生成器。
3. Service Worker 注册、缓存白名单和更新提示。
4. AppShell 连接状态与设置页安装入口。
5. TransactionForm 草稿自动保存/恢复/提交不明状态。
6. 统一在线/离线退出与 SSR pending logout gate。
7. 全量测试、生产 build、Docker smoke、真实设备矩阵验收。

## Agent Context Update

项目当前 Spec Kit 0.12.5 bundle 未安装 `.specify/scripts/bash/update-agent-context.sh`，且仓库没有由该脚本维护的根级 agent context 文件，因此没有可安全执行的更新脚本。未手工改写 `docs/AGENTS.md`，避免将单个 feature 的临时技术细节写入全局宪章性说明；本 plan、research 与 contracts 作为后续 agent 的权威上下文。

## Complexity Tracking

无宪章 violation，无需填写。
