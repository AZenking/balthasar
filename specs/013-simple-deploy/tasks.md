---

description: "Task list for 013-simple-deploy (简易部署 / Synology + Docker)"

---

# Tasks: 简易部署 (013-simple-deploy)

**Input**: Design documents from `/specs/013-simple-deploy/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/README.md, quickstart.md

**Tests**: Constitution 原则四 (Test-First) 强制 registration-gate hook 写测试再实现 (TDD 红绿)。

**Organization**: Tasks grouped by user story. Phase 2 共享基础设施阻塞所有 US,US1/US2/US3 各自独立可测。

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: 可并行 (不同文件,无未完成依赖)
- **[Story]**: 任务所属 user story (US1/US2/US3)
- 描述中 MUST 包含确切文件路径

---

## Phase 1: Setup

**Purpose**: 项目初始化与依赖检查

无新依赖。`drizzle-kit` 已是 devDep,本 feature 通过 Dockerfile 把它打到镜像内 (`COPY --from=deps`)。

---

## Phase 2: Foundational (阻塞所有 US)

**Purpose**: 部署基础设施 + 首用户安全 hook,所有 US 共用

**⚠️ CRITICAL**: 完成前不可进入 US phase

- [X] T001 Extend `src/lib/env.ts` 增加 `ALLOW_REGISTRATION` (enum true/false,default false) / `NEXT_PUBLIC_ALLOW_REGISTRATION` / `TZ` (default Asia/Shanghai) / `BALTHASAR_ENTRYPOINT_MODE` (enum serve/migrate) / `POSTGRES_HOST` (default postgres) 五个变量的 zod schema 与 runtimeEnv 映射
- [X] T002 Modify `Dockerfile`:builder stage 加 `RUN pnpm add -D drizzle-kit@^0.30`(确保迁移工具随源码一起);runner stage 加 `ENV TZ=Asia/Shanghai` + `RUN apk add --no-cache postgresql-client` + `COPY drizzle.config.ts ./` + `COPY src/server/db/migrations ./src/server/db/migrations` + `COPY src/server/db/schema ./src/server/db/schema` + `COPY docker/entrypoint.sh ./docker/entrypoint.sh` + `RUN chmod +x docker/entrypoint.sh` + 把 `CMD ["node", "server.js"]` 改为 `CMD ["sh", "docker/entrypoint.sh"]`
- [X] T003 Create `docker/entrypoint.sh`:支持 `BALTHASAR_ENTRYPOINT_MODE=serve` (默认,等 pg_isready → drizzle-kit migrate → exec node server.js) 与 `BALTHASAR_ENTRYPOINT_MODE=migrate` (仅迁移后退出 0/1);set -e + 未知 mode exit 1;首行 shebang `#!/bin/sh`
- [X] T004 Verify `drizzle.config.ts` 在镜像内能被 `node node_modules/drizzle-kit/bin.cjs migrate --config=drizzle.config.ts` 调起;若 config 引用了 runner stage 不存在的文件 (如 tsconfig 路径) 调整路径或加 COPY
- [X] T005 [P] Create `src/server/auth/hooks/__tests__/registration-gate.test.ts`:Vitest 单元测试,覆盖 (1) user 表为空 → before hook 放行不抛错 (2) user 表非空 + ALLOW_REGISTRATION 未设 → 抛 REGISTRATION_CLOSED (3) user 表非空 + ALLOW_REGISTRATION=true → 放行;mock `db.$count(user)` 与 `env.ALLOW_REGISTRATION`,不连真实 DB
- [X] T006 Implement `src/server/auth/hooks/registration-gate.ts`:导出 `registrationGate` 对象 `{ user: { create: { before: async (user) => Promise<void> } } }`;逻辑见 research.md Q1 (查 user count,==0 放行,否则查 env.ALLOW_REGISTRATION);所有 T005 测试 MUST 转绿
- [X] T007 Modify `src/server/auth/config.ts`:把 `registrationGate.user.create.before` 挂到 `databaseHooks.user.create` (与现有 `family-init` `after` 共存,不替换);before 抛错时 Better-Auth 会自动回滚事务
- [X] T008 [P] Create `deploy/simple/docker-compose.simple.yml`:services.postgres (postgres:16-alpine,命名卷 balthasar_pg_data_simple,healthcheck pg_isready,默认 127.0.0.1:5432 仅当 POSTGRES_EXTERNAL=true 时 0.0.0.0) + services.app (image ghcr.io/azenking/balthasar/app:${DOCKER_TAG:-latest},restart: unless-stopped,env 全部来自 .env,depends_on postgres service_healthy,healthcheck wget /api/v1/transactions 204/401,stop_grace_period: 30s,日志 json-file max-size 10m max-file 3,内存上限 mem_limit 512m);双网络 balthasar_internal (internal:true) + balthasar_edge
- [X] T009 [P] Create `deploy/simple/.env.simple.example`:含必填 BETTER_AUTH_SECRET/BETTER_AUTH_URL + 选填 ALLOW_REGISTRATION/NEXT_PUBLIC_ALLOW_REGISTRATION/TZ/POSTGRES_*/APP_PORT/DOCKER_TAG/BACKUP_DIR/BALTHASAR_ENTRYPOINT_MODE;每项加 `#` 注释说明与默认值,见 data-model.md 第 2 节

