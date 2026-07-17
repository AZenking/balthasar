# Research: 可靠 PWA 外壳

**Feature**: 029-pwa-reliable-shell | **Date**: 2026-07-16

## R1. Next.js 16 的 PWA 集成方式

**Decision**: 使用项目自有、构建时生成的稳定 `/sw.js`，由小型 client provider 注册；不引入 `@serwist/next`，不把 Next.js 16 默认 Turbopack build 切换为 webpack。

**Rationale**:

- Next.js 官方 PWA 指南直接支持在 `public/sw.js` 提供自定义 worker，并要求为 worker 配置正确的 MIME、`no-cache/no-store` 与 CSP。
- Next.js 16 默认构建器是 Turbopack；官方 PWA 指南指出 Serwist Next 插件当前需要 webpack。为一个受限离线壳改变整个生产构建器，会扩大回归面。
- 本 feature 只需离线 fallback、严格静态白名单和用户控制更新，不需要完整 Workbox/Serwist 路由生态。

**Alternatives considered**:

- `@serwist/next`: 能生成 revision manifest，但要求 webpack 集成；若未来要求完整 Next chunk 预缓存，可在单独 spike 验证 Next 16 CI/Docker 后重新评估。
- `next-pwa`/其他社区插件: 同样增加构建耦合和默认缓存策略审计成本。
- 手写所有 Next chunk precache 清单: 拒绝；构建产物易漂移，官方工具文档也不建议手写 revision manifest。

**Sources**:

- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Next.js Turbopack](https://nextjs.org/docs/app/api-reference/turbopack)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Serwist Next integration](https://serwist.pages.dev/docs/next)
- [Serwist precaching guidance](https://serwist.pages.dev/docs/serwist/guide/precaching)

## R2. Worker 版本与构建产物

**Decision**: 保持 URL `/sw.js` 稳定，在 build 前由无第三方依赖的脚本根据相关源文件生成确定性 build hash，并写入 worker 的缓存版本；生产注册使用根 scope 与 `updateViaCache: "none"`。

**Rationale**:

- 浏览器通过同 URL worker 脚本字节变化发现更新；稳定 URL 配合禁止 HTTP 长缓存最可靠。
- build hash 变化确保每次相关源代码变化都会产生 byte-different worker 和新缓存名，避免人工忘记递增版本。
- standalone Docker 已复制 `public/`，生成后的 `/sw.js` 会自然进入镜像，无需新 server runtime。

**Alternatives considered**:

- 时间戳版本: 每次无内容变化的重建也会提示更新，不可复现。
- 手动常量版本: 容易漏改，导致客户端长期不发现更新。
- 更换 worker URL: 会形成多个 registration/scope 管理问题。

**Sources**:

- [Service Worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- [Workbox service worker lifecycle](https://developer.chrome.com/docs/workbox/service-worker-lifecycle)

## R3. 缓存边界与离线导航

**Decision**:

- install 阶段只预缓存自包含 `/offline.html`、manifest 和静态 PWA 图标。
- document navigation 始终先访问网络；网络失败时返回 `/offline.html`，不保存成功的认证页面 HTML。
- 只对 `/_next/static/**` 等带内容哈希且明确公共的静态资源使用 cache-first；只对显式公共字体/图标使用有上限的缓存。
- `/api/**`、Better-Auth、tRPC、RSC/Flight、POST/PUT/PATCH/DELETE、错误响应和所有用户财务响应一律 network-only。
- activate 仅删除 `balthasar-pwa-` 前缀的旧缓存。

**Rationale**:

- HTTP cache 和 Service Worker Cache API 相互独立；`Cache-Control: no-store` 不能阻止错误 worker 主动保存响应，因此必须在 worker 内使用正向白名单。
- App Router 导航/RSC 结果可能包含会话相关内容。专用自包含 offline HTML 能保证首次 worker 安装后离线启动，又不依赖尚未缓存的 Next CSS/JS。
- 现代浏览器允许安装并不证明离线正确，离线 launch 必须独立验收。

**Alternatives considered**:

- 缓存所有 GET 或 API 使用 stale-while-revalidate: 拒绝，存在跨账号陈旧数据暴露。
- 缓存 Dashboard HTML: 拒绝，违反 spec FR-008/FR-019。
- 仅依赖 HTTP `no-store`: 拒绝，无法约束 Cache API。

**Sources**:

- [web.dev: Cache API and HTTP cache](https://web.dev/learn/performance/prefetching-prerendering-precaching)
- [MDN Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
- [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [Workbox caching strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview/)
- [PWA offline assets](https://web.dev/learn/pwa/assets-and-data)

## R4. 更新生命周期

**Decision**: 新 worker 安装后保持 waiting；页面检测到 waiting worker 时显示更新提示。用户选择立即更新后先确认草稿已经写入，再发送 `SKIP_WAITING`；worker 激活、清理旧缓存并 claim clients，页面只在本次用户确认后响应 `controllerchange` 刷新一次。

**Rationale**: 无条件 `skipWaiting()` 可能让旧页面代码与新 worker/cache schema 混用。记账表单需要由用户选择安全时机更新。

**Alternatives considered**:

- install 时自动 skip waiting: 拒绝，存在输入丢失和混合版本风险。
- 永远等待所有标签关闭: 安全但长期打开的 PWA 可能收不到修复。
- 每次导航强制刷新: 打断 10 秒记账热路径。

**Sources**:

- [web.dev Service Worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- [web.dev PWA update](https://web.dev/learn/pwa/update)
- [W3C Service Workers](https://www.w3.org/TR/service-workers/)

## R5. 新增账单草稿存储

**Decision**: 用 localStorage 保存一份小于 2KB 的版本化 JSON envelope，300ms 去抖写入；包含完整 create-mode 输入、`userScope`、schema version、保存/过期时间和提交状态。每次读取重新做 Zod 校验、账号匹配与 24 小时 TTL 校验。

**Rationale**:

- 规格只允许一份小型草稿；现有项目已有 localStorage 安全失败降级模式和 Node fake 测试方式。单记录不需要 IndexedDB 的数据库/迁移复杂度，符合 YAGNI。
- localStorage 与 IndexedDB 都不能防御同源 XSS，不能被视为保险箱。真正控制来自最小化、短 TTL、账号隔离、退出清理、恢复前确认和严格 CSP。
- 300ms 去抖避免每次键击同步写入，同时不增加网络请求。

**Alternatives considered**:

- IndexedDB: 异步、结构化、易版本化，但对单份小记录增加 adapter/migration 和测试复杂度；未来出现多草稿/附件时再采用。
- sessionStorage: 关闭标签/应用后丢失，不满足跨关闭恢复。
- 客户端透明加密: 密钥同样可被同源脚本访问，容易制造虚假安全感。

**Security constraints**:

- 不保存 cookie、session、JWT、refresh token、CSRF secret 或服务端财务响应。
- 草稿是用户输入快照，不是已入账 Transaction；成功响应前不得清除。
- storage 失败、quota、损坏或被系统清理时必须降级到正常在线表单并提示无法保证恢复。

**Sources**:

- [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Browser Storage Testing](https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/11-Client-side_Testing/12-Testing_Browser_Storage)

## R6. 网络中断时的创建交易语义

**Decision**: 本 feature 不新增 operation ID 或服务端幂等表。创建请求没有确定响应时，保留草稿并标记 `uncertain`，禁止自动重试，提示用户联网后先刷新交易列表核对；只有明确成功才清除草稿。

**Rationale**:

- HTTP 标准指出非幂等请求在响应丢失时不能安全自动重试，因为服务器可能已经完成写入。
- 真正自动重试需要客户端 request ID、服务端去重约束和同事务持久化，会新增 schema/业务契约，违反本 spec 明确的第一版范围。

**Alternatives considered**:

- 普通 POST 自动重试: 拒绝，可能重复记账。
- 金额/日期/分类模糊去重: 拒绝，会错误合并合法相同交易。
- `operationId` + 服务端幂等: 正确的长期方案，但作为独立 feature 规划；只有未来启用离线写队列或自动重试时才需要。

**Sources**:

- [RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)
- [RFC 9113 §8.7](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.7)
- [Google AIP-155 Request Identification](https://google.aip.dev/155)

## R7. 离线退出与 HttpOnly session

**Decision**:

1. 用户确认退出后，无论在线/离线，立即设置本地隐私锁和非敏感 `pending_logout` marker cookie，清空 Query cache/草稿并广播其他标签页锁定。
2. App Router 的 authenticated layout 在服务器看到 marker 后，禁止渲染私有 children并转入公开退出完成流。
3. PWA provider 在前台恢复联网后复用现有 Better-Auth sign-out，只有服务端确认 session 已清除后才解除 lock/marker 并进入登录页；失败保持锁定并允许重试。

**Rationale**: JavaScript 无法读取或删除 HttpOnly session cookie，离线客户端只能立即保护当前设备 UI，不能声称已经撤销服务端 session。正式退出必须在线由服务器完成。

**Alternatives considered**:

- 离线禁止退出: 不满足共享设备隐私。
- 尝试客户端删除 HttpOnly cookie: 不可行。
- 只用 localStorage lock: 冷启动在线 SSR 仍可能在 hydration 前返回私有内容；marker cookie 提供服务器 gate。
- `Clear-Site-Data: "*"`: 可能删除整个 origin 的存储并注销 worker；本 feature 使用精确清理。

**Sources**:

- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [MDN Cookies / HttpOnly](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)
- [MDN Clear-Site-Data](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Clear-Site-Data)

## R8. 安装体验与平台差异

**Decision**:

- Chromium 捕获 `beforeinstallprompt` 并只在用户主动选择时调用；成功后通过 `appinstalled`/standalone display mode 隐藏入口。
- iOS Safari 不依赖 `beforeinstallprompt`，设置页展示 Share → Add to Home Screen 指引。
- install CTA 在第一次成功记账后可非阻塞提示一次；拒绝/关闭记录 30 天，设置入口始终保留。
- manifest 增加稳定 `id`，使用静态 192/512/maskable 图标并保留 Apple touch icon。

**Rationale**: 安装 UI 由浏览器/OS 所有；iOS 不提供网页触发安装对话框。现代 Chromium 允许广泛安装，因此安装成功不能代替 manifest/offline 验收。

**Alternatives considered**:

- 首屏自动弹原生安装: 干扰核心记账流程且平台不一致。
- 仅依赖浏览器菜单: 可发现性不足，不满足设置入口需求。

**Sources**:

- [Web app manifest guidance](https://web.dev/articles/add-manifest)
- [Installation prompt guidance](https://web.dev/learn/pwa/installation-prompt)
- [WebKit install prompt position](https://bugs.webkit.org/show_bug.cgi?id=255716)
- [WebKit manifest/icon behavior](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/)

## R9. 测试与发布验收

**Decision**:

- 每个 PR：Vitest 覆盖 draft serialization/TTL/账号隔离、300ms debounce、storage failure、安装偏好、online reducer、隐私锁和 worker message reducer；执行 lint、type-check、全量 tests、production build。
- 每次 PWA 发布：在 Android Chrome、桌面 Chrome/Edge、iOS Safari 的当前与前一主要版本做真实安装、standalone 冷启动、离线 fallback、V1→V2 waiting/update、多标签、storage 清理和离线退出验收。
- DevTools/Lighthouse 只作诊断；不把已弃用的 Lighthouse PWA badge 当作完成条件。
- 不新增 Playwright：它能自动化 Chromium 离线页面流，但无法证明 OS 安装、真实 Safari/iOS Home Screen 或 N-1 浏览器；同时新增测试框架会违反当前宪章冻结栈。

**Rationale**: Service Worker、安装和存储回收包含浏览器/OS 生命周期，Node 单测和模拟器均不能替代真实设备。发布证据必须记录具体浏览器/OS build。

**Alternatives considered**:

- 仅 Vitest: 不足以证明真实 worker/install。
- Playwright WebKit 代替 Safari: 拒绝，Playwright 的 WebKit 不是 branded Safari，且 worker introspection 主要限于 Chromium。
- Lighthouse PWA audit 作为 gate: 已弃用，且安装不等于离线正确。

**Sources**:

- [Playwright browsers](https://playwright.dev/docs/browsers)
- [Playwright service workers](https://playwright.dev/docs/service-workers)
- [Vitest environments](https://v3.vitest.dev/guide/environment)
- [Chrome Application panel](https://developer.chrome.com/docs/devtools/application)
- [Apple Safari iOS inspection](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios)
- [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [Deprecated Lighthouse PWA install audit](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest)

## Resolution Summary

所有 Technical Context unknowns 已解决。设计保持现有技术栈，无宪章 violation。
