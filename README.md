# BALTHASAR · 家庭记账系统

> 10 秒记账,每天坚持。

## 当前状态

**MVP 闭环已完成**:认证 + 账户/分类/交易 + 仪表盘 + 设置 UI + 第三方开放 API。

| Feature | 范围 |
|---|---|
| 001-auth-family | Better-Auth + Family/Member + 审计/锁定 |
| 002-account | 账户管理 (CRUD, 多币种) |
| 003-category | 分类管理 (22 内置 + 自定义) |
| 004-transaction | 交易录入 (signed bigint) |
| 005-transactions-list | 交易列表 (游标分页) |
| 006-dashboard | 月度仪表盘 |
| 007-onboarding-ui | 首次登录引导 |
| 008-transaction-ui | 交易表单 UI |
| 009-transactions-list-ui | 交易列表 UI |
| 010-settings-ui | 设置页 UI |
| 011-open-api | REST API + API Key |

## 技术栈

| 层 | 选择 |
|---|---|
| 全栈框架 | Next.js 16 (App Router, standalone output) |
| RPC | tRPC v11 + superjson |
| 认证 | Better-Auth (email/password + sliding session) |
| ORM | Drizzle ORM + PostgreSQL 16 |
| 样式 | Tailwind CSS v4 + shadcn/ui |
| 校验 | zod |
| 测试 | Vitest |
| 容器 | Docker (node:22-alpine, pnpm 11.9) |
| CI | GitHub Actions → GHCR |

## 快速开始

### 本地开发

```bash
pnpm install
cp .env.example .env  # 填入 BETTER_AUTH_SECRET: openssl rand -base64 32

docker run -d --name balthasar-pg \
  -e POSTGRES_USER=balthasar \
  -e POSTGRES_PASSWORD=balthasar \
  -e POSTGRES_DB=balthasar \
  -p 5432:5432 postgres:16-alpine

pnpm db:migrate
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### Docker 一键启动

```bash
cp docker/.env.example docker/.env
# 编辑 docker/.env,至少改 BETTER_AUTH_SECRET

docker compose -f docker/docker-compose.yml --env-file docker/.env up --build
# 应用: http://localhost:3000  Postgres: localhost:5432
```

### 拉取 CI 镜像

每次推送到 `main` 都会构建并推送到 GHCR:

```bash
docker pull ghcr.io/<owner>/<repo>/app:latest
docker run -p 3000:3000 \
  -e DATABASE_URL=... -e BETTER_AUTH_SECRET=... -e BETTER_AUTH_URL=... \
  ghcr.io/<owner>/<repo>/app:latest
```

## 项目结构

```
src/
├── app/                         # Next.js App Router
│   ├── (app)/                   # 受保护路由 (dashboard / settings / transactions)
│   ├── (auth)/                  # 登录/注册页
│   ├── api/
│   │   ├── auth/[...all]/       # Better-Auth HTTP handler
│   │   ├── trpc/[trpc]/         # tRPC endpoint
│   │   └── v1/transactions/     # REST Open API (011, API Key 鉴权)
│   └── layout.tsx
├── server/
│   ├── api/
│   │   ├── root.ts              # appRouter (auth/account/category/transaction/dashboard/apiKey)
│   │   └── trpc.ts              # createContext + protectedProcedure
│   ├── auth/
│   │   ├── config.ts            # Better-Auth 配置
│   │   ├── api-key-auth.ts      # API Key 验证 (REST)
│   │   └── api-rate-limit.ts    # 内存限流 60/min/Key
│   ├── db/
│   │   ├── client.ts            # Drizzle 单例 + withTransaction
│   │   ├── schema/              # 业务 + 认证 schema
│   │   ├── queries/             # 数据访问层
│   │   └── migrations/          # 0001-0005
│   └── domain/                  # 纯领域函数 (无 IO)
├── components/                  # React + shadcn/ui
└── lib/
    ├── env.ts                   # zod 校验环境变量
    └── trpc/                    # client + server caller
```

## 测试

```bash
pnpm test         # 全部 (Vitest)
pnpm lint         # ESLint 9
pnpm tsc --noEmit # 类型检查
```

## 第三方 API

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/api/v1/transactions` | API Key | 创建交易 (元转分) |
| PATCH | `/api/v1/transactions/:id` | API Key | 更新交易 |
| OPTIONS | `/api/v1/*` | - | CORS preflight |

API Key 在 `/settings` 页生成,格式 `bk_` + 32 字符。详情见
[`specs/011-open-api/`](specs/011-open-api/)。

## 设计文档

- 宪章: `.specify/memory/constitution.md` (v2.0.0)
- 各 feature 设计: `specs/<NNN>-<name>/` (spec / plan / tasks / research / data-model / quickstart)

## CI/CD

推送到 `main` 触发 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. 用 `docker/docker-compose.yml` 构建 `app` 镜像
2. 打 5 个 tag:`<version>` / `<major.minor>` / `<major>` / `latest` / `<sha>`
3. 推送到 `ghcr.io/<owner>/<repo>/app`

镜像只包含 Next.js standalone 产物 + node 运行时,约 150MB。
