# Feature Specification: 运维文档 (ops-docs)

**Feature Branch**: `014-ops-docs`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "编写下启动指南和部署指南"

## 背景与动机

仓库现有文档分散且不完整:

- `README.md` — 项目总览,粗略的本地 dev 启动 5 步,**未覆盖**测试 / lint / 类型检查 / 容器化开发工作流
- `deploy/simple/README.md` (013) — 简易部署场景文档,**941 字** 仅覆盖 Synology + 通用 Docker 启动
- `docker/docker-compose.yml` (本地开发) / `docker/docker-compose.prod.yml` (012 生产,未完成) / `deploy/simple/docker-compose.simple.yml` (NAS 部署) — 三份 compose,**无选型决策树**
- `docs/AGENTS.md` / `docs/DATABASE.md` / `docs/DOMAIN.md` / `docs/MVP.md` / `docs/PRD.md` / `docs/ROADMAP.md` — 给开发者的内部参考,**未与运维工作流衔接**
- 升级 / 回滚 / 备份 / 恢复 / 排障 — 散落在各 README,无统一入口

新开发者 clone 仓库后,平均需要 30+ 分钟才能跑通本地 dev;新运维者需要在 3 份 compose + 多份 README 之间来回对比才能选对部署模式;故障排查只能靠 GitHub Issues 翻历史。

本 feature **不引入任何代码变更**,只产出**统一、可导航、面向用户角色**的文档体系。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 新开发者 30 分钟内跑通本地 dev (Priority: P1) 🎯 MVP

新贡献者 (想给 BALTHASAR 提 PR / 学习代码 / 评估产品) clone 仓库后,30 分钟内本地 `http://localhost:3000` 出现登录页,能跑测试、能跑 lint、能跑类型检查。

**Why this priority**: 开源项目的留存率取决于"首跑体验"。当前文档不完整 → 新人放弃率高。比 US2 优先,因为没开发者就没产品。

**Independent Test**: 找一位**未接触过本仓库**的开发者按文档操作,30 分钟内本地 `curl localhost:3000/healthz` 返回 200,且 `pnpm test` 至少一次全绿。

**Acceptance Scenarios**:

1. **Given** 一台装了 Node 22+ / pnpm 11+ / Docker 24+ 的开发者机器 (任一 OS),**When** 开发者 clone 仓库后跟随"启动指南"操作 (无外部搜索),**Then** 30 分钟内 `pnpm dev` 启动,`http://localhost:3000` 返回登录页,数据库已迁移。
2. **Given** 开发者已跑通 dev,**When** 跟随"测试与质量"章节执行 `pnpm test` / `pnpm lint` / `pnpm tsc --noEmit`,**Then** 全部命令的用途、预期输出、失败时的常见原因都有文档说明,无需读源码即可理解。
3. **Given** 开发者想理解代码结构,**When** 打开"架构导览"章节,**Then** 看到 feature-sliced 分层图 + 关键目录用途 + 入口文件指针 (server.ts / root.ts / config.ts),能在 5 分钟内定位任意功能的代码位置。
4. **Given** 开发者想贡献代码,**When** 跟随"贡献流程"章节,**Then** 看到 fork → branch → commit → PR 的标准流程,以及宪章原则四 (Test-First) 对 PR 的硬性要求 (没测试 = 拒绝)。

---

### User Story 2 - 运维者 15 分钟内首次部署成功 (Priority: P1)

自托管用户 (家用 NAS / VPS / 内网) 想部署 BALTHASAR。看完文档 5 分钟内选对部署模式,10 分钟内启动 + 配置反代,15 分钟内浏览器访问到登录页。

**Why this priority**: 与 US1 同等重要,覆盖另一半用户群 (使用者而非开发者)。

**Independent Test**: 找一位**未部署过本仓库**的运维者按文档操作,15 分钟内通过浏览器访问到 HTTPS 登录页 (含有效证书)。

**Acceptance Scenarios**:

1. **Given** 一位想部署 BALTHASAR 的运维者 (家用 NAS / VPS / 内网任一场景),**When** 打开"部署指南"首页,**Then** 看到 3 种部署模式的**决策树** (基于:目标 / 资源 / 公网 or 内网 / 是否需自动备份),5 分钟内能选出适合的模式。
2. **Given** 运维者选定模式 (例:Synology NAS),**When** 跟随对应章节操作,**Then** 10 分钟内 `docker compose ps` 显示 healthy,15 分钟内浏览器 HTTPS 访问到登录页 (证书有效)。
3. **Given** 运维者部署完成,**When** 想做"部署后验证",**Then** 文档提供 5 项 checklist (健康端点 / 迁移成功 / 注册关闭 / 备份可用 / 时区正确),每项有可执行的 curl 或 UI 步骤。
4. **Given** 运维者遇到问题 (端口冲突 / 镜像拉取失败 / 卷权限 / cookie 错位),**When** 查"故障排查"章节,**Then** 找到症状 → 原因 → 修复三栏对照表,无需翻 GitHub Issues。

