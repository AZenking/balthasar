# Quickstart: 可靠 PWA 验证指南

**Feature**: 029-pwa-reliable-shell | **Date**: 2026-07-16

本指南用于实现完成后的本地、生产构建和真实设备验收。行为契约见 [contracts/pwa-client-contracts.md](./contracts/pwa-client-contracts.md)，客户端状态见 [data-model.md](./data-model.md)。

## 1. Prerequisites

- Node.js 22+
- pnpm（项目锁定版本）
- 可用 PostgreSQL 或现有 Docker 开发栈
- Chrome 与 Edge DevTools
- 当前/前一主要版本的 Android Chrome、桌面 Chrome/Edge、iOS Safari 验收设备
- iOS 真机调试需要 macOS Safari Web Inspector

说明：Service Worker 仅在 production 注册；`pnpm dev` 只用于 UI/逻辑开发，不能作为离线或更新验收结果。

## 2. Install and Static Checks

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm type-check
pnpm test:unit
pnpm test:procedure
pnpm test:integration
pnpm build
```

预期：

- 所有命令退出码为 0。
- build 前 worker 生成步骤创建 `public/sw.js`。
- build 保持 Turbopack，不要求 `--webpack`。
- 无数据库 migration 或 tRPC contract diff。

检查 worker 和静态资源：

```bash
test -f public/sw.js
test -f public/offline.html
test -f public/pwa/icon-192.png
test -f public/pwa/icon-512.png
test -f public/pwa/icon-maskable-512.png
```

## 3. Production-Mode Local Run

```bash
pnpm build
pnpm start
```

localhost 可作为 Service Worker secure-context 开发例外。打开 `http://localhost:3000`，至少完成一次在线加载，再在 DevTools Application 面板检查：

- Manifest 无 error，`id`、start URL、scope、display、192/512/maskable icons 正确。
- `/sw.js` scope 为 `/`，当前页面已被 worker 控制。
- Cache Storage 只出现 `balthasar-pwa-*` cache。
- cache 中没有 `/api/`、`/dashboard`、`/transactions`、tRPC、auth 或响应错误。

响应头检查：

```bash
curl -I http://localhost:3000/sw.js
curl -I http://localhost:3000/manifest.webmanifest
curl -I http://localhost:3000/offline.html
```

`sw.js` 预期包含 JavaScript MIME、`no-cache, no-store, must-revalidate`、root worker scope 和 script CSP。

## 4. Offline Shell Validation

1. 在线加载应用，等待 worker active + controller ready。
2. DevTools Network 切到 Offline，或在设备系统层断网。
3. 关闭所有应用窗口后，从已安装图标重新启动。
4. 验证 3 秒内出现品牌离线页，而不是浏览器默认错误页。
5. 验证页面没有姓名、邮箱、金额、账户、交易、分类或报表内容。
6. 点击“重试”，确认它只重新导航，不重复任何写请求。
7. 恢复网络，验证 5 秒内连接状态更新并可重新加载在线数据。

离线写保护矩阵：分别在新增 TransactionForm、编辑 TransactionForm 和预算删除按钮上断网操作；三者都必须在 mutation 调用前拒绝，保留表单输入，不显示成功、不产生离线队列。随后保持 `navigator.onLine=true`，分别模拟超时、5xx、4xx：超时/5xx 显示“服务暂不可用”，4xx 显示对应业务/权限错误且不得误报设备离线。

首次访问负例：清除整个 origin 数据，在未成功在线打开的前提下直接断网访问；允许出现浏览器失败，不得把它误判为 feature regression。

## 5. Cache Safety Audit

在登录后依次访问 Dashboard、流水、报表、设置并执行查询，然后检查 Cache Storage：

```text
MUST contain only:
- /offline.html
- /manifest.webmanifest
- /pwa/* static icons
- explicitly allowed /_next/static/* assets

MUST NOT contain:
- /api/*
- /api/trpc/*
- /api/auth/*
- authenticated navigation HTML
- RSC/Flight responses
- non-200/error responses
```

退出登录后再次检查，旧 buildId cache 已精确清理，不得删除同 origin 非 `balthasar-pwa-` cache。

## 6. Draft Recovery Validation

桌面 `/transaction/new` 与移动端底部 Drawer 都执行以下矩阵：

1. 修改 type、amount、account、category/toAccount、remark、date。
2. 观察轻量 “已保存” 状态。
3. 刷新或关闭重开，并进入新增账单页。
4. 验证先出现恢复/丢弃对话框，选择恢复前不显示金额或备注。
5. 恢复后核对全部字段。
6. 重复流程并选择丢弃，确认草稿永久删除。
7. 提交成功后确认草稿删除。
8. 模拟 storage `getItem/setItem` 抛错，确认在线表单仍可提交且提示无法保证恢复。
9. 构造过期、损坏、未知 schemaVersion、userScope 不匹配记录，确认自动清理且不恢复。

提交不明场景：在请求发出后、响应到达前断网。预期显示“状态待确认”、保留草稿、没有自动重试；恢复网络后先让用户核对交易列表。

## 7. Update Validation

需要同一 origin 上两个 byte-different production build：V1 和 V2。

1. 打开 V1 并保持至少一个窗口运行。
2. 部署 V2，触发 `registration.update()` 或重新导航。
3. 验证 V2 worker 安装后处于 waiting，V1 不被强制刷新。
4. 在无草稿时选择“立即更新”，确认只 reload 一次并由 V2 controller 接管。
5. 在填写账单时重复，确认先 flush 草稿且输入可恢复。
6. 选择“稍后”，确认当前 session 不再打断，设置中仍有更新入口。
7. 多标签同时打开，确认不会出现 reload loop 或一部分标签恢复旧私有数据。
8. 部署 install 失败的 worker，确认 V1 active worker 仍可使用。
9. V2 激活后断网重启，确认新离线页和静态资源版本一致。

