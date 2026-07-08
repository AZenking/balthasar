# Implementation Plan: 013-simple-deploy (简易部署)

**Branch**: `013-simple-deploy` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-simple-deploy/spec.md`

## Summary

为家用 NAS / 内网 / 个人评估场景提供**零外部依赖的 Docker Compose 单文件部署方案**,与 012-deploy-simplify (对外生产) 并存。

核心交付:
- `deploy/simple/docker-compose.simple.yml` 单一 compose 入口 (2 服务: app + postgres)
- `deploy/simple/.env.simple.example` 必填/选填环境变量模板
- `deploy/simple/README.md` Synology Container Manager + 通用 Docker 双场景指南
- `docker/entrypoint.sh` migrate-then-start 脚本 (支持 `serve` / `migrate` 模式)
- `Dockerfile` 修改:加 `TZ=Asia/Shanghai`、`drizzle-kit` dep、`COPY entrypoint.sh migrations/ drizzle.config.ts`、`apk add postgresql-client`
- `.github/workflows/deploy.yml` 修改:buildx 多架构 (`linux/amd64,linux/arm64`)
- `Makefile` 新增 `simple-up` / `simple-down` / `simple-logs` / `simple-backup` / `simple-restore` / `simple-upgrade`
- `src/server/auth/hooks/registration-gate.ts` 新增:首用户即 admin + 注册开关 hook
- `src/server/auth/config.ts` 修改:挂载新 hook
- `src/lib/env.ts` 扩展:`ALLOW_REGISTRATION` / `TZ` / `BALTHASAR_ENTRYPOINT_MODE` schema

技术决策详见 [research.md](./research.md),数据/契约详见 [data-model.md](./data-model.md) + [contracts/README.md](./contracts/README.md)。

## Technical Context

**Language/Version**: TypeScript 5.x,Node.js 22 (LTS)

**Primary Dependencies**:
- 既有 (复用): Next.js 16 standalone / tRPC v11 / Better-Auth 1.2.x / Drizzle ORM 0.39 / PostgreSQL 16 / `date-fns-tz`
- 新增运行时: `drizzle-kit` (镜像内运行迁移,不进 prod deps)
- 部署工具: Docker 24+ / Docker Compose v2 / GitHub Actions

**Storage**:
- PostgreSQL 16 (容器化,命名卷 `balthasar_pg_data_simple`)
- 备份文件: `.sql.gz` (gzip 压缩,本地卷)
- 镜像 registry: GHCR (`ghcr.io/azenking/balthasar/app`)

**Testing**:
- 既有 (复用): Vitest (单元 + procedure + integration)
- 新增: Better-Auth `databaseHooks.user.create.before` 单元测试 (mock `db.$count`)
- 端到端: quickstart.md 4 场景 (Linux/Synology/升级备份/多架构)

**Target Platform**:
- Linux x86_64 (Ubuntu 22.04+, Debian 12+)
- Linux arm64 (树莓派 4 / ARM NAS / Apple Silicon 容器)
- macOS (Docker Desktop)
- Windows WSL2
- Synology DSM 7.2+ (Container Manager)
- 排除: DSM 7.1 及更早 / riscv64 / s390x

**Project Type**: web-service deployment (infra feature,无新业务功能)

**Performance Goals** (来自 spec SC):
- 部署启动到监听 < 60 秒 (SC-004)
- 镜像体积 < 200 MB (SC-007)
- 升级停机 < 60 秒 (SC-008)
- arm64 CI 构建 (含 QEMU) ≤ 30 分钟 (首次),后续 ≤ 8 分钟 (cache)

**Constraints**:
- 总配置行数 < 150 行 (SC-006)
- README 总字数 < 1500 字 (SC-009)
- 零外部编排依赖 (无 Caddy / Traefik / nginx sidecar)
- 零 schema 变更 (不加 `role` 字段)

**Scale/Scope**:
- 单实例部署 (家用 1-3 人用)
- 不支持多机集群 / K8s (YAGNI)
- 单地域时区 (`TZ` env,默认 `Asia/Shanghai`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

宪章 v2.0.0 六大原则逐条检查:

### 一、MVP Scope ✓ PASS

本 feature 不引入新业务功能 (转账/预算/AI/OCR/导入导出 等均在 `docs/MVP.md` 外)。仅调整部署编排与首用户安全机制。`docs/MVP.md` "Docker 一键启动" 验收标准本 feature 真正落地。

### 二、Feature-Sliced Architecture ✓ PASS

- 新增 server 端代码 (`src/server/auth/hooks/registration-gate.ts`) 在 `auth` slice 内,与现有 `family-init` / `audit` 同栈。
- 不引入跨 slice 抽象,不新增 controller/service/repository 层级。
- 部署文件归 `deploy/simple/`,与现有 `docker/` 平级,符合"运维即 feature"模式。

### 三、领域驱动设计 ✓ PASS

- 零聚合变更:`Family` 仍是唯一聚合根。
- 不新增表 (不加 `role`),首用户即 admin 通过 `ORDER BY created_at LIMIT 1` 启发式实现,无需新不变量。
- Better-Auth 边界保持:首用户即 admin 的判定在 Better-Auth `user.create.before` hook 内,业务聚合 (Family) 通过现有 `family-init` 间接关联。

### 四、测试优先 ✓ PASS (实施时需遵循)

- `registration-gate.ts` 必须先写测试再写实现:验证 user.count==0 放行 / user.count>0 + ALLOW_REGISTRATION=false 拒绝 / 抛 REGISTRATION_CLOSED 错误码。
- entrypoint.sh 测试用 bash 单元测试 (bats-core) 或集成测试 (实际 docker compose up 验证 exit code)。
- 端到端:quickstart.md 4 场景全部跑通。
- **实施任务 T007 (registration-gate) 与 T008 (test) 必须红绿循环。**

### 五、性能与极速录入 ✓ PASS

- 容器启动时间不影响热路径 (启动后 steady state)。
- `db.$count(user)` 在注册端点中调用,每注册一次一次查询,家用频率极低 (< 1/分钟),无性能影响。
- Dashboard "本月" 用 `date-fns-tz` 计算月度边界,已在 006-dashboard 中使用,本 feature 不增加调用。

### 六、简单 (YAGNI) ✓ PASS

- 不引入反向代理 sidecar (Caddy/Traefik) — 移到 README 文档化 DSM Reverse Proxy / Cloudflare Tunnel。
- 不引入自动备份 sidecar — 移到 Makefile `simple-backup` 手动命令。
- 不引入独立迁移容器 (与 012 区分) — 用 entrypoint 自动跑。
- 不加 `role` 字段 — 首用户启发式判定。
- 不引入 PUID/PGID 机制 — 文档说明 DSM 默认 root 模式可用。
- 不引入蓝绿部署 / 零停机升级 — YAGNI,家用场景接受 60s 停机。

**Constitution Check 结论**: 6/6 全部 PASS,**无 Complexity Tracking 违规**。

## Project Structure

### Documentation (this feature)

```text
specs/013-simple-deploy/
├── plan.md              # 本文件
├── spec.md              # /speckit-specify 产物
├── checklists/
│   └── requirements.md  # /speckit-specify 产物 (12/12 通过)
├── research.md          # Phase 0: 10 项 NEEDS CLARIFICATION 解决
├── data-model.md        # Phase 1: env schema + 文件系统布局 + 状态机
├── contracts/
│   └── README.md        # Phase 1: 环境变量 / 运维命令 / 容器行为 / CI 契约
├── quickstart.md        # Phase 1: 4 端到端场景 (Linux/Synology/升级/多架构)
└── tasks.md             # Phase 2 (/speckit-tasks 待生成)
```

### Source Code (repository root)

```text
.
├── deploy/                              # 新增子目录
│   └── simple/                          # 013-simple-deploy 产物
│       ├── docker-compose.simple.yml    # 单一 compose 入口 (2 服务)
│       ├── .env.simple.example          # 环境变量模板
│       └── README.md                    # Synology + 通用 Docker 指南
│
├── docker/                              # 已存在 (005 docker 重组)
│   ├── docker-compose.yml               # 保留 (本地开发)
│   ├── docker-compose.prod.yml          # 保留 (012 生产)
│   ├── .env.example                     # 保留
│   ├── .env.prod.example                # 保留
│   └── entrypoint.sh                    # 新增:migrate-then-start 脚本
│
├── Dockerfile                           # 修改:TZ + drizzle-kit + entrypoint
├── Makefile                             # 新增:simple-* targets
├── .github/
│   └── workflows/
│       └── deploy.yml                   # 修改:buildx 多架构
│
└── src/                                 # 应用代码 (最小改动)
    ├── lib/
    │   └── env.ts                       # 修改:加 ALLOW_REGISTRATION / TZ schema
    └── server/
        └── auth/
            ├── config.ts                # 修改:挂载 registration-gate hook
            └── hooks/
                ├── family-init.ts       # 保留
                ├── audit.ts             # 保留
                └── registration-gate.ts # 新增:首用户 + 注册开关
```

**Structure Decision**: 复用现有 `deploy/` 与 `docker/` 分层。新文件集中在 `deploy/simple/`,不污染现有目录。应用代码改动限制在 3 个文件 (`env.ts` / `config.ts` / `hooks/registration-gate.ts`),最小侵入。

## Complexity Tracking

> 无 Constitution Check 违规,本表为空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (无) | — | — |

## 实施前检查清单

进入 `/speckit-tasks` 前,确认以下产物就绪:

- [x] spec.md (12/12 checklist 通过,3 项 clarification 已整合)
- [x] research.md (10 项 NEEDS CLARIFICATION 解决)
- [x] data-model.md (env schema + 文件布局 + 状态机)
- [x] contracts/README.md (4 份契约:env / 命令 / 容器 / CI)
- [x] quickstart.md (4 端到端场景)
- [ ] tasks.md (待 `/speckit-tasks` 生成)

**下一步**: 执行 `/speckit-tasks` 生成任务清单。
