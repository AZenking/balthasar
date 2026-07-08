---

description: "Task list for 014-ops-docs (运维文档体系)"

---

# Tasks: 运维文档 (014-ops-docs)

**Input**: Design documents from `/specs/014-ops-docs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/README.md, quickstart.md

**Tests**: 文档无单元测试;SC-001~SC-010 是量化验收标准,在 Phase 6 Polish 跑校验脚本。

**Organization**: 6 份文档按"用户角色"切片,叶子文档 (configuration/architecture) 在 Foundational,业务文档按 US 优先级 (P1/P1/P2) 排列。

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: 可并行 (不同文件,无未完成依赖)
- **[Story]**: 任务所属 user story (US1/US2/US3)
- 描述中 MUST 包含确切文件路径

---

## Phase 1: Setup

**Purpose**: 项目初始化与依赖检查

无新依赖。纯 Markdown 文档,不需要 install / build 步骤。

---

## Phase 2: Foundational (叶子文档,被多文档引用)

**Purpose**: env 变量主源 + 架构导览,其他文档会引用它们。完成前不可进入 US phase。

**⚠️ CRITICAL**: T001 + T002 必须先于 US 文档,因为 US 文档会引用它们。

- [X] T001 [P] Create `docs/configuration.md`:列出 9 个 env 变量 (DATABASE_URL / BETTER_AUTH_SECRET / BETTER_AUTH_URL / NODE_ENV / ALLOW_REGISTRATION / NEXT_PUBLIC_ALLOW_REGISTRATION / TZ / BALTHASAR_ENTRYPOINT_MODE / POSTGRES_HOST) 的 5 列表格 (变量名 / 类型与默认 / 影响范围 / 修改后是否需重启 / 示例值);按用途分组 (必填 / 数据库 / 认证 / 注册 / 时区 / 部署);对照源 `src/lib/env.ts` zod schema 确保变量数一致 (SC-008);加"哪些变量可暴露到 client (NEXT_PUBLIC_*)"小节,警告 `BETTER_AUTH_SECRET` 进 client bundle = 灾难;总字数 ≤ 600 (SC-004)
- [X] T002 [P] Create `docs/architecture.md`:3 章节 (1) Feature-Sliced 分层图 (UI → tRPC client → procedure → Domain → Drizzle → PG) 用 ASCII 文字图,不用 Mermaid (2) 关键目录用途表 (`src/app/` / `src/server/api/routers/` / `src/server/db/schema/` / `src/server/domain/` / `src/components/` / `src/lib/env.ts` 5+ 项) (3) 已交付 13 个 feature 列表 (001-auth-family ~ 013-simple-deploy,每个一行 = 编号 + 标题 + 关键交付) (4) "延伸阅读"链接到 `docs/AGENTS.md` / `DOMAIN.md` / `DATABASE.md` / `MVP.md` / `PRD.md` / `ROADMAP.md` 6 份既有文档 (相对路径 `./AGENTS.md` 等);总字数 ≤ 300 (SC-004)

**Checkpoint**: `docs/configuration.md` 与 `src/lib/env.ts` 变量数一致;`docs/architecture.md` 链接的 6 份既有文档全部存在 (`ls docs/AGENTS.md` 等)

---

## Phase 3: User Story 1 — 新开发者 30 分钟跑通 (Priority: P1) 🎯 MVP

**Goal**: 新开发者按 `docs/getting-started.md` 操作,30 分钟内本地 dev 跑起来

**Independent Test**: quickstart.md 场景 A (新开发者上手) 通过,SC-001 < 30 分钟

### Implementation for User Story 1

- [X] T003 [US1] Create `docs/getting-started.md`:7 章节 (1) 前置环境 (Node 22+ / pnpm 11+ / Docker 24+,每项含版本检查命令 `node --version` 等,版本不符时给 nvm / corepack 修复链接) (2) 安装依赖 `pnpm install` (含锁文件预期) (3) 配置环境变量 `cp .env.example .env` + 必填 `BETTER_AUTH_SECRET=$(openssl rand -base64 32)`,链 `docs/configuration.md` 详解 (4) 启动 Postgres `docker compose -f docker/docker-compose.yml up -d postgres`,含 `docker info` 检查 Docker Desktop 已启 (5) 跑迁移 `pnpm db:migrate` (6) 启动 dev `pnpm dev` + 验证 `curl http://localhost:3000/healthz` 返回 200 (7) 测试与质量 (`pnpm test` / `pnpm lint` / `pnpm tsc --noEmit` 用途与预期输出) (8) 常见首次启动失败 (≥ 5 项:端口占用 / DB 未启 / .env 缺失 / pnpm 版本 / Node 版本) (9) 下一步 (链接 architecture.md 理解代码 + 贡献流程);头部加 TOC 5-10 行;总字数 ≤ 1200 (SC-004)

