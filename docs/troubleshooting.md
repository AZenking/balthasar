# 故障排查 (troubleshooting)

<!--
Created: 2026-07-08
Feature: 014-ops-docs
Audience: 遇到问题的用户 (开发者 + 运维者)
Budget: 1500字
-->

按症状 → 原因 → 修复 → 验证 4 栏查。未列出的症状请提 [GitHub Issue](https://github.com/AZenking/balthasar/issues)。

## 目录

- [启动相关](#启动相关)
- [认证相关](#认证相关)
- [数据相关](#数据相关)
- [网络相关](#网络相关)
- [性能相关](#性能相关)

## 启动相关

| 症状 | 原因 | 修复 | 验证 |
|---|---|---|---|
| `port 3000 is in use` 启动失败 | 已有进程占 3000 | `lsof -i :3000` 找到 PID + `kill -9 <PID>`,或 `.env` 改 `APP_PORT=3001` | `make simple-up` 后 `curl localhost:3001/healthz` 返回 200 |
| `ECONNREFUSED 127.0.0.1:5432` | Postgres 未启或健康检查未过 | `make simple-up` 先启 PG;`make simple-logs SVC=postgres` 看 pg_isready | `docker exec balthasar-pg pg_isready -U balthasar` 返回 `accepting connections` |
| app 容器反复重启,日志 `Error: migration failed` | entrypoint 跑迁移失败 (SQL 错误 / 表已存在 / 权限) | `make simple-logs` 找具体 SQL 错误 → 手动 `psql` 修表 / 回滚迁移 / 恢复备份 | `docker compose ps` 显示 app `Up (healthy)` |
| `manifest unknown` / `no matching manifest` | 你的 NAS 是 ARM,但 GHCR 还没 arm64 镜像 | 等下次 CI 推 main 触发多架构构建;或本地 `docker build -t balthasar/app:local .` 自建 | `docker manifest inspect ghcr.io/azenking/balthasar/app:latest` 列出 arm64 |
| `image pull: unauthorized` / 拉取失败 | GHCR 限速 / 国内网络 | `docker login ghcr.io -u <user> -p <PAT>` 或本地构建 | `docker pull ghcr.io/azenking/balthasar/app:latest` 成功 |

## 认证相关

| 症状 | 原因 | 修复 | 验证 |
|---|---|---|---|
| 登录后立即登出,刷新就回登录页 | `BETTER_AUTH_URL` 与浏览器访问 URL 不一致,cookie 域错位 | 改 `.env` 中 `BETTER_AUTH_URL` 为浏览器实际 URL (含协议) → `make simple-down && simple-up` | 登录后刷新页面保持登录 |
| 注册返回 400 `REGISTRATION_CLOSED` | `ALLOW_REGISTRATION != "true"` 且 user 表已有用户 | 临时设 `ALLOW_REGISTRATION=true` 重启 → 注册 → 改回 `false` | 注册成功 + `curl /sign-up` 返回 404 |
| 第二个陌生人注册成功 | 忘记把 `ALLOW_REGISTRATION` 改回 false | 立即 `false` 重启;`docker exec ... psql -c "SELECT ... FROM user"` 删陌生人 | `curl /sign-up` 返回 404 |
| Better-Auth 500 `field userId does not exist in model account` | schema 别名冲突 (老问题,已在 commit 82639ce 修) | 拉最新代码 + 重建镜像 | 启动后无 BetterAuthError |

## 数据相关

| 症状 | 原因 | 修复 | 验证 |
|---|---|---|---|
| Dashboard 月度漏算 (上海时间 8 月 1 日 00:30 交易不在 8 月) | 容器走 UTC (TZ 未设或设错) | `.env` 设 `TZ=Asia/Shanghai` → 重启 | `docker exec balthasar-app date` 显示 CST;交易进对应月份 |
| 备份恢复失败 `gunzip: invalid compressed data` | 备份文件损坏 (中途 Ctrl+C / 磁盘满) | `gunzip -t backups/backup-X.sql.gz` 校验;失败则用更早备份 | 恢复命令退出 0,`psql -c "SELECT COUNT(*) FROM transaction"` 数对 |
| 卷权限错误 `permission denied for table` | DSM 非 root 用户,卷 owner 不是 999:999 | `sudo chown -R 999:999 /volume1/docker/volumes/balthasar_pg_data_simple/_data` | `docker compose restart postgres` 后 healthy |
| `transaction_events` 表行数异常多 | 审计日志爆 (每次编辑/创建都写一行) | 正常现象,V2 加 retention policy;临时 `TRUNCATE transaction_events` 清空 | 查询响应时间恢复 |

## 网络相关

| 症状 | 原因 | 修复 | 验证 |
|---|---|---|---|
| 反向代理后 502 Bad Gateway | app 容器未启 / 反代目标端口错 | `make simple-ps` 确认 app `Up (healthy)`;DSM 反代目标填 `localhost:3000` (不是 NAS IP) | `curl -I https://<域名>/healthz` 返回 200 |
| Cloudflare Tunnel 断连 | cloudflared 容器重启 / 网络抖动 | 重启 cloudflaled 容器;查 `cloudflared logs` | Cloudflare dashboard 显示 tunnel `HEALTHY` |
| 浏览器无法访问,但 `curl` 可以 | DNS 未生效 / SSL 证书未签发 | `dig <域名>` 等待 A 记录;DSM 证书页刷新 Let's Encrypt | 浏览器无证书警告 |
| 时区设了但 cookie 还错位 | cookie 缓存未清 | 浏览器清 balthasar 域所有 cookie;或隐身模式测试 | 登录后 cookie `Secure` flag 正确 |

## 性能相关

| 症状 | 原因 | 修复 | 验证 |
|---|---|---|---|
| app 容器 exit code 137 (OOM Killed) | 内存超 512 MB 上限 | `.env` 加 `APP_MEM_LIMIT=1g` (需改 compose);或排查内存泄露 | `docker stats` 显示 app 内存稳定 |
| 日志爆盘 (磁盘满) | json-file 未配轮转或文件过大 | 确认 compose 含 `max-size: "10m" max-file: "3"`;`docker system prune -f` 清旧日志 | `df -h` 显示磁盘可用 |
| Dashboard 查询慢 (> 2 秒) | N+1 查询 / 索引缺失 | `docker exec balthasar-pg psql -U balthasar -c "EXPLAIN ANALYZE ..."` 看执行计划;联系开发者加索引 | 响应 < 500ms |
| 容器内存持续增长不释放 | Next.js cache 累积 / 内存泄露 | 重启 app:`docker compose restart app`;长期需排查代码 | `docker stats` 内存曲线平稳 |

## 通用排查流程

1. `make simple-logs` 看 app 日志最近 100 行
2. `make simple-logs SVC=postgres` 看 DB 日志
3. `make simple-ps` 确认所有容器 healthy
4. 查本表对应症状
5. 仍无法解决 → 提 [GitHub Issue](https://github.com/AZenking/balthasar/issues) 附日志 + `docker compose config` 输出 (脱敏)
