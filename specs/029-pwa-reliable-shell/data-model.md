# Data Model: 可靠 PWA 客户端状态

**Feature**: 029-pwa-reliable-shell | **Date**: 2026-07-16

## 1. Persistence Boundary

本 feature **不修改 PostgreSQL schema**，不新增 migration、表、列、索引或 tRPC contract。以下实体全部是浏览器端可丢失状态，不是领域真相源。

| 存储 | 允许内容 | 禁止内容 |
|------|----------|----------|
| Cache API | 自包含离线页、manifest、静态 PWA 图标、明确公共且带 hash 的构建资源 | 导航 HTML、RSC/Flight、`/api/**`、认证/账务响应、错误响应 |
| localStorage | 单份新增账单草稿、安装提示偏好、本地隐私锁 | cookie、session、token、CSRF secret、服务端财务响应 |
| 普通 marker cookie | `pending_logout=1` 及短 TTL | 用户 ID、账务字段、认证凭据 |
| 内存 | online/install/update/runtime 状态、waiting worker 引用 | 需要跨重启恢复的唯一状态 |

所有持久客户端记录必须：

1. 使用 `balthasar.pwa.` 前缀；
2. 带 `schemaVersion`；
3. 读取时按不可信输入校验；
4. 损坏/未知版本时删除并安全降级；
5. 不因 storage 异常阻断现有在线流程。

## 2. TransactionDraftEnvelopeV1

**Key**: `balthasar.pwa.transaction-draft.v1`

同一浏览器 origin 同时只保存一份最近新增账单草稿。账号切换时旧记录删除，不保留多账号草稿集合。

### Fields

| Field | Type | Rules |
|-------|------|-------|
| `schemaVersion` | literal `1` | 其他版本不读取 |
| `draftId` | UUID string | 首次出现有效用户输入时生成；同一草稿保持稳定 |
| `userScope` | string | 当前认证 user ID；仅用于本地隔离，不是凭据 |
| `form.type` | `income \| expense \| transfer` | 必填 |
| `form.accountId` | string | 可为空，恢复后仍由现有表单校验 |
| `form.toAccountId` | string | transfer 可用，其他类型必须为空 |
| `form.categoryId` | string | income/expense 可用，transfer 必须为空 |
| `form.amount` | decimal string | 保留用户输入；提交时仍走现有金额校验 |
| `form.remark` | string | 最长 200 字符 |
| `form.occurredAt` | `YYYY-MM-DD` string | 恢复后仍走现有日期校验 |
| `status` | `editing \| uncertain` | `uncertain` 表示提交响应丢失，禁止自动重试 |
| `createdAt` | ISO timestamp | 草稿首次创建时间 |
| `updatedAt` | ISO timestamp | 每次成功自动保存更新时间 |
| `expiresAt` | ISO timestamp | `updatedAt + 24h` |
| `attemptedAt` | ISO timestamp or null | status=uncertain 时必填 |

### Validation Rules

- 只有 create mode 保存；edit mode 不读取也不覆盖该 key。
- 必须先确认当前 `auth.me.user.id === userScope` 才能提供恢复。
- userScope 不匹配、过期、JSON/schema 损坏或未知 schemaVersion 时立即删除。
- 恢复前只显示“存在草稿/保存时间”，不得展示金额、备注或其他字段。
- 用户选择恢复后，通过现有 React Hook Form reset 恢复全部字段；选择丢弃立即删除。
- transfer 与 income/expense 的互斥字段必须归一化，避免隐藏字段污染后续提交。
- localStorage 写失败时保留当前内存表单并标记 `saveFailed`，不覆盖上一次有效草稿。

### State Transitions

```text
absent
  └─ first valid field change ──> editing

editing
  ├─ 300ms after field changes ─> editing (updatedAt/expiresAt refresh)
  ├─ submit definite success ───> absent
  ├─ submit response unknown ───> uncertain
  ├─ discard/logout/scope change/expiry ─> absent
  └─ storage failure ───────────> editing in memory + saveFailed

uncertain
  ├─ user verifies transaction exists ─> absent
  ├─ user verifies not created and edits ─> editing
  └─ logout/scope change/expiry ────────> absent
```

自动重试不是合法 transition。

## 3. InstallPreferenceV1

**Key**: `balthasar.pwa.install-preference.v1`

### Fields