---

### User Story 3 - 已部署运维者完成日常运维 (Priority: P2)

已成功部署的运维者想升级版本 / 备份数据 / 恢复历史备份 / 改配置。文档提供一键命令 + 风险提示。

**Why this priority**: 低频但不可缺。比 US1/US2 低,因为只在已部署后才需要。

**Independent Test**: 模拟一次版本升级 + 一次备份 + 一次恢复,流程顺畅无歧义。

**Acceptance Scenarios**:

1. **Given** BALTHASAR 在 v0.1.0 运行,**When** 运维者按"升级"章节操作 (改 tag → pull → up),**Then** 升级完成 ≤ 60 秒停机,数据保留,新功能可见。
2. **Given** 运维者想备份,**When** 按"备份与恢复"章节复制一条命令执行,**Then** 备份文件生成,体积合理 (< 10 MB / 1000 笔交易),`gunzip -t` 校验通过。
3. **Given** 运维者想恢复昨天的备份,**When** 按章节复制 `restore` 命令,**Then** 数据库回到备份时点状态,无需手动跑 SQL。
4. **Given** 运维者想改配置 (例:换时区 / 临时开注册 / 加内存限制),**When** 查"配置参考"章节,**Then** 看到完整 env 变量列表 + 每项的影响 + 修改后是否需重启,无未文档化的"魔法变量"。

### Edge Cases

- 新开发者的 Node 版本不对 (用 18 而非 22):启动指南必须含版本检查步骤,提示用 `nvm use`
- 新开发者的 pnpm 版本不对 (用 10 而非 11):同上,提示 `corepack enable`
- 新开发者的 Docker Desktop 没启动:启动指南的 "dev via compose" 章节必须含 `docker info` 检查
- 运维者选错部署模式 (例:家用场景却选了 prod 模式,引入 Caddy 复杂度):决策树必须给出"如果你 X → 选 Y"的硬性指引
- 运维者域名 DNS 未生效就启动:故障排查表含"等 DNS + 重启反代"
- 运维者忘记 `ALLOW_REGISTRATION=false`:故障排查表含"陌生人注册"症状
- 升级时迁移失败:升级章节含回滚步骤 (改回旧 tag + restore 备份)
- 备份文件被部分覆盖 (运维者中途 Ctrl+C):恢复章节含 `gunzip -t` 完整性校验
- 时区配置事后改:`配置参考` 警告"历史数据 timestamptz 不变,但 Dashboard 月度口径变化"
- 跨大版本升级 (v0.1 → v0.5):升级章节含"逐版本升级"建议,不跳级
- 新开发者 Windows 路径反斜杠导致 Makefile 失败:启动指南注明 Windows 用户用 WSL2
- 运维者 ARM NAS 拉到 amd64 镜像 (manifest 缺失):故障排查表含"等 CI 多架构构建完成或自建"

## Requirements *(mandatory)*

### Functional Requirements

#### 文档结构

- **FR-001**: 系统 MUST 在仓库根 `docs/` 目录下提供以下统一文档:
  - `docs/getting-started.md` (启动指南,面向新开发者)
  - `docs/deployment.md` (部署指南,面向运维者)
  - `docs/operations.md` (运维手册,面向已部署运维者)
  - `docs/troubleshooting.md` (故障排查,跨角色)
  - `docs/configuration.md` (环境变量与配置参考)
  - `docs/architecture.md` (架构导览,跨角色)
- **FR-002**: `README.md` MUST 在头部加章节链接,把上述 6 份文档作为"按角色入口"列出 (开发者 / 运维者 / 已部署运维者 / 排障)。
- **FR-003**: 系统 MUST NOT 在多份文档中重复同一信息 (DRY);若信息属于多份文档共用,**架构导览**章节是单一来源,其他文档引用。
- **FR-004**: 每份文档 MUST 在头部加目录 (TOC),每节带锚点链接。

#### 启动指南 (getting-started.md)