**Checkpoint**: 一位未接触过仓库的开发者按文档跑,30 分钟内 `curl localhost:3000/healthz` 返回 200 (SC-001)

---

## Phase 4: User Story 2 — 运维者 15 分钟首次部署 (Priority: P1)

**Goal**: 运维者按 `docs/deployment.md` 选模式 + 部署,15 分钟内 HTTPS 访问到登录页

**Independent Test**: quickstart.md 场景 B (部署运维者) 通过,SC-002 < 15 分钟 + SC-003 5 项验证

### Implementation for User Story 2

- [X] T004 [US2] Create `docs/deployment.md`:5 章节 (1) 头部"选哪种模式?"4 问决策树表格 (目标?/部署位置?/公网 or 内网?/自动备份需求?→ 推荐 dev/simple/prod 三选一) (2) dev 模式章节 (适用场景反例 + 链 getting-started.md 不复制) (3) simple 模式章节 (5 步速览 + 链 `deploy/simple/README.md` (013) 不复制细节 + 首用户注册流程强调 ALLOW_REGISTRATION 注册完立即 false) (4) prod 模式章节 (标注 `> ⚠️ V2 待定,012-deploy-simplify 完成后补全`,链 `specs/012-deploy-simplify/spec.md` 规划 + `docker/docker-compose.prod.yml` 现状) (5) 部署后验证 checklist (5 项可执行:健康端点 curl / 迁移日志检查 / 注册关闭验证 / 备份可用 / 时区正确);头部加 TOC;总字数 ≤ 1500 (SC-004)

**Checkpoint**: 运维者按 simple 章节操作,15 分钟内 HTTPS 访问到登录页 (SC-002),5 项验证全过 (SC-003)

---

## Phase 5: User Story 3 — 已部署运维者日常运维 (Priority: P2)

**Goal**: 升级 / 备份 / 恢复 / 改配置 / 排障 各一条命令或一份表格定位

**Independent Test**: quickstart.md 场景 C (已部署运维者日常运维) 通过

### Implementation for User Story 3

- [X] T005 [US3] Create `docs/operations.md`:6 章节 (1) 升级 (含 `make simple-upgrade TAG=` 一键 + 手动三步 + 跨版本升级小节"相邻版本可直接升,跨 ≥ 2 个大版本需逐版本升" + 升级失败回滚步骤:改 tag + restore 备份) (2) 备份 (3 种方式:手动 pg_dump / make simple-backup / Synology Task Scheduler cron 示例,链 configuration.md 的 BACKUP_DIR 详解不复制) (3) 恢复 (`make simple-restore DATE=YYYY-MM-DD` + 备份完整性校验 `gunzip -t` + 警告"会覆盖当前数据") (4) 改配置 (env 修改 + 重启策略表,链 configuration.md) (5) 监控 (healthcheck 端点 + `docker compose logs` 常用命令) (6) 停服与卸载 (`make simple-down` 保留卷 vs `docker compose down -v` 清空数据,警告差异);头部 TOC;总字数 ≤ 1200 (SC-004)
- [X] T006 [US3] Create `docs/troubleshooting.md`:4 栏表格 (症状 / 原因 / 修复 / 验证) 覆盖 ≥ 15 个症状,分 5 类:(1) 启动 (端口占用 / DB 连不上 / 迁移失败 / 镜像拉取失败 / `no matching manifest` ARM) (2) 认证 (登录后立即登出 cookie 错位 / 注册 403 REGISTRATION_CLOSED / 第二个陌生人注册) (3) 数据 (Dashboard 月度漏算 时区错位 / 备份恢复失败 / 卷权限 999:999) (4) 网络 (反向代理 502 / Cloudflare Tunnel 断 / DNS 未生效) (5) 性能 (容器 OOM exit 137 / 日志爆盘 / PG 慢查询);每条症状下提供 1-2 行可复制诊断命令 (`docker compose logs` / `curl` / `psql`);头部 TOC;总字数 ≤ 1500 含表格 (SC-004 + SC-005 ≥ 15 症状)

**Checkpoint**: 升级 + 备份 + 恢复 三场景跑通;troubleshooting 表格 ≥ 15 行,任意症状 < 2 分钟定位修复

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: README 入口集成 + 跨文档质量校验

