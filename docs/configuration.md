# 配置参考 (configuration)

<!--
Created: 2026-07-08
Feature: 014-ops-docs
Audience: 所有用户 (开发者 + 运维者)
Budget: 600 字
-->

环境变量的**单一派生文档**。两层数据源:
- **应用层 (9 项)**: 来自 [`src/lib/env.ts`](../src/lib/env.ts) 的 zod schema,Next.js 进程读取
- **部署层 (7 项)**: 来自 [`deploy/simple/docker-compose.simple.yml`](../deploy/simple/docker-compose.simple.yml) 与 `Makefile`,compose/Makefile 读取,不进 Next.js 进程

SC-008 校验: 应用层 9 项 MUST 全部列出 (已对齐);部署层 7 项为补充信息。

## 目录

- [必填](#必填)
- [数据库](#数据库)
- [认证](#认证)
- [注册开关](#注册开关)
- [时区](#时区)
- [部署](#部署)
- [Client 暴露规则](#client-暴露规则)

## 必填

| 变量 | 类型 | 影响 | 改后重启? | 示例 |
|---|---|---|---|---|
| `BETTER_AUTH_SECRET` | string ≥ 16 字节 | session/JWT 签名密钥 | ✓ | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | URL | 应用对外公开 URL,影响 cookie 域 | ✓ | `https://balthasar.example.com` |

未设 → compose `${VAR:?}` 启动失败。

## 数据库

| 变量 | 默认 | 影响 | 改后重启? |
|---|---|---|---|
| `DATABASE_URL` | (compose 注入) | PG 连接串 | ✓ |
| `POSTGRES_USER` | `balthasar` | PG 账号 | ✓ (首次初始化后不可改) |
| `POSTGRES_PASSWORD` | `balthasar` | PG 密码 | ✓ (PG 数据卷已建后改无效) |
| `POSTGRES_DB` | `balthasar` | PG 库名 | ✓ (首次初始化后不可改) |
| `POSTGRES_HOST` | `postgres` | entrypoint `pg_isready` 目标 | ✓ |
| `POSTGRES_BIND` | `127.0.0.1` | 端口绑定地址,`0.0.0.0` 时对外暴露 | ✓ |
| `POSTGRES_PORT` | `5432` | **宿主机端口** (容器内 PG 永远 5432),改它解决端口冲突或对外暴露 | ✓ |

⚠️ `POSTGRES_USER/DB` 在 PG 首次初始化 (数据卷为空) 时固定,事后改 `.env` 不生效 — 需 `docker compose down -v` 清卷重建。

⚠️ `POSTGRES_PORT` 只改宿主机映射,**不要**与 `POSTGRES_PORT_INTERNAL` (容器内端口,默认 5432,通常不动) 混淆。

**3 种典型场景**:
- 默认 (本机工具连):`POSTGRES_BIND=127.0.0.1` + `POSTGRES_PORT=5432`
- 端口冲突 (5432 被占):`POSTGRES_PORT=5433`
- 内网工具连 (pgAdmin / DBeaver):`POSTGRES_BIND=0.0.0.0` + 强密码

## 认证

| 变量 | 默认 | 影响 | 改后重启? |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` 启用优化 + 关闭 dev 工具 | ✓ |

## 注册开关

| 变量 | 默认 | 影响 | 改后重启? |
|---|---|---|---|
| `ALLOW_REGISTRATION` | `false` | `true` 时允许新用户注册 (首用户例外,详见 [deploy/simple/README.md](../deploy/simple/README.md#步骤-4-注册第一个账号)) | ✓ |
| `NEXT_PUBLIC_ALLOW_REGISTRATION` | 同 `ALLOW_REGISTRATION` | 登录页是否显示"注册"链接 (compose 自动派生,不要单独设) | ✓ (client bundle 重编译) |

## 时区

| 变量 | 默认 | 影响 | 改后重启? |
|---|---|---|---|
| `TZ` | `Asia/Shanghai` | IANA 时区名,业务层按此计算"本日/本月" (Dashboard 月度汇总) | ✓ |

⚠️ 改 `TZ` 后历史 `timestamptz` 实际瞬时值不变,但 Dashboard 月度口径变化 (上海时间 8 月 1 日 00:30 的交易在 UTC 模式下会被算到 7 月)。**首次部署前就定好**。

## 部署

| 变量 | 默认 | 影响 | 改后重启? |
|---|---|---|---|
| `BALTHASAR_ENTRYPOINT_MODE` | `serve` | 镜像 entrypoint 模式: `serve` (迁移+启动) / `migrate` (仅迁移后退出) | ✓ |
| `DOCKER_TAG` | `latest` | 拉取的镜像 tag,升级时改 | ✓ (compose pull) |
| `APP_PORT` | `3000` | 宿主机映射到容器 3000 的端口 | ✓ |
| `BACKUP_DIR` | `./backups` | `make simple-backup` 输出目录 | — (Makefile 即时读) |

## Client 暴露规则

只有 `NEXT_PUBLIC_*` 前缀的变量会进 client bundle:

- ✓ 安全暴露: `NEXT_PUBLIC_ALLOW_REGISTRATION` (布尔值,无敏感信息)
- 🚫 绝不暴露: `BETTER_AUTH_SECRET` / `DATABASE_URL` / `POSTGRES_PASSWORD`

若 `BETTER_AUTH_SECRET` 误加 `NEXT_PUBLIC_` 前缀 → 任何用户可在浏览器 devtools 看到 → **立即轮换密钥 + 清所有 session**。