- **FR-005**: 启动指南 MUST 覆盖以下章节:(1) 前置环境检查 (Node/pnpm/Docker 版本与检查命令) (2) 安装依赖 (`pnpm install`) (3) 配置环境变量 (`.env` 模板与必填项) (4) 启动 Postgres (本地 docker 或 `docker compose -f docker/docker-compose.yml up -d postgres`) (5) 跑迁移 (`pnpm db:migrate`) (6) 启动 dev (`pnpm dev`) (7) 验证 (`curl localhost:3000/healthz`)。
- **FR-006**: 启动指南 MUST 在前置环境章节列出每项工具的版本检查命令 (例:`node --version` 必须显示 v22+) 与版本不符时的修复链接 (nvm / corepack)。
- **FR-007**: 启动指南 MUST 包含"常见首次启动失败"小节,列出 ≥ 5 个症状 → 原因 → 修复 (例:端口占用 / DB 未启 / .env 缺失 / pnpm 版本错 / Node 版本错)。
- **FR-008**: 启动指南 MUST 含"下一步"链接,指向架构导览 / 测试与质量 / 贡献流程。

#### 部署指南 (deployment.md)

- **FR-009**: 部署指南 MUST 在头部提供**模式选型决策树**,基于 4 个问题 (公网 or 内网 / 单机 or 多机 / 自动备份 or 手动 / Synology or 通用 Linux) 给出唯一推荐模式 (dev / simple / prod 三选一)。
- **FR-010**: 部署指南 MUST 为每种模式提供独立章节,每章节包含:(1) 适用场景与不适用的反例 (2) 前置条件 (3) 配置步骤 (链接到对应 compose/.env) (4) 验证 checklist (5) 下一步 (链接到运维手册或启动指南)。
- **FR-011**: 部署指南 MUST 在每个模式的"配置步骤"中,把"首用户注册流程"明确为子步骤 (设 `ALLOW_REGISTRATION=true` → 注册 → 改回 `false`),并强调"忘记关闭 = 公网任何人都能注册"。
- **FR-012**: 部署指南 MUST 链接到 `deploy/simple/README.md` (013) 与 `docker/docker-compose.prod.yml` (012) 而不复制其内容 (DRY)。
- **FR-013**: 部署指南 MUST 提供统一的"部署后验证 checklist",共 ≥ 5 项可执行步骤 (健康端点 / 迁移完成 / 注册关闭 / 备份可用 / 时区正确)。

#### 运维手册 (operations.md)

- **FR-014**: 运维手册 MUST 覆盖以下章节:(1) 升级 (含 `make simple-upgrade TAG=` 与手动流程) (2) 备份 (一条命令 + 文件命名规则) (3) 恢复 (一条命令 + 警告覆盖) (4) 改配置 (env 修改 + 重启策略) (5) 监控 (healthcheck + 日志) (6) 停服与卸载 (保留数据 vs 清空)。
- **FR-015**: 升级章节 MUST 含"跨版本升级"小节,说明 (a) 相邻版本可直接升 (b) 跨 ≥ 2 个大版本需逐版本升 (c) 升级失败回滚步骤 (改 tag + restore 备份)。
- **FR-016**: 备份章节 MUST 提供 3 种备份方式:(a) 手动 `pg_dump` 命令 (b) `make simple-backup` (c) Synology Task Scheduler / cron 定时任务示例。
- **FR-017**: 恢复章节 MUST 含"备份完整性校验"步骤 (`gunzip -t`),失败时拒绝继续。

#### 故障排查 (troubleshooting.md)

- **FR-018**: 故障排查 MUST 用**症状 → 原因 → 修复 → 验证**四栏表格组织,覆盖 ≥ 15 个常见症状,包括但不限于:
  - 启动相关 (端口占用 / DB 连不上 / 迁移失败 / 镜像拉取失败 / `no matching manifest`)
  - 认证相关 (登录后立即登出 / 注册 403 / cookie 错位 / 第二个陌生人注册)
  - 数据相关 (Dashboard 月度漏算 / 时区错位 / 备份恢复失败 / 卷权限)
  - 网络相关 (反向代理 502 / Cloudflare Tunnel 断 / DNS 未生效)
  - 性能相关 (容器 OOM / 日志爆盘 / PG 慢查询)
- **FR-019**: 故障排查 MUST 在每条症状下提供 1-2 行可复制的诊断命令 (`docker compose logs` / `curl` / `psql`),不仅描述修复。

#### 配置参考 (configuration.md)

- **FR-020**: 配置参考 MUST 列出**所有**环境变量 (dev + simple + prod + CI),按用途分组 (必填 / 数据库 / 认证 / 注册 / 时区 / 部署 / CI),每项含:(a) 变量名 (b) 类型与默认值 (c) 影响范围 (d) 修改后是否需重启 (e) 示例值。
- **FR-021**: 配置参考 MUST 标注哪些变量是**安全暴露到客户端** (`NEXT_PUBLIC_*` 前缀) vs 仅服务端,错误暴露的后果 (例:`BETTER_AUTH_SECRET` 进 client bundle = 灾难)。

#### 架构导览 (architecture.md)