验收时不要开启 DevTools “Update on reload”，它会改变真实 lifecycle。

## 8. Install Validation

### Android Chrome / Desktop Chrome & Edge

- 使用真实浏览器 UI 安装，不能只验证 `beforeinstallprompt` event。
- 从 Home Screen/Start Menu/Desktop 图标冷启动。
- 验证应用名、图标、standalone display、Dashboard/login 跳转。
- standalone 中不再显示安装入口。
- 拒绝一次后，主动提示 30 天不再出现；设置入口仍可用。

### iOS Safari

- 设置页显示 Share → Add to Home Screen 指引，不声称能自动弹安装框。
- 使用系统 Share Sheet 完成安装并从 Home Screen 启动。
- 验证 Apple touch icon、名称、安全区、standalone、冷离线启动。
- 使用 Safari Web Inspector 检查 worker、storage 与前台 Home Screen app。

## 9. Offline Logout / Privacy Lock

1. 登录并创建一份包含金额和备注的草稿。
2. 断网，在设置页确认退出。
3. 验证立即出现全屏隐私锁，Query cache 与草稿清空。
4. 其他已打开标签页也立即锁定。
5. 关闭并离线重启，确认只能看到“已锁定，联网后完成退出”，无账号内容。
6. 恢复联网，验证先调用现有退出流程并确认 session 为空，然后才进入普通登录页。
7. 模拟退出失败，确认持续锁定并提供重试，不得回到 Dashboard。
8. 验证 marker cookie 不包含 user ID、token 或账务字段。

账号 scope 矩阵：使用账号 A 创建草稿并加载查询缓存，然后切换到账号 B；在 B 的任何私有内容显示前，A 的草稿和 Query cache 必须清除。重复 A→session 失效/null，确认进入公开登录流程且 A 草稿不可恢复；401 不得被显示为“服务暂不可用”。

## 10. Repeatable Success-Criteria Protocols

所有计时使用同一个 production build 和单调时钟；验收表必须记录样本编号、OS/浏览器完整版本、设备、网络控制方式、起止时间、实际时长、结果和缺陷链接。目标矩阵是 Android Chrome、桌面 Chrome、桌面 Edge、iOS Safari 的 N/N-1，共 8 个组合。

### SC-001 — 2 分钟内安装并启动

1. 每个组合建立清洁 profile/未安装状态，共 8 次。
2. 预先登录并打开设置页；安装入口完整呈现时启动计时。
3. 只按页面提供的 CTA/说明安装，从系统入口启动。
4. standalone Dashboard 或登录页可交互时停止计时。
5. 8/8 均须 ≤120 秒；任一超时即 SC-001 失败。

### SC-002 — 断网冷启动

1. 确认应用至少在线加载一次且已由 active worker 控制，然后关闭全部窗口。
2. 共执行 20 次：Android Chrome N/N-1、iOS Safari N/N-1 各 3 次；桌面 Chrome N/N-1、Edge N/N-1 各 2 次。
3. 断网后从系统入口点击时开始计时，品牌离线主内容可见时停止。
4. 至少 19/20 必须 ≤3 秒；20/20 必须不含姓名、邮箱、余额、账户、交易、分类或报表内容。

### SC-004 — 连接状态可见更新

1. 共执行 20 次状态切换，覆盖 10 次断网与 10 次恢复，并分布到 8 个组合。
2. 系统/DevTools 网络实际切换时开始计时，可见状态文案稳定呈现时停止。
3. 至少 19/20 必须 ≤5 秒；20/20 都不得遮挡或禁用当前只读页面。

### SC-007 — 状态文案理解度

1. 招募 10 名未参与实现、首次看到 PWA 状态 UI 的测试者。
2. 按同一脚本依次展示离线、草稿已保存/保存失败和下一步操作，不作口头解释。
3. 每人回答：“当前是否离线？”“账单是否已保存？”“下一步做什么？”
4. 三题全部正确才算该参与者通过；至少 9/10 通过。

### SC-009 — 能力缺失时在线核心回归

1. 每个浏览器/版本组合执行 1 次，共 8 次；使用平台自然缺失能力或测试设置禁用 Service Worker、install prompt、BroadcastChannel、storage 中至少一项，记录实际缺失项。
2. 每次依次完成登录、创建账单、查询流水、打开设置四步。
3. 32/32 步骤必须成功，不得要求安装、通知权限或离线队列；任一步失败即 SC-009 失败。

## 11. Release Matrix

“当前及前一主要版本”在每次发布时动态确定，并在验收记录中写出准确版本/build。

| Platform | Required evidence |
|----------|-------------------|
| Android Chrome N/N-1 | 安装、Home Screen 冷启动、离线壳、更新、草稿、退出锁 |
| Desktop Chrome N/N-1 | 安装、standalone、离线壳、V1→V2、多标签 |
| Desktop Edge N/N-1 | 安装、standalone、manifest、更新、退出锁 |
| iOS Safari N/N-1 | Share Sheet 安装、Home Screen、冷离线、storage 清理、更新、退出锁 |
| Docker production | `/sw.js`/manifest/icons/offline 响应、headers、HTTPS reverse proxy |

Lighthouse 只用于 performance/accessibility/best-practices 回归，不使用已弃用 PWA badge 作为 gate。

## 12. Docker Smoke

开发镜像：

```bash
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.yml --env-file docker/.env up --build
```

容器健康后重复 §3 的 curl 和 §4 离线验证。确认 runner 的 `public/` 中包含 build 生成后的 `sw.js`、offline.html、manifest 和静态图标。
