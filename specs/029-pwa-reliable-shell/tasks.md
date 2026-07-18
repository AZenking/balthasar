# Tasks: 可靠 PWA 外壳

**Input**: Design documents from `/specs/029-pwa-reliable-shell/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/pwa-client-contracts.md`, `quickstart.md`

**Tests**: 本功能遵循宪章的测试优先原则。每个用户故事先编写 Vitest 红测并确认失败，再实现转绿；关键 React 交互使用现有 Testing Library，并以最小 `jsdom` 运行时接入 Vitest。真实 OS 安装、离线启动、Service Worker 生命周期和 iOS Home Screen 行为按发布矩阵补充手工验收。

**Organization**: 任务按用户故事分组。每个故事在共享基础完成后都可单独实现、验证和交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可与同阶段其他标记任务并行，修改不同文件且不依赖未完成任务
- **[Story]**: 对应 `spec.md` 中的用户故事
- 所有任务均包含精确文件路径

---

## Phase 1: Setup（共享准备）

**Purpose**: 固定实现纪律与发布证据格式，不改技术栈、不新增 PWA 库或测试框架；仅允许补齐既有 Vitest/Testing Library 所需的 `jsdom` DOM 运行时。

- [X] T001 在开始任何 JSX/UI 修改前调用 `/heroui-react`，复核 Alert、AlertDialog、Button、Card 的 HeroUI v3 compound API、`onPress`、variant 与 token，并将差异修订到 `specs/029-pwa-reliable-shell/contracts/pwa-client-contracts.md`
- [X] T002 [P] 从验证指南建立逐项可勾选的环境、完整浏览器版本、设备、网络控制方式、计时起止点、样本编号、实际时长、通过结果与缺陷链接证据表，并为 SC-001/002/004/007/009 预建固定样本行和汇总公式 `specs/029-pwa-reliable-shell/checklists/release-validation.md`

---

## Phase 2: Foundational（阻塞所有用户故事）

**Purpose**: 建立所有故事共享的版本化客户端契约和全局 PWA runtime 边界。

**⚠️ CRITICAL**: 完成本阶段之前不得开始用户故事实现。

- [X] T003 [P] 为未知 schemaVersion、损坏 payload、连接状态去抖和服务不可达区分编写红测 `src/tests/unit/pwa/contracts.test.ts`
- [X] T004 实现 PWA 存储 key、Zod envelope schema、跨标签事件类型及纯 runtime 状态迁移 `src/lib/pwa/contracts.ts`
- [X] T005 配置 Vitest `jsdom` UI 测试项目与 `.test.tsx` 匹配，加入最小 `jsdom` devDependency，并为无 Service Worker、Storage、BroadcastChannel 或 install prompt 能力时仍能渲染普通在线 Web 编写 Testing Library provider 红测 `package.json`、`pnpm-lock.yaml`、`vitest.config.ts`、`src/tests/unit/pwa/pwa-provider.test.tsx`
- [X] T006 实现可渐进增强的 PWA context/provider，并接入现有 Query/tRPC provider 树 `src/components/pwa/pwa-provider.tsx`、`src/app/providers.tsx`

**Checkpoint**: 共享契约和 provider 可用；缺失浏览器能力不会破坏现有在线流程。

---

## Phase 3: User Story 1 - 安装并像应用一样启动（Priority: P1）🎯 MVP

**Goal**: 提供正确品牌、图标、standalone 启动和平台匹配的安装入口；已安装状态下隐藏入口。

**Independent Test**: 在 Android Chrome、桌面 Chrome/Edge、iOS Safari 完成安装，关闭浏览器后从系统图标启动，验证名称、图标、standalone、Dashboard/login 跳转及 iOS 手动指引。

### Tests for User Story 1 ⚠️

> **先执行以下测试并确认失败，再开始实现。**

- [X] T007 [P] [US1] 编写 manifest 必填字段、稳定 id/start_url/scope/display、192/512/maskable 静态图标和文件存在性红测 `src/tests/unit/pwa/manifest.test.ts`
- [X] T008 [P] [US1] 编写 Chromium deferred prompt、iOS 手动安装、standalone 检测及能力缺失降级状态红测，并用 Testing Library 覆盖用户点击安装、iOS 指引与 standalone 隐藏入口 `src/tests/unit/pwa/install-state.test.ts`、`src/tests/unit/pwa/install-section.test.tsx`