- **FR-022**: 架构导览 MUST 包含:(a) Feature-Sliced 分层图 (UI / tRPC / Domain / Drizzle / PG) (b) 关键目录用途表 (`src/app/` / `src/server/api/routers/` / `src/server/db/schema/` 等) (c) 入口文件指针 (`src/server/auth/config.ts` / `src/server/api/root.ts` / `src/lib/env.ts`) (d) 数据流图 (浏览器 → tRPC client → procedure → Drizzle → PG)。
- **FR-023**: 架构导览 MUST 链接到 `docs/AGENTS.md` / `docs/DOMAIN.md` / `docs/DATABASE.md` 而不复制内容。
- **FR-024**: 架构导览 MUST 列出已交付的 11 个 feature (001~011 + 013),每个一行 (feature 编号 + 标题 + 关键交付),不展开。

### Key Entities *(include if feature involves data)*

- **文档目录 (`docs/`)**: 仓库内既有目录,本 feature 新增 6 份 markdown
- **角色入口矩阵** (`README.md` 顶部): 4 个角色 (开发者 / 运维者 / 已部署运维者 / 排障) × 对应文档链接
- **跨文档锚点**: 每份文档头部 TOC + 章节锚点,允许外部链接直接跳到具体小节

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 一位**未接触过本仓库**的开发者,从 `git clone` 到 `curl localhost:3000/healthz` 返回 200,**总耗时 < 30 分钟** (含依赖安装与迁移)。
- **SC-002**: 一位**未部署过本仓库**的运维者,从读 `docs/deployment.md` 到浏览器 HTTPS 访问到登录页,**总耗时 < 15 分钟** (前提:DNS 已生效、镜像已就绪)。
- **SC-003**: 部署后 5 项验证 checklist (健康 / 迁移 / 注册关闭 / 备份 / 时区) 全部通过。
- **SC-004**: `docs/` 目录下 6 份新文档**总字数 ≤ 6000 字** (含 TOC 与表格),平均每份 ≤ 1000 字,避免冗长。
- **SC-005**: `docs/troubleshooting.md` 覆盖 ≥ 15 个症状,每条症状可在 < 2 分钟内定位修复。
- **SC-006**: 每份文档头部 TOC 完整,任意章节可通过锚点直达 (例:`docs/operations.md#跨版本升级`)。
- **SC-007**: 仓库内**不存在同一信息重复出现在多份文档**的情况 (DRY 检查:对每个事实,如"如何备份",只能有 1 份主源文档,其他都是引用链接)。
- **SC-008**: `docs/configuration.md` 列出的环境变量数 = `src/lib/env.ts` 中 zod schema 定义的变量数 (含 013 新增的 ALLOW_REGISTRATION / TZ / BALTHASAR_ENTRYPOINT_MODE / POSTGRES_HOST / NEXT_PUBLIC_ALLOW_REGISTRATION),无遗漏。
- **SC-009**: `README.md` 顶部的"按角色入口"矩阵覆盖 4 个角色,每个角色链接到对应文档,无死链。
- **SC-010**: `docs/architecture.md` 的 feature 列表覆盖已实施的 11 个 feature (001~011 + 013),与 `specs/` 目录一一对应。

## Assumptions

- 文档主要语言为**中文** (与 constitution v2.0.0 + 现有 README/部署文档一致)。
- 文档面向**已熟悉基本 Linux/前端工具链**的用户,不解释 `git clone` / `pnpm install` 的语义。
- 不引入新的静态站点生成器 (Docusaurus / MkDocs 等),纯 GitHub Markdown 渲染 (YAGNI)。
- 不写 PDF / EPUB 导出,只服务在线浏览 (YAGNI)。
- 与 `docs/AGENTS.md` / `docs/DOMAIN.md` / `docs/DATABASE.md` / `docs/MVP.md` / `docs/PRD.md` / `docs/ROADMAP.md` 共存,本 feature 不修改这 6 份既有文档 (它们是给开发者看的产品/架构规约,本 feature 是面向用户角色的操作指南)。
- 不引入截图 (会过期 + 仓库体积膨胀),用文字描述 UI 步骤 + curl 命令验证。
- 不写视频教程 / 中文社区运营文档,这些是 V2 范围。
- 012-deploy-simplify (生产部署) 仍未完成实施,部署指南的 prod 章节标注 "V2 待定",不展开细节。
- 跨平台脚本示例默认 Linux/macOS;Windows 用户用 WSL2 (README 一句话提醒,不重复展开)。
- 链接到外部资源 (Better-Auth 文档 / Drizzle 文档 / Docker 文档 / Synology 帮助) 优先用官方文档锚点,不复制其内容。
- 测试场景由本 feature 自身定义 (上述 SC),不依赖 quickstart.md (那是 013 的产物)。