- [X] T007 Modify `README.md`:在项目标语 (`> 10 秒记账,每天坚持。`) 下方第一段加"## 按角色入口"章节,4 行表格 (角色 / 入口文档 / 你将学会 / 预计阅读时间),链接到 6 份新文档 (相对路径 `docs/getting-started.md` 等);4 角色覆盖:新开发者 / 部署运维者 / 已部署运维者 / 排障;移除 README 现有的"快速开始"章节 (内容已在 getting-started.md 详化,避免 DRY 违规)
- [X] T008 [P] 验证 SC-008 (env 对齐):跑 `diff <(grep -oE '^\s+[A-Z_]+:\s+z\.' src/lib/env.ts | awk -F: '{print $1}' | tr -d ' ' | sort -u) <(grep -oE '^\| \`[A-Z_]+\`' docs/configuration.md | sed 's/|`//g;s/`//g' | sort -u)`,期望无输出 (源码变量数 == 文档变量数);若有差异,补 `docs/configuration.md` 缺失变量或修正拼写
- [X] T009 [P] 验证 SC-007 (DRY):`grep -r "openssl rand -base64 32" docs/`、`grep -r "make simple-backup" docs/`、`grep -r "drizzle-kit migrate" docs/`,每个关键命令期望单一主源文档,其他文档仅链接;若发现复制,改为引用链接
- [X] T010 [P] 验证 SC-004 + SC-006 + SC-009 (字数 / TOC / 矩阵):(a) `wc -w docs/getting-started.md docs/deployment.md docs/operations.md docs/troubleshooting.md docs/configuration.md docs/architecture.md` 合计 ≤ 6000 字 (b) 人工点击每份文档 TOC 锚点全部跳转正确 (c) `grep -A 6 "按角色入口" README.md` 显示 4 行表格 + 6 文档链接无死链 (`ls docs/*.md` 对比)
- [ ] T011 Run `specs/014-ops-docs/quickstart.md` 4 场景端到端验证:**NEEDS_REAL_USER** — 场景 A (新开发者) + B (运维者) 需真实用户验证 SC-001 (< 30min) + SC-002 (< 15min) + SC-003 (5 项部署后验证);场景 C (日常运维) + D (质量交叉) 已通过 T008/T009/T010 自动化校验 (env 对齐 ✓ / DRY ✓ / 字数 2687<6000 ✓ / TOC 6/6 ✓ / 矩阵 4 行 ✓)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 空,无依赖
- **Phase 2 Foundational (T001-T002)**: 阻塞所有 US。T001 [P] + T002 [P] 可并行 (不同文件)
- **Phase 3 US1 (T003)**: 依赖 T001 (链 configuration.md) + T002 (链 architecture.md)
- **Phase 4 US2 (T004)**: 依赖 T001 (链 configuration.md 的 env 详解);与 US1 文件不同,可并行
- **Phase 5 US3 (T005-T006)**: 依赖 T001 (链 configuration.md);T005 [US3] 与 T006 [US3] 同 phase 不同文件可并行
- **Phase 6 Polish (T007-T011)**: T007 依赖所有 6 份文档完成;T008/T009/T010 [P] 可并行 (不同校验维度);T011 综合验证依赖所有

### User Story Dependencies

- **US1 (P1) 🎯 MVP**: 依赖 Phase 2 完成;独立可测 (SC-001 新开发者 < 30 分钟)
- **US2 (P1)**: 依赖 Phase 2 完成;与 US1 文件不冲突,可并行实施
- **US3 (P2)**: 依赖 Phase 2 完成;T005/T006 同 phase 内可并行
- **MVP 范围**: Phase 2 + US1 = 新开发者上手闭环 (4 任务 T001/T002/T003)

### Within Each User Story

- 文档头部 MUST 加 TOC (5-10 行,GitHub 自动锚点)
- 章节 MUST 与 TOC 一一对应
- 字数 MUST ≤ 预算 (research.md Q9)
- 跨文档引用 MUST 用相对路径 (`./configuration.md` / `../README.md`)

### Parallel Opportunities

- **Phase 2 内**:T001 (configuration.md) + T002 (architecture.md) 并行
- **Phase 3-5 跨 phase**:T003 (US1) + T004 (US2) + T005/T006 (US3) 不同文件,4 任务可并行 (但建议串行以保持文风一致)
- **Phase 6 内**:T008/T009/T010 三个校验任务可并行 (不同维度)

---

## Parallel Example: Phase 2 Foundational

```bash
# 两个叶子文档可并行 (不同文件,无依赖):
Task: T001 - "Create docs/configuration.md (env 主源,对照 src/lib/env.ts)"
Task: T002 - "Create docs/architecture.md (引用既有 docs/AGENTS.md 等 6 份)"
```

---

## Implementation Strategy

### MVP First (Phase 2 + US1)