**Checkpoint**: docker compose -f deploy/simple/docker-compose.simple.yml --env-file deploy/simple/.env.simple.example config --quiet 通过;`pnpm test src/server/auth/hooks/__tests__/registration-gate.test.ts` 全绿;`docker build .` 成功产出含 TZ/migrations/entrypoint 的镜像

---

## Phase 3: User Story 1 — Synology Container Manager 一键部署 (Priority: P1) 🎯 MVP

**Goal**: DSM 7.2+ 用户上传 compose + .env 到 `/volume1/docker/balthasar/`,在 Container Manager 导入后 3 分钟内 healthy

**Independent Test**: quickstart.md 场景 B (Synology DSM 7.2 部署) 全部步骤通过

### Implementation for User Story 1

- [X] T010 [US1] Write `deploy/simple/README.md` 的 "Synology Container Manager 部署" 章节:含 (1) DSM 7.2+ 与 x86_64/arm64 机型要求 (2) File Station 上传 compose + .env 到 `/volume1/docker/balthasar/` (3) Container Manager → 项目 → 新建 → 选 compose 文件 → 启动 (4) DSM 控制面板 → 登录门户 → 高级 → 反向代理 + Let's Encrypt 证书配置 (5) Cloudflare Tunnel 作为反代备选方案的简要说明 (6) 常见问题 (端口冲突 / 卷权限 / ARM 镜像);总字数与通用章节合计 < 1500 字 (SC-009)
- [ ] T011 [US1] 验证 quickstart.md 场景 B (Synology 部署):**NEEDS_REAL_DEVICE** — 留待运维者在真实 DSM 7.2+ NAS 上验证;实施代码已就绪,SC-001/SC-003 由 README 步骤保障

**Checkpoint**: US1 可独立验证 — Synology 用户能按 README 部署并访问登录页

---

## Phase 4: User Story 2 — 任意 Docker 一键启动 (Priority: P1)

**Goal**: Linux/macOS/WSL2 上 `git clone` + `cp .env.simple.example .env` + `make simple-up` (或 docker compose up -d),3 分钟内 `curl localhost:3000` 200

**Independent Test**: quickstart.md 场景 A (Linux/macOS/WSL2 部署) 通过

### Implementation for User Story 2

- [X] T012 [US2] Create `Makefile` (仓库根,如不存在) 或扩展现有:`simple-up` (docker compose -f deploy/simple/docker-compose.simple.yml --env-file deploy/simple/.env up -d --build) / `simple-down` (down,不删卷) / `simple-logs` (`@SVC=app` 默认,docker compose logs -f --tail=100 ${SVC}) / `simple-ps` (docker compose ps);每个 target 加 `.PHONY` 与简短注释
- [X] T013 [US2] Write `deploy/simple/README.md` 的 "通用 Docker 部署" 章节:含 (1) 前置 Docker 24+ + Compose v2+ (2) git clone + cp .env.simple.example .env + 必填 BETTER_AUTH_SECRET (openssl rand -base64 32) (3) make simple-up 一键启动 (4) 验证 curl /healthz 200 + 浏览器访问 (5) 内网/VPN/Cloudflare Tunnel 后端场景说明 (6) 升级与备份指向 README 同名章节
- [ ] T014 [US2] 验证 quickstart.md 场景 A (通用 Docker 部署):**NEEDS_CLEAN_ENV** — 当前宿主已有 dev 容器占用 `balthasar-app` / `balthasar-pg` 名字与 3000/5432 端口,无法在开发机直接 `make simple-up`;`docker compose config --quiet` 已验证语法,完整端到端留待干净 VM 验证 (SC-002 / SC-004 / SC-008)

