# Contracts: 013-simple-deploy

**Date**: 2026-07-08

本 feature 是**部署编排**,不暴露新 API / RPC / SDK。契约面向**运维者**(部署、配置、运维操作),而非应用层调用方。本文档列出三份运维契约:

1. **环境变量契约**: `.env` 必填/选填/默认值
2. **运维命令契约**: Makefile target 输入输出
3. **容器行为契约**: entrypoint 模式、健康检查、信号处理

---

## 1. 环境变量契约 (`deploy/simple/.env.simple.example`)

### 输入约束

| 变量 | 类型 | 必填 | 默认 | 校验失败行为 |
|---|---|---|---|---|
| `BETTER_AUTH_SECRET` | string ≥32 字节 | ✓ | — | compose `${VAR:?...}` 启动失败,提示 `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | URL 含协议 | ✓ | — | zod 校验失败,容器退出非零 |
| `ALLOW_REGISTRATION` | enum `true`/`false` | — | (未设 = `false`) | 非法值 → env schema 拒绝 |
| `NEXT_PUBLIC_ALLOW_REGISTRATION` | enum `true`/`false` | — | 同 `ALLOW_REGISTRATION` | 同上 |
| `TZ` | IANA 时区名 | — | `Asia/Shanghai` | node 自动 fallback UTC + 警告日志 |
| `POSTGRES_USER` | string | — | `balthasar` | — |
| `POSTGRES_PASSWORD` | string | — | `balthasar` | — |
| `POSTGRES_DB` | string | — | `balthasar` | — |
| `POSTGRES_HOST` | string | — | `postgres` | — |
| `APP_PORT` | int 1-65535 | — | `3000` | 非法 → docker 端口映射失败 |
| `POSTGRES_PORT` | int 1-65535 | — | `5432` | 同上 |
| `POSTGRES_EXTERNAL` | enum `true`/`false` | — | (未设 = `false`) | 端口绑 `127.0.0.1` |
| `DOCKER_TAG` | string (semver 或 `latest` 或 SHA) | — | `latest` | 拉取失败 → 报错 |
| `BACKUP_DIR` | path | — | `./backups` | Makefile 不自动创建 |
| `BALTHASAR_ENTRYPOINT_MODE` | enum `serve`/`migrate` | — | `serve` | 非法值 → entrypoint 退出 1 |

### 输出示例 (`.env.simple.example`)

```bash
# === 必填 ===
BETTER_AUTH_SECRET=replace-me-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3000

# === 注册 (首次部署后建议关闭) ===
# ALLOW_REGISTRATION=true   # 取消注释临时开放注册
# NEXT_PUBLIC_ALLOW_REGISTRATION=true

# === 时区 ===
TZ=Asia/Shanghai

# === Postgres (本地默认值,生产用强密码) ===
POSTGRES_USER=balthasar
POSTGRES_PASSWORD=balthasar
POSTGRES_DB=balthasar
# POSTGRES_EXTERNAL=true   # 取消注释让 PG 暴露到 0.0.0.0

# === 端口 ===
APP_PORT=3000
POSTGRES_PORT=5432

# === 镜像 tag (升级时改) ===
DOCKER_TAG=latest

# === 备份目录 (Synology 推荐 /volume1/backup/balthasar) ===
BACKUP_DIR=./backups
```

---

## 2. 运维命令契约 (`Makefile`)

### `simple-up`

```bash
make simple-up
```

**输入**: 当前目录的 `.env` (或 `--env-file` 指定)
**输出**: 拉镜像 → entrypoint 迁移 → 启动 app
**契约**:
- 成功: 所有容器 `healthy` ≤ 60s,`curl http://localhost:${APP_PORT}/healthz` 返回 200
- 失败: 容器进入 `restarting` 状态,`make simple-logs` 显示错误

### `simple-down`

```bash
make simple-down
```

**契约**: 优雅停止所有容器,**不删除数据卷**
- 发送 SIGTERM → app `stop_grace_period: 30s` 内退出
- 数据卷保留,下次 `simple-up` 数据完整

### `simple-logs`

```bash
make simple-logs [SVC=app|postgres]
```

**默认 SVC=app**
**输出**: `docker compose logs -f --tail=100 ${SVC}`

### `simple-backup`

```bash
make simple-backup [DATE=YYYY-MM-DD]
```

**输入**: `BACKUP_DIR` (默认 `./backups`)
**输出**: `${BACKUP_DIR}/backup-YYYY-MM-DD.sql.gz`
**契约**:
- 成功: 文件生成,体积 > 1 KB (空数据库也有 schema)
- 失败: postgres 容器不健康 / 磁盘满,exit 非零,无文件

### `simple-restore`

```bash
make simple-restore DATE=2026-07-08
```

**输入**: `${BACKUP_DIR}/backup-2026-07-08.sql.gz`
**契约**:
- 找不到文件:exit 1,提示 "backup file not found"
- 成功: 数据库恢复,所有表行数与备份时一致
- **危险**: 覆盖当前所有数据,不提示确认 (运维者责任)

