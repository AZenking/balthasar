# PWA 发布验收记录

记录 production build、设备、完整浏览器版本、网络控制方式、样本编号、起止时间、结果与缺陷链接。每项先记录 buildId 与测试日期；网络控制使用 DevTools Offline（桌面）或飞行模式/受控 Wi-Fi（移动）。计时从任务规定的可观察起点开始，到目标界面可用或状态提示出现结束。

## SC-001 安装与启动（8/8，≤120 秒）

| Platform/version | Device | Start | End | Seconds | Pass | Evidence |
|---|---|---|---|---:|---|---|
| Android Chrome current | Android reference phone | | | | | |
| Android Chrome previous | Android reference phone | | | | | |
| Desktop Chrome current | macOS/Windows reference | | | | | |
| Desktop Chrome previous | macOS/Windows reference | | | | | |
| Desktop Edge current | Windows reference | | | | | |
| Desktop Edge previous | Windows reference | | | | | |
| iOS Safari current | iPhone reference | | | | | |
| iOS Safari previous | iPhone reference | | | | | |

**汇总公式**：`PASS = 8/8 且每行 Seconds ≤ 120`。

## SC-002 冷离线启动（≥19/20 ≤3 秒；20/20 无私有内容）

| Sample | Platform/version | Device | Start | End | Seconds | No private data | Pass | Evidence |
|---:|---|---|---|---|---:|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | | | | | | | |
| 6 | | | | | | | | |
| 7 | | | | | | | | |
| 8 | | | | | | | | |
| 9 | | | | | | | | |
| 10 | | | | | | | | |
| 11 | | | | | | | | |
| 12 | | | | | | | | |
| 13 | | | | | | | | |
| 14 | | | | | | | | |
| 15 | | | | | | | | |
| 16 | | | | | | | | |
| 17 | | | | | | | | |
| 18 | | | | | | | | |
| 19 | | | | | | | | |
| 20 | | | | | | | | |

**汇总公式**：`PassCount = count(Pass = yes ∧ Seconds ≤ 3 ∧ No private data = yes)`；通过条件 `PassCount ≥ 19 且 NoPrivateCount = 20`。

## SC-004 连接状态（≥19/20 ≤5 秒）

| Sample | Platform/version | Transition | Start | End | Seconds | Non-blocking | Pass | Evidence |
|---:|---|---|---|---|---:|---|---|---|
| 1 | | offline→online | | | | | | |
| 2 | | offline→online | | | | | | |
| 3 | | offline→online | | | | | | |
| 4 | | offline→online | | | | | | |
| 5 | | online→offline | | | | | | |
| 6 | | online→offline | | | | | | |
| 7 | | online→offline | | | | | | |
| 8 | | online→offline | | | | | | |
| 9 | | online→offline | | | | | | |
| 10 | | online→offline | | | | | | |
| 11 | | online→offline | | | | | | |
| 12 | | online→offline | | | | | | |
| 13 | | online→offline | | | | | | |
| 14 | | online→offline | | | | | | |
| 15 | | online→offline | | | | | | |
| 16 | | online→offline | | | | | | |
| 17 | | online→offline | | | | | | |
| 18 | | online→offline | | | | | | |
| 19 | | online→offline | | | | | | |
| 20 | | online→offline | | | | | | |

**汇总公式**：`PassCount = count(Pass = yes ∧ Seconds ≤ 5 ∧ Non-blocking = yes)`；通过条件 `PassCount ≥ 19`。

## SC-007 文案理解（≥9/10）

| Participant | Offline correct | Save state correct | Next step correct | Pass | Notes |
|---:|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |

**汇总公式**：`PassCount = count(Pass = yes)`；通过条件 `PassCount ≥ 9`。

## SC-009 能力降级（32/32）

| Platform/version | Missing capability | Login | Create | List | Settings | Pass | Evidence |
|---|---|---|---|---|---|---|---|
| Android Chrome current | Service Worker | | | | | | |
| Android Chrome previous | install prompt | | | | | | |
| Desktop Chrome current | BroadcastChannel | | | | | | |
| Desktop Chrome previous | localStorage | | | | | | |
| Desktop Edge current | Service Worker | | | | | | |
| Desktop Edge previous | install prompt | | | | | | |
| iOS Safari current | BroadcastChannel | | | | | | |
| iOS Safari previous | localStorage | | | | | | |

**汇总公式**：`Pass = 32/32 core steps completed`。