**Checkpoint**: US2 可独立验证 — 任意 Docker 用户能按 README 一键启动

---

## Phase 5: User Story 3 — 升级 + 手动备份 (Priority: P2)

**Goal**: 改 tag + 重启完成升级;备份/恢复各一条命令

**Independent Test**: quickstart.md 场景 C (升级 + 备份 + 恢复) 通过

### Implementation for User Story 3

- [X] T015 [US3] Extend `Makefile`:加 `simple-backup` (`@mkdir -p ${BACKUP_DIR};docker compose -f deploy/simple/docker-compose.simple.yml exec -T postgres pg_dump -U $${POSTGRES_USER} $${POSTGRES_DB} | gzip > ${BACKUP_DIR}/backup-$$(date +%F).sql.gz`,默认 BACKUP_DIR=./backups) / `simple-restore` (用法 `make simple-restore DATE=YYYY-MM-DD`,gunzip + psql restore,文件不存在 exit 1) / `simple-upgrade` (用法 `make simple-upgrade TAG=0.2.0`,sed 改 .env DOCKER_TAG → docker compose pull → docker compose up -d)
- [X] T016 [US3] Write `deploy/simple/README.md` 的 "升级与备份" 章节:含 (1) 升级三步流程 + make simple-upgrade 一键 (2) 手动备份命令 + BACKUP_DIR 配置示例 (3) 恢复命令 + DATE 参数 (4) Synology Task Scheduler 定时备份示例 (5) 警告:`docker compose down -v` 会删卷,日常用 `simple-down`
- [ ] T017 [US3] 验证 quickstart.md 场景 C (升级 + 备份 + 恢复):**NEEDS_CLEAN_ENV** — 与 T014 同因,需干净 VM 验证;Makefile `simple-backup` / `simple-restore` / `simple-upgrade` target 已通过 `make -n` 干跑语法校验

**Checkpoint**: US3 可独立验证 — 升级、备份、恢复三条命令均工作

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 多架构 CI / 注册关闭验证 / 时区验证 / 端到端

- [X] T018 [P] Modify `.github/workflows/deploy.yml`:把 `docker compose -f docker/docker-compose.yml build` + 手动 `docker tag` 循环替换为 `docker/setup-qemu-action@v3` + `docker/setup-buildx-action@v3` + `docker/build-push-action@v5` with `platforms: linux/amd64,linux/arm64` + `cache-from: type=gha` + `cache-to: type=gha,mode=max` + 5 个 tag (version/major.minor/major/latest/sha);保留 env.BETTER_AUTH_SECRET/BETTER_AUTH_URL/DATABASE_URL 构建期占位
- [ ] T019 [P] 验证 quickstart.md 场景 D (多架构):**NEEDS_GHCR_BUILT** — GHA workflow 改造完成,但 GitHub 账号仍 suspended,等解封后首次推送 main 触发构建;`docker manifest inspect` 需在镜像 push 后执行 (SC-007)
- [ ] T020 [P] 验证 SC-010 (注册关闭):**NEEDS_REBUILD** — registration-gate hook 已挂入 `src/server/auth/config.ts`,但当前运行的 dev 容器是旧代码,需 `docker compose -f docker/docker-compose.yml build && up -d` 重建后再验证 curl 行为
- [ ] T021 [P] 验证 SC-011 (TZ 时区汇总):**NEEDS_REBUILD** — Dockerfile TZ 默认已设 `Asia/Shanghai`,需重建镜像 + 跨月记账后核对 Dashboard (SC-011)
- [ ] T022 Run `specs/013-simple-deploy/quickstart.md` 4 场景全部端到端跑通:**NEEDS_CLEAN_ENV** — 综合验证依赖 T014/T017 (干净 VM) + T019 (CI 解封) + T020/T021 (dev 镜像重建),全部就绪后再跑 11 项 SC 验收清单

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 空,无依赖
- **Phase 2 Foundational (T001-T009)**: 阻塞所有 US。T005 [P] / T008 [P] / T009 [P] 可并行;T006 依赖 T005 (TDD 红绿);T007 依赖 T006;T002/T003/T004 串行
- **Phase 3 US1 (T010-T011)**: 依赖 T007 (registration-gate) + T008 (compose) + T009 (.env)
- **Phase 4 US2 (T012-T014)**: 依赖 T007 + T008 + T009;与 US1 文件冲突点 (README) 串行
- **Phase 5 US3 (T015-T017)**: 依赖 T008 + T009;Makefile 与 US2 串行 (T012/T015 同文件)
- **Phase 6 Polish (T018-T022)**: T018 独立可并行;T019 依赖 T018;T020 依赖 T007;T021 依赖 T002;T022 依赖所有

