# Data Model: 013-simple-deploy

**Date**: 2026-07-08

本 feature 是部署编排,**不引入任何数据库 schema 变更**。本文档聚焦:
1. 受影响的 DB 表 (现有,只读)
2. 环境变量 schema
3. 文件系统布局 (容器内 / 宿主)

---

## 1. 数据库表 (无变更)

### `user` (Better-Auth,现有)

```
id           text PK (cuid2)
email        text UNIQUE NOT NULL
email_verified boolean NOT NULL DEFAULT false
name         text NOT NULL
image        text
created_at   timestamptz NOT NULL DEFAULT NOW()
updated_at   timestamptz NOT NULL DEFAULT NOW()
```

**首用户判定逻辑** (research.md Q1):

```sql
-- 注册前判断
SELECT COUNT(*) FROM "user";
-- COUNT = 0 → 允许注册 (即将注册的为 admin)
-- COUNT > 0 AND env.ALLOW_REGISTRATION != 'true' → 拒绝 (403 REGISTRATION_CLOSED)
```

**首用户即 admin 启发式** (后续业务用):

```sql
-- 判断某 userId 是否为 admin (= 最早创建的用户)
SELECT id FROM "user" ORDER BY created_at ASC LIMIT 1;
-- 结果 id == 输入 userId → admin
```

此查询无需新索引 (现有 PK 足够)。家用场景频率 < 1/分钟,查询成本可忽略。

### 其他业务表

`family`, `member`, `account`, `transaction`, `category`, `transaction_events`, `api_keys` —— **零变更**,本 feature 不触及。

---

## 2. 环境变量 Schema

### 必填 (启动时 `${VAR:?}` 强制校验)

| 变量 | 类型 | 示例 | 说明 |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | string (≥32 字节) | `openssl rand -base64 32` 输出 | Better-Auth session/JWT 签名密钥 |
| `BETTER_AUTH_URL` | URL (含协议) | `http://localhost:3000` 或 `https://balthasar.example.com` | 应用对外公开 URL,Better-Auth 据此设 cookie 域 |

### 选填 (有默认值)

| 变量 | 默认 | 说明 |
|---|---|---|
| `ALLOW_REGISTRATION` | (未设 = false) | `true` 临时开启注册 (首用户已建后)。逻辑:`user.count == 0` 时永远允许,否则按此变量 |
| `NEXT_PUBLIC_ALLOW_REGISTRATION` | 同 `ALLOW_REGISTRATION` | client 端可见,登录页据此渲染注册链接 |
| `TZ` | `Asia/Shanghai` | 容器时区,业务层按此计算"本日/本月"。IANA 名称 (如 `America/Los_Angeles`) |
| `POSTGRES_USER` | `balthasar` | 数据库账号 |
| `POSTGRES_PASSWORD` | `balthasar` | 数据库密码 (生产建议 ≥16 字符) |
| `POSTGRES_DB` | `balthasar` | 数据库名 |
| `POSTGRES_HOST` | `postgres` | compose 内服务名;独立容器时改为 IP/host |
| `APP_PORT` | `3000` | 宿主机映射到容器 3000 的端口 |
| `POSTGRES_PORT` | `5432` | 宿主机映射到容器 5432 的端口 (默认绑 127.0.0.1) |
| `POSTGRES_EXTERNAL` | (未设) | 设为 `true` 时 PG 端口绑 `0.0.0.0`,否则绑 `127.0.0.1` |
| `DOCKER_TAG` | `latest` | 拉取的镜像 tag;升级时改版本号 |
| `BACKUP_DIR` | `./backups` | Makefile `simple-backup` 输出目录,Synology 推荐 `/volume1/backup/balthasar` |
| `BALTHASAR_ENTRYPOINT_MODE` | `serve` | 镜像 entrypoint 模式:`serve` / `migrate` |

### CI 构建时 (仅 workflow 内部)

| 变量 | 说明 |
|---|---|
| `DOCKER_REGISTRY` | `ghcr.io/<owner>/<repo>`,自动小写化 |
| `DOCKER_TAG` | git short SHA |
| `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` | GHA runner 强制 Node 24 |

---

## 3. 文件系统布局

### 仓库内新增

```
deploy/
└── simple/
    ├── docker-compose.simple.yml  # 单一 compose 入口
    ├── .env.simple.example        # 环境变量模板
    └── README.md                  # Synology + Generic Docker 部署指南
docker/
└── entrypoint.sh                  # migrate-then-start 脚本 (镜像内 COPY)
Makefile                            # 顶层 Makefile,新增 simple-* targets
Dockerfile                          # 修改:加 TZ, drizzle-kit, COPY entrypoint.sh
.github/workflows/deploy.yml       # 修改:加 buildx 多架构
```

### 镜像内 (runner stage)