### Implementation for User Story 1

- [X] T009 [US1] 在 T007/T008 红测已运行且确认失败后，从现有品牌图形生成静态 192、512 与 maskable 图标，并保证透明度/安全区适合系统入口 `public/pwa/icon-192.png`、`public/pwa/icon-512.png`、`public/pwa/icon-maskable-512.png`
- [X] T010 [US1] 更新安装清单为稳定 id、根 scope/start_url、standalone display、主题色和静态图标声明 `public/manifest.webmanifest`
- [X] T011 [US1] 实现平台/standalone/deferred prompt 能力状态与显式用户触发安装动作 `src/lib/pwa/install-state.ts`
- [X] T012 [US1] 在 provider 捕获安装事件，并用 HeroUI 设置区提供 Chromium 安装按钮与 iOS“分享 → 添加到主屏幕”说明 `src/components/pwa/pwa-provider.tsx`、`src/components/pwa/install-section.tsx`、`src/app/(app)/settings/page.tsx`
- [X] T013 [US1] 更新根 metadata/apple touch icon 静态引用并删除动态图标路由 `src/app/layout.tsx`、`src/app/apple-icon.tsx`、`src/app/pwa-icons/[size]/route.ts`
- [ ] T014 [US1] 按 SC-001 协议在 8 个浏览器/版本组合各执行 1 次清洁 profile 安装计时，记录从设置页安装入口呈现到 standalone Dashboard/login 可用的实际秒数并要求每次 ≤120 秒 `specs/029-pwa-reliable-shell/checklists/release-validation.md`

**Checkpoint**: US1 可独立演示；用户能安装并从系统入口安全启动，iOS 有准确手动说明。

---

## Phase 4: User Story 2 - 断网时获得明确且安全的体验（Priority: P1）

**Goal**: 提供严格公共缓存白名单、品牌离线页、连接反馈和离线退出隐私锁，绝不缓存或展示私有财务响应。

**Independent Test**: 在线加载一次后断网冷启动，3 秒内只出现品牌离线页；运行中 5 秒内提示连接变化；离线退出立即隐藏内容并在正式在线退出成功前保持锁定。

### Tests for User Story 2 ⚠️

> **先执行以下测试并确认失败，再开始实现。**

- [X] T015 [P] [US2] 编写 worker 生成确定性 buildId、静态白名单、navigation fallback、非 GET/API/auth/tRPC/RSC network-only、非 200 不缓存和旧前缀缓存清理红测 `src/tests/unit/pwa/service-worker-generation.test.ts`
- [X] T016 [P] [US2] 编写仅生产注册、根 scope、updateViaCache none、首次 controller ready 与注册失败降级红测 `src/tests/unit/pwa/service-worker-client.test.ts`
- [X] T017 [P] [US2] 编写 online/offline 稳定迁移、真实 query/mutation 成功/网络错误/超时/5xx/4xx 到 serviceReachability 的分类、离线新增/编辑/删除 guard 红测，并用 Testing Library 覆盖 Alert 文案、aria-live、服务不可达不误报离线及删除 mutation 未被调用 `src/tests/unit/pwa/connectivity.test.ts`、`src/tests/unit/pwa/service-reachability.test.ts`、`src/tests/unit/pwa/write-guard.test.ts`、`src/tests/unit/pwa/connectivity-alert.test.tsx`
- [X] T018 [P] [US2] 编写隐私锁持久化、marker cookie、账号 scope 从 A→B/A→null 时精确清除旧草稿与私有临时状态、跨标签广播、退出失败保持锁定和成功后解锁红测，并用 Testing Library 覆盖设置页确认退出后立即隐藏账号内容、清理本地状态、失败重试及成功前不解锁 `src/tests/unit/pwa/privacy-lock.test.ts`、`src/tests/unit/pwa/account-scope.test.ts`、`src/tests/unit/pwa/privacy-lock-screen.test.tsx`、`src/tests/unit/pwa/settings-logout.test.tsx`

### Implementation for User Story 2

