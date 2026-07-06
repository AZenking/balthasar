# BALTHASAR · 家庭记账系统

> 10 秒记账,每天坚持。

## 当前状态

**Phase 1 Setup + Phase 2 Foundational 已完成** (T001-T027)。

后续 Phase 3-7 (US1-US4 + Polish) 在 feature `001-auth-family` 的 `tasks.md` 中追踪,等待实施。

## 技术栈 (Constitution v2.0.0)

| 层 | 选择 |
|---|---|
| 全栈框架 | Next.js 14 (App Router) |
| RPC | tRPC v11 |
| 认证 | Better-Auth |
| ORM | Drizzle ORM |
| 数据库 | PostgreSQL 16 |
| 样式 | Tailwind CSS |
| 测试 | Vitest + testcontainers |

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env,填入 BETTER_AUTH_SECRET (openssl rand -base64 32)

# 3. 启动 Postgres
docker run -d --name balthasar-pg \
  -e POSTGRES_USER=balthasar \
  -e POSTGRES_PASSWORD=balthasar \
  -e POSTGRES_DB=balthasar \
  -p 5432:5432 \
  postgres:16-alpine

# 4. 应用迁移
pnpm db:migrate

# 5. 启动开发服务器
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 看到首页。

## 项目结构

```
src/
├── app/                          # Next.js App Router
│   ├── api/auth/[...all]/        # Better-Auth 端点
│   ├── api/trpc/[trpc]/          # tRPC 端点
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── server/
│   ├── api/
│   │   ├── root.ts               # appRouter (Phase 2: 空)
│   │   └── trpc.ts               # createContext + protectedProcedure
│   ├── auth/
│   │   ├── config.ts             # Better-Auth 配置
│   │   └── client.ts             # Better-Auth browser client
│   ├── db/
│   │   ├── client.ts             # Drizzle 单例
│   │   ├── schema/               # 8 张表 schema
│   │   ├── migrations/           # 0001_init.sql
│   │   └── index.ts
│   └── domain/auth/              # 纯领域函数 (无 IO)
│       ├── email-normalize.ts
│       ├── password-policy.ts    # NIST 800-63B
│       └── lockout-policy.ts     # 5/5min 决策
├── lib/
│   ├── env.ts                    # zod 校验环境变量
│   ├── uuid.ts                   # UUID v7 生成器
│   └── trpc/
│       ├── client.ts             # 浏览器 tRPC hooks
│       └── server.ts             # RSC caller
└── tests/
    ├── helpers/db.ts             # testcontainers Postgres
    ├── setup.ts                  # 全局测试 setup
    └── integration-setup.ts      # 集成测试全局
```

## 测试

```bash
pnpm test:unit         # 单元 (无 DB)
pnpm test:procedure    # tRPC procedure (无 DB)
pnpm test:integration  # 集成 (testcontainers Postgres)
pnpm test:coverage     # 覆盖率
```

## 设计文档

- 业务规约: `specs/001-auth-family/spec.md`
- 实施计划: `specs/001-auth-family/plan.md`
- 技术决策: `specs/001-auth-family/research.md`
- 数据模型: `specs/001-auth-family/data-model.md`
- 任务清单: `specs/001-auth-family/tasks.md`
- 验证脚本: `specs/001-auth-family/quickstart.md`
- 宪章: `.specify/memory/constitution.md` (v2.0.0)
