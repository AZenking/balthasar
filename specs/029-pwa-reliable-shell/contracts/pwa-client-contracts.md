# Client Contracts: 可靠 PWA 外壳

**Feature**: 029-pwa-reliable-shell | **Date**: 2026-07-16

本 feature 不新增公共 HTTP/tRPC contract。本文件定义浏览器内部边界，供 tasks 与测试共享。

## 1. Service Worker Registration Contract

### Endpoint

`GET /sw.js`

必需响应：

| Header | Value/Rule |
|--------|------------|
| `Content-Type` | `application/javascript; charset=utf-8` |
| `Cache-Control` | `no-cache, no-store, must-revalidate` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'` |
| `Service-Worker-Allowed` | `/` |

注册规则：

- 仅生产环境注册；开发环境不得留下持久 worker。
- URL 固定 `/sw.js`，scope `/`，updateViaCache `none`。
- 注册失败只记录安全诊断并降级为普通在线 Web，不阻断渲染。
- 页面获得 controller 后才声明 offline shell ready。

## 2. Worker Message Contract

### Client → Worker

```text
{ type: "SKIP_WAITING", buildId: string }
```

前置条件：

- 消息目标必须是当前 registration.waiting。
- buildId 必须与 waiting worker 公布版本一致。
- 当前表单草稿已完成写入或用户确认放弃未保存输入。

Worker 行为：验证 type 后调用 skipWaiting；未知消息忽略，不抛出影响 fetch 的异常。

### Worker → Client

```text
{ type: "WORKER_READY", buildId: string }
{ type: "CACHE_ERROR", buildId: string, resourceKind: "shell" | "static" }
```

`CACHE_ERROR` 不包含 URL query、cookie、响应 body、用户 ID 或财务数据。

### Activation

- activate 仅删除 `balthasar-pwa-` 前缀且 buildId 不等于当前版本的 cache。
- clientsClaim 后，只有已经设置 `userAcceptedUpdate=true` 的页面响应 controllerchange 并 reload 一次。
- 首次安装不得触发无条件 reload。

## 3. Fetch and Cache Contract

规则按优先级匹配，第一条命中即停止：

| Priority | Request | Behavior |
|----------|---------|----------|
| 1 | method 非 GET | network-only；不得 cache |
| 2 | `/api/**`、认证、tRPC、RSC/Flight 或含私有协议 header | network-only；不得 cache |
| 3 | document navigation | network；仅网络失败时返回已 precache 的 `/offline.html` |
| 4 | `/offline.html`、manifest、静态 PWA icons | shell cache-first |
| 5 | `/_next/static/**` 且响应成功 | versioned static cache-first |
| 6 | 其他请求 | network-only |

禁止：

- 对成功 navigation HTML 执行 cache.put。
- 对 opaque、redirected、非 200 或 error response 执行 cache.put。
- 从 cookie/user ID 推导 cache key。
- 使用“所有 GET”通配缓存。

## 4. Offline Document Contract

`/offline.html` 必须：

- 是 public 下的单文件、自包含 HTML；关键样式和文案不依赖 Next chunk 或网络字体。
- 不包含姓名、邮箱、账号 ID、余额、交易、分类、报表、CSRF 或服务端注入内容。
- 默认显示“当前离线，账务操作未保存”。
- 若检测到本地隐私锁，优先显示“应用已锁定，联网后完成退出”。
- 提供重试按钮；重试只重新导航，不自动重放写请求。
- 使用 `lang=zh-CN`、viewport、可聚焦按钮和可读的状态语义。

## 5. Draft Storage Contract

API 语义：

| Operation | Result |
|-----------|--------|
| `readDraft(userScope)` | `valid draft \| absent \| expired \| scope-mismatch \| corrupt` |
| `scheduleDraftSave(userScope, form)` | 300ms 后保存；后续变化重置计时器 |
| `flushDraftSave()` | 更新激活/页面隐藏前立即完成当前 pending write |
| `markDraftUncertain()` | 保留字段，status → uncertain，禁止自动提交 |
| `clearDraft(reason)` | 精确删除 draft key，广播 DRAFT_CLEARED |

保存/读取错误必须返回可判定结果，不向 UI 抛出未处理异常。

恢复 UI：

- 检测到 valid draft 后使用 HeroUI AlertDialog。
- 对话框标题只说明“发现未提交草稿”和保存时间，不显示账务字段。
- Primary action “恢复”，tertiary/danger-confirmed action “丢弃”；关闭对话框等同暂不处理，不得自动填充。
- 选择恢复后一次性填充 type/account/toAccount/category/amount/remark/date。