- [X] T019 [P] [US2] 创建不依赖 Next chunk/网络字体且不含账号内容的中文可访问离线文档与纯导航重试 `public/offline.html`
- [X] T020 [US2] 实现基于输入内容哈希生成稳定 `/sw.js` 的脚本，包含 shell/static 版本缓存、严格 fetch 路由、离线 fallback 和限定前缀清理 `scripts/generate-service-worker.mjs`
- [X] T021 [US2] 将 worker 生成接入 production build 且保持 Next 16 默认 Turbopack、不添加依赖 `package.json`、`public/sw.js`
- [X] T022 [US2] 为 `/sw.js` 配置 JavaScript MIME、no-store、根 scope 与 script CSP 响应头 `next.config.js`
- [X] T023 [US2] 实现生产 worker 注册、controller ready、online/offline 监听，并将现有 QueryClient 的真实 query/mutation 成功、网络错误、超时和 5xx 分类后推送给 PWA runtime；4xx 保持服务可达且不新增探活请求 `src/lib/pwa/service-worker-client.ts`、`src/lib/pwa/service-reachability.ts`、`src/app/providers.tsx`、`src/components/pwa/pwa-provider.tsx`
- [X] T024 [P] [US2] 用 HeroUI Alert 实现不遮挡主要操作的离线、恢复与服务不可达状态 `src/components/pwa/connectivity-alert.tsx`
- [X] T025 [US2] 实现共享离线写 guard 并接入 AppShell、TransactionForm 新增/编辑和现有预算删除入口；明确离线时必须在调用 mutation 前拒绝、保留输入、显示未保存且不会排队，删除不得出现乐观成功提示 `src/lib/pwa/write-guard.ts`、`src/components/layout/app-shell.tsx`、`src/components/transaction/transaction-form.tsx`、`src/components/dashboard/budget-progress.tsx`
- [X] T026 [US2] 实现 PrivacyLockV1、pending logout marker cookie、BroadcastChannel/storage-event 降级，以及服务器确认 session scope A→B/A→null 时对旧账号草稿、Query cache 和私有临时状态的精确清理 `src/lib/pwa/privacy-lock.ts`、`src/lib/pwa/account-scope.ts`
- [X] T027 [P] [US2] 用 HeroUI 构建全屏隐私锁、退出失败与重试状态，不渲染任何账号内容 `src/components/pwa/privacy-lock-screen.tsx`
- [X] T028 [US2] 统一设置页退出入口：确认后先锁定、清 Query cache/草稿，再在线调用 Better Auth signOut 并以 getSession 空结果作为完成条件 `src/app/(app)/settings/page.tsx`、`src/components/pwa/pwa-provider.tsx`
- [X] T029 [US2] 在私有 layout 渲染 children 前拦截 pending logout marker，把服务器确认的 `session.user.id` 传给客户端 scope guard，并允许公开 auth layout 完成退出而不被旧 session 送回 Dashboard；确认 session 缺失/变化时必须先清旧 scope 再显示新账号内容 `src/app/(app)/layout.tsx`、`src/app/(auth)/layout.tsx`、`src/components/layout/app-shell.tsx`、`src/components/pwa/pwa-provider.tsx`
- [ ] T030 [US2] 执行离线新增/编辑/预算删除、真实服务超时/5xx/4xx、账号 A→B/A→null、20 次冷离线启动（SC-002）、20 次断网/恢复（SC-004）、缓存安全、多标签退出和 Docker public 复制验收并记录逐样本证据 `specs/029-pwa-reliable-shell/checklists/release-validation.md`

**Checkpoint**: US2 可独立验证；离线只显示公共安全壳，退出锁不会在服务端会话撤销前解除。

---

## Phase 5: User Story 3 - 网络中断后恢复新增账单草稿（Priority: P1）

**Goal**: 自动保护一份账号隔离、24 小时有效的完整新增账单草稿，恢复前先询问，并安全处理提交结果不明。

**Independent Test**: 在桌面新增页和移动 Drawer 填写所有字段后刷新、关闭、断网和切换账号，验证恢复/丢弃、过期清理、保存失败降级、成功提交清理及不明响应不自动重试。

### Tests for User Story 3 ⚠️

> **先执行以下测试并确认失败，再开始实现。**