### User Story Dependencies

- **US1 (P1)**: 依赖 Phase 2 完成;独立可测
- **US2 (P1)**: 依赖 Phase 2 完成;与 US1 共享 README 文件,实施时按 US1 → US2 串行避免合并冲突
- **US3 (P2)**: 依赖 Phase 2 完成;Makefile 与 US2 共享,实施时按 US2 → US3 串行
- **MVP 范围**: Phase 2 + US1 = 首用户部署闭环 (Synology 用户能跑起来);US2/US3 紧随

### Within Each User Story

- README 章节合并到同一文件时,US1 → US2 → US3 串行写
- 测试任务 (T005) MUST 先于实现 (T006) 完成,验证红色
- 验证任务 (T011/T014/T017) MUST 在对应 US 实现完成后执行

### Parallel Opportunities

- **Phase 2 内**:T005 (registration-gate 测试) + T008 (compose.simple.yml) + T009 (.env.simple.example) 三者不同文件无依赖,可并行
- **Phase 6 内**:T018 (GHA) / T019 (多架构验证需 T018 完成则不可并行) / T020 (注册验证) / T021 (时区验证) 部分可并行 (T020 与 T021 不同关注点,文件不冲突)

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch these 3 tasks in parallel (different files, no dependencies):
Task: T005 - "Create registration-gate test in src/server/auth/hooks/__tests__/registration-gate.test.ts"
Task: T008 - "Create deploy/simple/docker-compose.simple.yml"
Task: T009 - "Create deploy/simple/.env.simple.example"

# After T005 completes (red), implement T006 (green):
Task: T006 - "Implement registration-gate in src/server/auth/hooks/registration-gate.ts"
```

---

## Implementation Strategy

### MVP First (Phase 2 + US1)

1. 完成 Phase 2 Foundational (T001-T009) — 9 任务
2. 完成 Phase 3 US1 (T010-T011) — README + Synology 验证
3. **STOP and VALIDATE**: 在 Synology DSM 7.2+ 上手动跑 quickstart.md 场景 B
4. 若 SC-001 (< 5min) / SC-003 (证书有效) 通过,MVP 达成
5. 否则回到 Phase 2 修复

### Incremental Delivery

1. Phase 2 Foundational → 镜像 + compose + registration-gate 就绪
2. + Phase 3 US1 → Synology 用户可部署 (MVP)
3. + Phase 4 US2 → 通用 Docker 用户可部署
4. + Phase 5 US3 → 升级备份流程完整
5. + Phase 6 Polish → 多架构 + 全场景验收

### Parallel Team Strategy

单人顺序执行最稳:
- Phase 2 (T001-T009)
- Phase 3 (T010-T011) → 验证
- Phase 4 (T012-T014) → 验证
- Phase 5 (T015-T017) → 验证
- Phase 6 (T018-T022) → 验收

如双人:
- A: T001-T007 (应用层 + 镜像层)
- B: T008-T009 + T010 (compose + .env + README Synology)
- 合流后 A 接 T012-T014,B 接 T015-T017

---

## Notes

- 所有任务 MUST 在 description 中包含确切文件路径
- T005 是唯一显式 Test 任务 (Constitution 原则四针对核心逻辑)
- 验证任务 (T011/T014/T017/T019/T020/T021/T022) 引用 quickstart.md 场景,不重复列步骤
- US1/US2/US3 共享 `deploy/simple/README.md`,实施时按 US1 → US2 → US3 串行写章节
- Makefile 同样共享,T012 → T015 串行追加 targets
- 镜像多架构改造 (T018) 是 Polish,不阻塞 US;但 SC-007 (双架构) 需 T018 完成后才能验证
- 与 012-deploy-simplify 完全解耦,本 feature 不修改 docker/docker-compose.yml 与 docker/docker-compose.prod.yml
- `drizzle-kit` 从 devDep 升级到 runtime dep 是有意为之 (镜像内需独立运行),不污染开发环境依赖树 (pnpm 只在 build stage 装它)