## 6. Connectivity UI Contract

`ConnectivityAlert` 使用 HeroUI v3 compound API：

- `<Alert status="warning">` + Indicator/Content/Title/Description。
- offline 时位于 AppShell 内容顶部，`role=status`/`aria-live=polite`，不覆盖底部记账按钮。
- online 恢复后显示短暂 success 状态，再移除。
- `navigator.onLine=true` 时，现有 React Query query/mutation 的网络错误、超时或 5xx 将 `serviceReachability` 设为 `unavailable`；真实成功设为 `reachable`；4xx 业务/权限错误不改变为 unavailable，也不得新增探活请求。
- `navigator.onLine=true` 但服务不可达时，使用“服务暂不可用”文案，不能显示“设备离线”。
- 离线状态下共享 write guard 必须在 mutation 前拒绝新增、编辑和当前已暴露的删除操作，保留表单输入，不执行乐观成功、不排队；第一版至少覆盖 TransactionForm create/update 与 BudgetProgress delete。

## 7. Update UI Contract

`UpdateAlert` 使用 HeroUI Alert `status="accent"`：

- 文案：“新版本已准备好”。
- actions：“立即更新”“稍后”。
- 立即更新：flush draft → message waiting worker → phase activating。
- 稍后：当前 session 不再主动打断；设置区保留更新入口，下次 app launch/update check 可再次提示。
- activation 超时/失败：保留当前 controller，显示重试；不得清草稿或 reload loop。

## 8. Install UI Contract

### Chromium

- Provider 捕获 beforeinstallprompt 并阻止浏览器无上下文提示。
- 只有用户点击设置页“安装应用”或一次性非阻塞 CTA 后调用 prompt。
- appinstalled 后清理 deferred event 并隐藏主动提示。

### iOS Safari

- 不调用不存在的 native prompt。
- 设置页使用 Card + Button 展示“分享 → 添加到主屏幕”步骤。

### Shared

- standalone 运行时不显示安装入口。
- 关闭/拒绝主动提示后 suppress 30 天；设置页入口始终可见。
- 不请求通知权限。

## 9. Privacy Lock and Logout Contract

### beginLogout

1. 用户在现有 AlertDialog 确认退出。
2. 写 PrivacyLockV1 和 marker cookie。
3. 清 draft、QueryClient cache 和内存用户状态。
4. 广播 PRIVACY_LOCKED；PwaProvider 立即渲染全屏 PrivacyLockScreen。
5. 若 online，调用现有 authClient.signOut；若 offline，等待前台 online 事件或用户重试。

### Server render gate

- `(app)/layout.tsx` 在查询/渲染私有 children 前读取 marker；存在时 redirect 到公开登录/退出完成流。
- `(auth)/layout.tsx` 在 marker 存在时不得因为旧 HttpOnly session redirect 回 Dashboard。

### completion

- signOut 成功后必须再次 getSession 并确认 data 为空。
- 确认后清 marker cookie/local lock，广播 LOGOUT_COMPLETED，location.replace('/login')。
- 请求失败或结果不明：保持 locked，展示“联网后重试退出”，不得恢复私有内容。

### Account scope synchronization

- `(app)/layout.tsx` 将服务器确认的 `session.user.id` 传入客户端 scope guard；`(auth)/layout.tsx` 传入确认的 `null`。
- scope 从 A→B 或 A→null 时，在显示 B/公开 auth 内容前清除 A 的草稿、QueryClient cache 和其他私有临时状态，并广播 `DRAFT_CLEARED`。
- 不单独持久化 last-user-id；以服务器确认 scope、当前内存 scope 和草稿 envelope 的 `userScope` 比较。
- 401/确认 session 缺失触发 A→null 清理，但作为认证状态处理，不得误报为服务不可达。

## 10. Cross-Tab Contract

- 首选 BroadcastChannel `balthasar:pwa`，storage event 降级。
- 任一标签收到 PRIVACY_LOCKED 后立即清内存查询并显示 lock screen。
- 任一标签收到 DRAFT_CLEARED 后不得继续从内存写回已删除草稿。
- UPDATE_AVAILABLE 可同步提示，但每个标签仍从自身 registration 校验 waiting worker。
- 事件 payload 不携带草稿字段或用户财务数据。