- [X] T031 [P] [US3] 编写完整字段 round-trip、300ms debounce/flush、24h TTL、账号不匹配、损坏/未知版本、storage 异常和精确清理红测 `src/tests/unit/pwa/draft-storage.test.ts`
- [X] T032 [P] [US3] 编写 create-only 字段归一化、恢复前不暴露内容、成功清理、uncertain 保留且禁止自动重试的控制器红测，并用 Testing Library 覆盖恢复/丢弃选择、关闭不自动填充及保存失败提示 `src/tests/unit/pwa/transaction-draft-controller.test.ts`、`src/tests/unit/pwa/draft-recovery-dialog.test.tsx`

### Implementation for User Story 3

- [X] T033 [US3] 实现单记录 localStorage adapter、Zod 校验、UUID、账号范围、24h TTL、300ms 去抖、立即 flush、uncertain 和安全错误结果 `src/lib/pwa/draft-storage.ts`
- [X] T034 [US3] 实现 create-mode 表单快照归一化与保存/恢复/提交状态协调器 `src/lib/pwa/transaction-draft-controller.ts`
- [X] T035 [P] [US3] 使用 HeroUI AlertDialog 实现仅显示保存时间的恢复/丢弃询问，未选择恢复前不得填充账务字段 `src/components/pwa/draft-recovery-dialog.tsx`
- [X] T036 [US3] 将当前用户 scope、全部 create 字段、300ms 自动保存、页面隐藏 flush、轻量保存状态和恢复/丢弃接入共享表单 `src/components/transaction/transaction-form.tsx`
- [X] T037 [US3] 在明确成功后清草稿；请求发出后响应不明时标记 uncertain、禁止自动重试并引导先核对交易列表 `src/components/transaction/transaction-form.tsx`
- [X] T038 [US3] 验证桌面 `/transaction/new` 与移动 `TransactionDrawer` 共用草稿流程且 edit mode 不读取/覆盖草稿 `src/app/(app)/transaction/new/page.tsx`、`src/components/transaction/transaction-drawer.tsx`
- [ ] T039 [US3] 执行刷新、关闭重开、断网、过期、storage failure、账号切换、成功与结果不明矩阵并记录证据 `specs/029-pwa-reliable-shell/checklists/release-validation.md`

**Checkpoint**: US3 可独立验证；草稿不跨账号、不被误认为已入账，也不会触发非幂等自动重试。

---

## Phase 6: User Story 4 - 在安全时机更新应用（Priority: P2）

**Goal**: waiting worker 只在用户确认且草稿已 flush 后激活；稍后更新不打断会话，失败不产生 reload loop。

**Independent Test**: 用同源 V1/V2 构建分别在无草稿和有草稿时验证 waiting、稍后、立即更新、单次 reload、失败保留旧版本和多标签行为。

### Tests for User Story 4 ⚠️

> **先执行以下测试并确认失败，再开始实现。**

- [X] T040 [US4] 扩展 worker client 红测以覆盖 waiting 检测、buildId 校验、用户确认后 SKIP_WAITING、首次安装不 reload、controllerchange 单次 reload、延期与失败重试，并用 Testing Library 覆盖“立即更新/稍后/重试”及立即更新前 flush 草稿 `src/tests/unit/pwa/service-worker-client.test.ts`、`src/tests/unit/pwa/update-alert.test.tsx`

### Implementation for User Story 4

- [X] T041 [US4] 扩展生成 worker 的 WORKER_READY/CACHE_ERROR 与受 buildId 约束的 SKIP_WAITING 消息协议，保持 install 阶段不无条件激活 `scripts/generate-service-worker.mjs`
- [X] T042 [US4] 实现 registration waiting/updatefound 检测、用户接受标志、激活超时/失败、单次 controllerchange reload 和稍后更新状态 `src/lib/pwa/service-worker-client.ts`
- [X] T043 [P] [US4] 用 HeroUI Alert 实现“立即更新/稍后/重试”，并在立即更新前 flush 当前草稿 `src/components/pwa/update-alert.tsx`
- [X] T044 [US4] 将 update 状态与跨标签 UPDATE_AVAILABLE 协调接入全局 provider，确保各标签重新校验自己的 waiting worker `src/components/pwa/pwa-provider.tsx`
- [ ] T045 [US4] 用 byte-different V1/V2 production build 执行有/无草稿、延期、失败、多标签和离线重启验收并记录证据 `specs/029-pwa-reliable-shell/checklists/release-validation.md`