### `simple-upgrade`

```bash
make simple-upgrade TAG=0.2.0
```

**输入**: 新版本 tag
**流程**:
1. 修改 `.env` 中 `DOCKER_TAG=${TAG}`
2. `docker compose pull`
3. `docker compose up -d` (entrypoint 自动跑新迁移)
**契约**: 停机 ≤ 60s,数据保留

---

## 3. 容器行为契约

### entrypoint.sh (镜像内 `/app/docker/entrypoint.sh`)

**输入**: 环境变量 `BALTHASAR_ENTRYPOINT_MODE`
**行为**:

| MODE | 行为 | 退出码 |
|---|---|---|
| `serve` (默认) | 等 postgres → `drizzle-kit migrate` → `exec node server.js` | 跟随 node 进程 |
| `migrate` | 等 postgres → `drizzle-kit migrate` → 退出 | 0 (成功) / 1 (失败) |
| 其他 | 打印错误 | 1 |

**信号处理**: `exec node server.js` 后,node 为 PID 1,接收 SIGTERM 优雅停止。Dockerfile `STOPSIGNAL SIGTERM`。

### app 容器健康检查

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/v1/transactions -S 2>&1 | grep -qE 'HTTP/1.1 (204|401)' || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 30s
```

**契约**: `/api/v1/transactions` 不带 key 时返回 401,带 key 时返回 200/4xx。说明 app 已就绪。

### postgres 容器健康检查

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**契约**: PG 进程可接受连接。entrypoint.sh 据此判断可否跑迁移。

### 重启策略

```yaml
restart: unless-stopped
```

**契约**:
- 容器崩溃 → 自动重启
- 用户主动 `docker stop` → **不**自动重启
- 宿主机重启 → 容器跟随启动 (除非用户曾主动 stop)
- entrypoint 迁移失败 → restart 重试,3 次后停止 (需人工看日志)

---

## 4. Better-Auth 行为契约 (现有,本次扩展)

### `POST /api/auth/sign-up-email` (注册端点)

**输入**: `{ email, password, name }`
**行为** (本次扩展):

| 场景 | user.count | `ALLOW_REGISTRATION` | 行为 |
|---|---|---|---|
| 首次部署 | 0 | 任意 | 放行 → 创建用户 → family-init |
| 已有用户 | > 0 | `true` | 放行 → 创建用户 (无 family-init,需手动加入家庭) |
| 已有用户 | > 0 | 未设 / `false` | `before` hook 抛 `REGISTRATION_CLOSED` → 返回 400 |

**响应**:
- 成功: 200 + `{ user, session }`
- 注册关闭: 400 + `{ error: { code: "REGISTRATION_CLOSED" } }`
- 邮箱已存在: 400 + `{ error: { code: "USER_ALREADY_EXISTS" } }` (Better-Auth 内置)

### `/sign-up` 页面 (client-side)

**契约**:
- `NEXT_PUBLIC_ALLOW_REGISTRATION !== "true"` 且 user count > 0 时,SSR 渲染 404
- 否则正常渲染注册表单

### 登录页 (`/sign-in`)

**契约**:
- `NEXT_PUBLIC_ALLOW_REGISTRATION === "true"` 时显示"注册"链接
- 否则不显示

---

## 5. CI 契约 (`.github/workflows/deploy.yml` 扩展)

### 输入

| 项 | 说明 |
|---|---|
| 触发 | `push` to `main` 或 `workflow_dispatch` |
| Secrets | `GITHUB_TOKEN` (自动) |

### 输出

| 产物 | 位置 |
|---|---|
| `ghcr.io/<owner>/<repo>/app:<version>` | GHCR |
| `ghcr.io/<owner>/<repo>/app:<major.minor>` | GHCR |
| `ghcr.io/<owner>/<repo>/app:<major>` | GHCR |
| `ghcr.io/<owner>/<repo>/app:latest` | GHCR |
| `ghcr.io/<owner>/<repo>/app:<git-sha-8>` | GHCR |

### Manifest 契约

```bash
docker manifest inspect ghcr.io/<owner>/<repo>/app:latest
# 应包含:
# - linux/amd64
# - linux/arm64
```

### 构建时间契约

| 场景 | 耗时 |
|---|---|
| 首次 (无 cache) | ≤ 30 min (含 arm64 QEMU 交叉编译) |
| 后续 (GHA cache) | ≤ 8 min |
| 失败重跑 | ≤ 15 min (cache 部分命中) |

---

## 6. 与现有 011-open-api 契约的关系

**零冲突**。011 的 REST API 契约 (`POST/PATCH /api/v1/transactions`) 不变。本 feature 仅修改:
- 部署方式 (compose + entrypoint)
- 启动流程 (自动迁移)
- 首用户注册逻辑
- 多架构镜像

应用代码层面:**`src/server/auth/hooks/registration-gate.ts` 新增,其他文件零修改**。