1. 完成 Phase 2 Foundational (T001-T002) — 2 任务,叶子文档就绪
2. 完成 Phase 3 US1 (T003) — getting-started.md
3. **STOP and VALIDATE**: 找一位新开发者按文档操作,30 分钟内跑通 (SC-001)
4. 若通过,MVP 达成 (新开发者能上手);否则回到 T003 修订

### Incremental Delivery

1. Phase 2 Foundational → configuration.md + architecture.md 就绪
2. + Phase 3 US1 → 新开发者文档闭环
3. + Phase 4 US2 → 运维者部署闭环
4. + Phase 5 US3 → 升级/备份/排障闭环
5. + Phase 6 Polish → README 集成 + 质量校验 + 真实用户验证

### Parallel Team Strategy

单人顺序执行最稳:
- Phase 2 (T001-T002)
- Phase 3 (T003) → 验证
- Phase 4 (T004) → 验证
- Phase 5 (T005-T006) → 验证
- Phase 6 (T007-T011) → 综合验收

如双人:
- A: T001 + T003 + T005 (configuration + getting-started + operations)
- B: T002 + T004 + T006 (architecture + deployment + troubleshooting)
- 合流后一起做 Phase 6 校验

---

## Notes

- 所有任务 MUST 在 description 中包含确切文件路径
- 文档无单元测试,SC-001 ~ SC-010 是等价验收标准
- 验证任务 (T011) 引用 quickstart.md 场景,不重复列步骤
- US1/US2/US3 各自独立文档,无文件冲突,理论可并行 (但建议串行保持文风)
- README 矩阵 (T007) 是单一任务,在所有文档就绪后一次性加 4 行 (避免半状态)
- 字数预算 (research.md Q9):getting-started 1200 / deployment 1500 / operations 1200 / troubleshooting 1200 / configuration 600 / architecture 300 = 合计 6000 字
- troubleshooting.md 的 ≥ 15 症状是硬性要求 (SC-005),实施时人工数行
- env 对齐 (T008) 用 `diff <(grep src) <(grep docs)` 校验,无输出 = 通过
- DRY 校验 (T009) 用 `grep -r` 检查关键命令的重复出现,每命令期望单一主源
- 与 012/013 解耦:本 feature 只新增文档,不修改任何 .ts / .yml / .sh
- 与既有 docs/AGENTS.md 等 6 份文档解耦:只引用,不修改 (Assumptions)

---

## Scope Reduction (2026-07-08)

实施后用户评估"对个人/家庭记账应用来说文档偏多",选择方案 B:**只保留 troubleshooting.md + configuration.md**,删除其余 4 份。

### 删除清单

- ~~T002 `docs/architecture.md`~~ — 内容与 `docs/AGENTS.md` 50% 重叠,移除
- ~~T003 `docs/getting-started.md`~~ — 内容与 README + `deploy/simple/README.md` 70% 重叠,移除
- ~~T004 `docs/deployment.md`~~ — 内容与 `deploy/simple/README.md` 60% 重叠,移除
- ~~T005 `docs/operations.md`~~ — 升级/备份命令已在 `Makefile` target 注释 + `deploy/simple/README.md`,移除

### 保留清单

- T001 `docs/configuration.md` (env 主源,424 字)
- T006 `docs/troubleshooting.md` (21 症状 4 栏表,701 字)

### README 调整 (T007 重做)

- 移除"按角色入口"4 行表格
- 改为简化"## 文档"小节,列 2 份保留文档 + 指向 `deploy/simple/README.md` (部署) + `docs/AGENTS.md` (开发约定)

### 实际产出 (重算)

- 新增文档:**2 份** (原计划 6 份)
- 总字数:**1125 字** (原预算 6000 字,实际用 18.7%)
- README 改动:**简化为 2 文档列表** (原计划 4 角色矩阵)

### SC 重算

- SC-001/002/003 (用户上手时间):**作废** (无 getting-started / deployment 文档,无法量化)
- SC-004 (字数 ≤ 6000):**1125 字 ✓**
- SC-005 (troubleshooting ≥ 15 症状):**21 症状 ✓**
- SC-006 (TOC 锚点):**2/2 文档 ✓**
- SC-007 (DRY):**2 文档间无重复 ✓**
- SC-008 (env 对齐):**diff 无输出 ✓**
- SC-009 (角色矩阵):**作废** (改为简化文档列表)
- SC-010 (architecture 列 13 feature):**作废** (architecture.md 已删)

### 教训

- 个人项目不应照搬中型开源项目的文档体系 (YAGNI)
- spec 阶段若 SC 数量 > 10,大概率是过度规划
- 实施前应问"这份文档谁会读?多久读一次?"