**Checkpoint**: US4 可独立验证；更新完全由用户控制，任何路径都不丢草稿或自动刷新循环。

---

## Phase 7: User Story 5 - 控制安装提示干扰（Priority: P3）

**Goal**: 首次核心操作后只给一次非阻塞安装入口，拒绝后 30 天抑制主动提示，设置入口始终可用，standalone 不重复提示。

**Independent Test**: 分别验证首次符合条件、拒绝/关闭、30 天内、设置主动入口、已安装、iOS 和不支持安装能力的显示行为。

### Tests for User Story 5 ⚠️

> **先执行以下测试并确认失败，再开始实现。**

- [X] T046 [US5] 扩展安装状态红测以覆盖版本化偏好、首次核心操作、30 天 suppress、设置入口豁免、appinstalled 与 standalone 隐藏，并扩展 Testing Library 交互红测验证关闭后不再主动提示但设置入口仍可用 `src/tests/unit/pwa/install-state.test.ts`、`src/tests/unit/pwa/install-section.test.tsx`

### Implementation for User Story 5

- [X] T047 [US5] 实现 InstallPreferenceV1 不可信读取、dismissed/suppressUntil/coreActionPromptedAt/installedAt 持久化和设置入口派生状态 `src/lib/pwa/install-state.ts`
- [X] T048 [US5] 在安装区区分一次性非阻塞 CTA、设置主动入口、拒绝/关闭和 standalone 状态，且不请求通知权限 `src/components/pwa/install-section.tsx`
- [X] T049 [US5] 在首次成功创建交易后只触发 provider 的核心操作安装资格，不阻断记账成功反馈 `src/components/transaction/transaction-form.tsx`、`src/components/pwa/pwa-provider.tsx`
- [ ] T050 [US5] 执行首次提示、拒绝 30 天、设置入口、已安装、iOS 与 unsupported 行为验收并记录证据 `specs/029-pwa-reliable-shell/checklists/release-validation.md`

**Checkpoint**: US5 可独立验证；安装增强不降低核心记账流程完成率。

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 完成跨故事安全、回归、构建和发布验收。

- [X] T051 [P] 审计生成 worker 与所有浏览器存储，确认无 session/token/CSRF、导航 HTML、RSC、API、认证、财务响应或错误响应进入 `public/sw.js`、`src/lib/pwa/draft-storage.ts`、`src/lib/pwa/privacy-lock.ts`
- [X] T052 [P] 核对最终实现未引入 Serwist/Workbox/Playwright、未切换 webpack、未新增 DB migration/tRPC/API 契约或离线写队列 `package.json`、`next.config.js`、`src/server/api/`、`src/server/db/migrations/`
- [ ] T053 运行 `pnpm lint`、`pnpm type-check`、`pnpm test:unit`、`pnpm test:procedure`、`pnpm test:integration` 和 `pnpm build`，并执行缺失 Service Worker/install prompt/BroadcastChannel/storage 的自动化 capability-fallback 测试，将命令与结果记录到 `specs/029-pwa-reliable-shell/checklists/release-validation.md`
- [ ] T054 执行 production `pnpm start` 响应头/cache smoke 与 Docker 构建，确认 runner 包含 sw/offline/manifest/icons `Dockerfile`、`specs/029-pwa-reliable-shell/checklists/release-validation.md`
- [ ] T055 完成 8 个浏览器/版本组合的发布矩阵；汇总 SC-001/002/004 阈值，按固定脚本完成 10 人且至少 9 人全答对的 SC-007 可用性测试，并在每个组合禁用/缺失至少一项 PWA 能力后完成登录、创建账单、查询流水和设置共 32/32 步骤的 SC-009 回归 `specs/029-pwa-reliable-shell/checklists/release-validation.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始。
- **Foundational (Phase 2)**: 依赖 Setup；完成前阻塞全部用户故事。
- **US1 / US2 / US3 (P1)**: 均依赖 Foundational。逻辑上可并行，但 `pwa-provider.tsx`、设置页与交易表单存在文件级整合点，合并时按 US1 → US2 → US3 顺序处理冲突最稳妥。
- **US4 (P2)**: 依赖 US2 的 worker 注册/生成器，以及 US3 的 draft flush 契约。
- **US5 (P3)**: 依赖 US1 的安装能力状态和入口；首次成功记账钩子与 US3 共用 TransactionForm。
- **Polish (Phase 8)**: 依赖本次准备发布的全部故事。

### User Story Dependency Graph

```text
Setup → Foundation ─┬─→ US1 ─────────────→ US5 ─┐
                    ├─→ US2 ─┐                 │
                    └─→ US3 ─┴─→ US4 ─────────┤
                                               └─→ Polish / Release