| Field | Type | Rules |
|-------|------|-------|
| `schemaVersion` | literal `1` | 必填 |
| `dismissedAt` | ISO timestamp or null | 用户关闭/拒绝时记录 |
| `suppressUntil` | ISO timestamp or null | dismissedAt + 30 days |
| `coreActionPromptedAt` | ISO timestamp or null | 第一次成功记账后的非阻塞提示只出现一次 |
| `installedAt` | ISO timestamp or null | 收到安装完成事件时记录；实际 standalone 状态仍以运行环境为准 |

### Derived Install State

| State | Condition |
|-------|-----------|
| `unsupported` | 无安装事件且不是 iOS 手动安装场景 |
| `available` | 捕获 Chromium install event，未安装且不在 suppress window |
| `manual-ios` | iOS Safari 且非 standalone |
| `suppressed` | 当前时间早于 suppressUntil |
| `installed` | standalone display mode 或 iOS standalone 为真 |

设置页主动安装入口不受 suppressUntil 限制；只有主动提示受限。

## 4. PrivacyLockV1

**localStorage key**: `balthasar.pwa.privacy-lock.v1`

**marker cookie**: `balthasar.pwa.pending_logout=1`

### Fields

| Field | Type | Rules |
|-------|------|-------|
| `schemaVersion` | literal `1` | 必填 |
| `locked` | literal `true` | 记录存在即视为 locked |
| `pendingLogout` | literal `true` | 明确服务端 session 尚待撤销 |
| `lockedAt` | ISO timestamp | 用于诊断和绝对 TTL |
| `reason` | literal `user-logout` | 第一版唯一原因 |

marker cookie 不含上述 JSON，只包含布尔存在标记；建议 Path=/、SameSite=Lax、短 Max-Age，HTTPS 下 Secure。它不是认证或授权依据，只用于服务器避免在正式退出前渲染私有 children。

### State Transitions

```text
unlocked
  └─ user confirms logout ──> locked-pending

locked-pending
  ├─ immediate: hide account UI, clear query cache/draft, broadcast lock
  ├─ offline/restart ───────> locked-pending
  ├─ online + logout success + session absent ─> unlocked → /login
  └─ logout failure/unknown ────────────────────> locked-pending (retry allowed)
```

不得在服务端确认退出之前从 locked-pending 回到私有应用。

## 5. PwaRuntimeState

仅内存存在，由 provider 管理。

| Field | Type | Meaning |
|-------|------|---------|
| `connectivity` | `online \| offline` | 基于浏览器事件；不等价于服务健康 |
| `serviceReachability` | `unknown \| reachable \| unavailable` | 仅由真实请求结果更新 |
| `registration` | ServiceWorkerRegistration or null | 当前注册引用 |
| `waitingWorker` | ServiceWorker or null | 等待用户确认的新 worker |
| `updatePhase` | `idle \| available \| activating \| failed` | 更新提示状态 |
| `installState` | derived install state | 见 InstallPreferenceV1 |
| `privacyLocked` | boolean | 从 PrivacyLockV1 初始化并监听跨标签事件 |
| `draftSaveState` | `idle \| saving \| saved \| failed` | TransactionForm 展示轻量状态 |

online/offline 只控制用户提示和明确离线时的写操作拦截；服务端 5xx/超时使用 `serviceReachability=unavailable`，文案不得声称设备断网。

`serviceReachability` 只消费现有 React Query 结果：成功响应 → `reachable`；网络错误、超时、5xx → `unavailable`；4xx 保持服务可达语义，其中 401 另行触发账号 scope 失效清理。不得为该字段增加探活网络请求。

账号 scope 不新增独立持久记录。服务器确认 scope 从 A→B 或 A→null 时，provider 在显示新账号/公开内容前清除 userScope=A 的草稿、Query cache 和其他私有临时状态；新账号不得看到或恢复 A 的草稿。

## 6. Service Worker Cache Model

| Cache | Contents | Strategy | Eviction |
|-------|----------|----------|----------|
| `balthasar-pwa-shell-{buildId}` | offline.html、manifest、PWA icons | precache/cache-first | 新 worker activate 删除旧 buildId |
| `balthasar-pwa-static-{buildId}` | `/_next/static/**` 响应 | cache-first，成功 200 only | 新 worker activate 删除旧 buildId |

不建立 API、document、RSC 或用户数据 cache。

## 7. Cross-Tab Coordination

**Channel**: `balthasar:pwa`

允许事件：

- `PRIVACY_LOCKED`
- `LOGOUT_COMPLETED`
- `DRAFT_CLEARED`
- `UPDATE_AVAILABLE`

BroadcastChannel 不作为持久真相源；收到事件后仍从版本化本地记录重新读取。环境不支持 BroadcastChannel 时使用 storage event 作为降级。