```
/app
├── server.js                      # Next.js standalone 产物 (现有)
├── .next/
│   └── static/                    # 静态资源 (现有)
├── public/                        # 静态资源 (现有)
├── node_modules/
│   ├── drizzle-kit/               # 迁移工具 (新增,独立 dep)
│   ├── date-fns-tz/               # 时区计算 (现有,复用)
│   └── better-auth/               # 认证 (现有)
├── migrations/                    # SQL 迁移文件 (新增 COPY)
│   ├── 0001_init.sql
│   ├── 0002_accounts.sql
│   ├── 0003_categories.sql
│   ├── 0004_transactions.sql
│   ├── 0005_api_keys.sql
│   └── meta/                      # Drizzle Kit 元数据
├── drizzle.config.ts              # Drizzle Kit 配置 (新增 COPY)
├── docker/
│   └── entrypoint.sh              # 启动脚本 (新增 COPY, +x)
└── src/server/db/schema/          # 编译后 schema (供 drizzle-kit 读)
```

### 宿主机卷

#### Linux/macOS 通用

```
$PWD/backups/                      # 默认 BACKUP_DIR (Makefile 创建)
  └── backup-YYYY-MM-DD.sql.gz     # pg_dump + gzip 产物

$docker_volumes_root/balthasar_pg_data_simple/  # 命名卷 (compose 创建)
  └── PostgreSQL 数据目录 (PG 自管)
```

#### Synology DSM 7.2+

```
/volume1/docker/balthasar/                       # 用户上传 compose 的目录
  ├── docker-compose.simple.yml
  └── .env

/volume1/docker/volumes/balthasar_pg_data_simple/  # DSM 自动创建
  └── _data/  (PG data)

/volume1/backup/balthasar/                       # 用户手动创建 BACKUP_DIR
  └── backup-YYYY-MM-DD.sql.gz
```

---

## 4. 验证规则

### env 校验 (lib/env.ts 扩展)

```typescript
// 现有 env schema 追加
const envSchema = createEnv({
  serverVars: {
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    ALLOW_REGISTRATION: z.enum(["true", "false"]).optional().default("false"),
    TZ: z.string().default("Asia/Shanghai"),
    POSTGRES_HOST: z.string().default("postgres"),
    POSTGRES_USER: z.string().default("balthasar"),
    POSTGRES_PASSWORD: z.string(),
    POSTGRES_DB: z.string().default("balthasar"),
    BALTHASAR_ENTRYPOINT_MODE: z.enum(["serve", "migrate"]).optional(),
  },
  clientVars: {
    NEXT_PUBLIC_ALLOW_REGISTRATION: z.enum(["true", "false"]).optional(),
  },
  runtimeEnv: {
    ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION,
    NEXT_PUBLIC_ALLOW_REGISTRATION: process.env.NEXT_PUBLIC_ALLOW_REGISTRATION ?? process.env.ALLOW_REGISTRATION,
    TZ: process.env.TZ,
    // ...
  },
});
```

### Better-Auth hook 校验

- `user.create.before` 抛 `REGISTRATION_CLOSED` → Better-Auth 返回 400 + 错误码 → 客户端显示"已关闭注册"
- `user.create.after` (现有) 不变:继续跑 `family-init` + `audit`

---

## 5. 状态机

### 注册流程

```
[首次部署]
  └─ env.ALLOW_REGISTRATION 未设 (默认 false)
       └─ user.count == 0 → 放行 → 首用户 → family-init → admin (启发式)
            └─ 用户改 env.ALLOW_REGISTRATION=false 重启 (或不改,反正都 false)
                 └─ 第二人访问 /sign-up → 404
                 └─ 第二人 POST /sign-up-email → 400 REGISTRATION_CLOSED

[已有用户,加新成员]
  └─ env.ALLOW_REGISTRATION=true 重启
       └─ 第二人注册 → user.count==1, env 允许 → 放行
            └─ env.ALLOW_REGISTRATION=false 重启
```

### 容器启动流程

```
docker compose up -d
  ├─ postgres 启动 → healthcheck pg_isready
  └─ app 启动 → entrypoint.sh
       ├─ BALTHASAR_ENTRYPOINT_MODE=migrate? → 仅迁移,退出
       └─ BALTHASAR_ENTRYPOINT_MODE=serve (默认)?
            ├─ 等 postgres healthy (pg_isready 重试)
            ├─ node drizzle-kit/bin.cjs migrate
            │    ├─ 成功 → 继续
            │    └─ 失败 → exit 非 0 → docker restart: unless-stopped 重试
            └─ exec node server.js (PID 1)
```

---

## 6. 与 012-deploy-simplify 的对比

| 维度 | 013 (simple) | 012 (prod) |
|---|---|---|
| 新 DB schema | 无 | 无 |
| 新 env 变量 | ALLOW_REGISTRATION, TZ | (各自一份) |
| 文件数 | docker-compose.simple.yml + .env.simple.example + README + entrypoint.sh + Makefile (5 项) | docker-compose.yml + override + .env + Caddyfile + Makefile + ... (10+ 项) |
| Compose 服务 | 2 (app + postgres) | 4+ (app + postgres + caddy + backup sidecar + migrate) |
| 启动 entrypoint | migrate-then-start (单一) | app 直接跑 `node server.js` (init 容器先跑迁移) |

共享:**同一镜像 / 同一 Drizzle Kit / 同一 SQL migrations / 同一 GHCR tag**。