```

### Within Each User Story

- 先写测试并运行，确认测试因缺少目标行为而失败。
- 再实现纯状态/存储/worker 协议，随后接 UI 与现有流程。
- 完成自动化测试后执行该故事的独立真实平台验收。
- 任何提交结果不明、更新失败或正式退出失败都必须保持安全状态，不以自动重试掩盖失败。

---

## Parallel Opportunities

- T002 可与 T001 并行；T003 与 T005 可并行编写红测。
- US1 的 T007/T008 可并行编写并运行红测；两者都确认失败后才可执行 T009，T009 不得与红测并行。
- US2 的 T015-T018 可并行编写红测；T019、T024、T027 修改不同文件，可在契约稳定后并行。
- US3 的 T031/T032 可并行编写并运行红测；确认失败且 storage/controller API 固定后，T035 才可与表单接入准备并行。
- US4 的 T043 只能在 T040 红测确认失败且 T042 API 固定后实现；US5 的 state 与 UI 只能在 T046 红测确认失败后分文件推进。
- T051 与 T052 是不同维度的只读审计，可并行。

### Parallel Example: User Story 2

```text
Task T015: worker 生成与缓存安全红测
Task T016: 浏览器注册与降级红测
Task T017: 连接状态红测
Task T018: 隐私锁红测

测试失败并固定契约后：
Task T019: 自包含离线页
Task T024: 连接状态 Alert
Task T027: 隐私锁屏
```

### Parallel Example: User Story 3

```text
Task T031: 草稿存储/TTL/账号隔离红测
Task T032: 表单归一化/uncertain 状态红测

核心 API 固定后：
Task T035: 草稿恢复 AlertDialog
Task T036: 桌面与移动共用 TransactionForm 接入
```

---

## Implementation Strategy

### MVP First（US1）

1. 完成 Phase 1 Setup。
2. 完成 Phase 2 Foundational。
3. 完成 Phase 3 US1。
4. 停止并在三个目标平台验证安装、standalone 启动与登录跳转。
5. 若目标是“可靠 PWA”而不只是“可安装”，发布前继续完成 US2；US1 是最小可演示切片，US1+US2 是最小安全发布切片。

### Incremental Delivery

1. Setup + Foundation → 稳定客户端契约。
2. US1 → 可安装与独立启动。
3. US2 → 安全离线外壳与隐私退出（建议首个生产发布门槛）。
4. US3 → 记账草稿保护。
5. US4 → 用户控制更新。
6. US5 → 安装提示节制。
7. Polish → 全矩阵发布证据。

### Scope Guardrails

- 不实现离线账本、私有财务缓存、后台同步、推送或离线写队列。
- 不为不明创建结果增加自动重试；长期幂等方案应另立 feature。
- 不新增数据库、tRPC/API 或认证体系变更。
- 不新增 PWA 库或测试框架；除 T005 所需的最小 `jsdom` DOM 运行时外不扩展测试依赖，也不把 Turbopack 切换为 webpack。

---

## Notes

- `[P]` 仅表示文件和依赖允许并行，不代表可以跳过前置红测。
- `[US#]` 与 `spec.md` 用户故事一一对应。
- UI 任务执行前必须完成 T001 的 `/heroui-react` 复核。
- `public/sw.js` 是构建生成物；权威逻辑位于 `scripts/generate-service-worker.mjs`。
- 每个故事完成后均可在对应 Checkpoint 停止并独立验收。
- 建议按任务或紧密逻辑组提交，避免把五个故事压入单一不可审查提交。
