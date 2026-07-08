# Feature Specification: 简易部署 (simple-deploy)

**Feature Branch**: `013-simple-deploy`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "如果只处理 群晖或者docker 的简单部署呢"

## 背景与动机

012-deploy-simplify 聚焦"对外提供 HTTPS 服务的单 VM 生产部署",引入反向代理容器 (Caddy)、备份 sidecar、独立迁移容器,适合面向公网的生产场景。但对家用 NAS / 内网 / 个人评估场景来说,这一栈偏重:

- 大量家用场景不需要 Let's Encrypt (内网访问、Synology DSM 已自带反向代理 + 证书管理)
- 备份通常用 Synology Hyper Backup 或本地脚本,不希望容器栈带 sidecar
- 群晖用户偏好"一个 docker-compose 上传到 Container Manager,点开始"
- 个人开发者本地评估产品,不需要多容器编排

本 feature 提供**比 012 更轻的部署方案**,目标人群:

- Synology DSM 7.2+ 用户 (使用 Container Manager,DSM 内置反向代理 + Let's Encrypt)
- 家用服务器 / 小型 NAS / 树莓派 等"开机即用"场景
- 内网 / VPN / Cloudflare Tunnel 后端,源站 HTTP 即可
- 个人开发者本地评估

核心思路:**零外部依赖、一份 docker-compose、TLS / 备份由部署平台本身提供**。与 012 并存,运维者按场景选择。

## Clarifications

### Session 2026-07-08

- Q: 首次部署后如何安全地建立第一个家庭账户并防止陌生人注册? → A: 首个注册的用户自动成为家庭所有者 + 管理员;之后注册默认关闭,可通过 `ALLOW_REGISTRATION=true` 临时重开。
- Q: 容器时区与业务时间计算? → A: 镜像默认 `TZ=Asia/Shanghai`,运维者可在 `.env` 覆盖;数据库仍以 `timestamptz` 存 UTC,业务层 (Dashboard 月度汇总) 按容器 `TZ` 计算"本日/本月"。
- Q: Simple 与 Prod 迁移策略统一? → A: 保持双轨触发方式 (simple: entrypoint,prod: 独立 init 容器),但共享同一份 Drizzle Kit + SQL 迁移文件,避免逻辑分叉。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 群晖 Container Manager 一键部署 (Priority: P1)

Synology DSM 7.2+ 用户在 Container Manager 中导入 compose 文件 + `.env`,3 分钟内启动服务,通过 DSM 自带反向代理对外提供 HTTPS。

**Why this priority**: 群晖是国内家用 NAS 主流,Container Manager 在 DSM 7.2+ 是默认容器管理工具,这个场景覆盖大量真实自托管用户。

**Independent Test**: 在 DSM 7.2 环境 (或等效模拟) 中通过 Container Manager → 项目 → 新建 → 选择 compose 文件,3 分钟内 app 与 postgres 容器均显示"运行中",`http://<NAS-IP>:3000` 返回登录页。

**Acceptance Scenarios**:

1. **Given** 一台运行 DSM 7.2+ 的 Synology NAS (x86_64 机型,如 DS220+ / DS920+),**When** 用户在 File Station 上传 `docker-compose.simple.yml` 和 `.env` 到 `/volume1/docker/balthasar/`,在 Container Manager → 项目 → 新建 → 选择 compose 文件 → 启动,**Then** 3 分钟内 app 与 postgres 容器均显示"运行中",`http://<NAS-IP>:3000` 返回登录页。
2. **Given** 应用容器已启动,**When** 用户在 DSM 控制面板 → 登录门户 → 高级 → 反向代理中创建规则 (源: `https://balthasar.example.com:443` → 目标: `http://localhost:3000`),并在证书页配置 Let's Encrypt 证书,**Then** `https://balthasar.example.com` 返回登录页,浏览器证书有效。
3. **Given** 首次启动空数据库,**When** 应用容器启动,**Then** entrypoint 脚本先执行数据库迁移,迁移完成前 app 不监听 3000 端口,迁移完成后 app 开始响应。

---

### User Story 2 - 任意 Docker 一键启动 (Priority: P1)

任意支持 Docker Compose v2 的 Linux / macOS / Windows WSL2 环境,`docker compose up -d` 即可拉起服务,无需外部编排。

**Why this priority**: 与 US1 同等重要,覆盖非 Synology 用户 (家用 PC / VPS / 开发机 / 树莓派)。MVP "Docker 一键启动" 验收标准的最直接落地。

**Independent Test**: 在干净的 Ubuntu 22.04 / macOS / WSL2 上,`git clone` + `cp .env.simple.example .env` + `docker compose up -d`,3 分钟内访问 `http://localhost:3000`。

**Acceptance Scenarios**:

1. **Given** 一台装了 Docker 24+ 和 Compose v2+ 的主机 (Linux / macOS / Windows WSL2),**When** 用户克隆仓库,复制 `.env.simple.example` 为 `.env`,填写 `BETTER_AUTH_SECRET` (其他可选),执行 `docker compose -f deploy/simple/docker-compose.simple.yml up -d`,**Then** 3 分钟内 `http://localhost:3000` 返回登录页,数据库已迁移就绪。
2. **Given** 服务已启动,**When** 用户执行 `docker compose -f deploy/simple/docker-compose.simple.yml down`,**Then** 容器优雅停止,数据卷保留;再次 `up -d` 后数据无丢失。
3. **Given** 用户在内网 / VPN / Cloudflare Tunnel 后端场景下访问应用,**When** 用户直接通过 `http://<主机-IP>:3000` 访问,**Then** 应用正常运行,不强制 HTTPS,用户可自行选 Cloudflare Tunnel / Tailscale / SSH 隧道加密。

---

### User Story 3 - 升级与手动备份 (Priority: P2)

升级 = 改 tag + 重启;备份 = 一条命令;恢复 = 一条命令。无自动化 (与 012 区分,家用场景"够用就好")。

**Why this priority**: 比自动化备份更轻,但仍是必需。P2 因为低频但不可缺。

**Independent Test**: 模拟一次版本升级 + 一次手动备份 + 一次手动恢复,流程顺畅。

**Acceptance Scenarios**:

1. **Given** BALTHASAR 在 v0.1.0 运行,**When** 用户修改 `.env` 中 `DOCKER_TAG=0.2.0` 并执行 `docker compose pull && docker compose up -d`,**Then** 镜像拉取后应用自动迁移并重启,数据保留。
2. **Given** 用户想备份当前数据,**When** 执行 `docker compose exec -T postgres pg_dump -U balthasar balthasar | gzip > backup-$(date +%F).sql.gz`,**Then** 一个 `.sql.gz` 文件生成,体积 < 10 MB (1000 笔交易模拟)。
3. **Given** 用户想恢复备份,**When** 执行 `gunzip -c backup-2026-07-08.sql.gz | docker compose exec -T postgres psql -U balthasar balthasar`,**Then** 数据库恢复到备份时点状态,所有账单数据完整。

### Edge Cases

- DSM 7.1 及更早只支持 Docker package (无 Container Manager 项目功能):用户需 SSH 后用 `docker-compose` 命令行,或升级 DSM
- ARM 架构 NAS (DS218 / DS420j 等):CI 必须构建 arm64 镜像 + manifest list;否则 `docker pull` 报 `no matching manifest`
- Apple Silicon (M1/M2/M3):同上,需 arm64 支持
- 卷权限:DSM 用户 UID/GID 非默认 1000,容器内 postgres 用户读写可能失败。entrypoint 检测并提示
- 端口冲突 (3000 / 5432 被占用):compose 显式报错并提示修改 `APP_PORT` / `POSTGRES_PORT`
- 镜像拉取失败 (无 ghcr.io 访问 / 国内网络):报错并提示配置镜像加速器或本地 `docker build`
- 数据库版本升级 (Postgres 16 → 17):不在本 feature 范围,文档说明需手动 pg_dump/restore
- `BETTER_AUTH_URL` 与访问 URL 不一致:cookie 域错位,登录后立即登出。文档明确说明
- 同时启动多份 (端口冲突):compose 报错,不创建半状态
- 用户忘记设置 `BETTER_AUTH_SECRET` 直接启动:compose 用 `${VAR:?...}` 强制失败,提示生成命令
- DSM 反向代理配置错误 (漏掉 WebSocket、超时设错):README 提供检查清单
- 容器重启时迁移失败:entrypoint 退出非零,Docker `restart: unless-stopped` 触发重试,3 次失败后停止 (需手动看日志),日志显示错误 SQL
- 用户 `docker compose down -v` 误删卷:文档强调 `-v` 危险性,推荐用命名卷 + 备份
- 用户忘记将 `ALLOW_REGISTRATION` 改回 `false`:第二个陌生人可能注册,文档强调"注册完立即关闭"
- 已有用户后,管理员想再加一个家庭成员:临时设 `ALLOW_REGISTRATION=true` → 注册 → 改回 `false`,README 提供此操作流程
- 运维者后期修改 `TZ`:历史 `timestamptz` 列实际瞬时值不变,但 Dashboard "本月" 计算口径变化,可能出现"昨天那笔变成今天" — README 提醒首次部署前就定好 `TZ`,避免事后改

## Requirements *(mandatory)*

### Functional Requirements

#### 部署文件

- **FR-001**: 系统 MUST 提供一份独立的 `deploy/simple/docker-compose.simple.yml` 作为简易部署唯一入口,不再依赖 override 文件或多个变体。
- **FR-002**: 系统 MUST NOT 在简易部署 compose 中包含反向代理容器 (Caddy / Traefik / nginx);TLS 由部署平台 (DSM / Cloudflare Tunnel / 外部代理) 处理。
- **FR-003**: 系统 MUST NOT 在简易部署 compose 中包含备份 sidecar / cron 容器;备份通过外部命令或平台工具完成。
- **FR-004**: 系统 MUST 在仓库内提供 `deploy/simple/.env.simple.example`,列出所有必填与选填环境变量,附生成方式 (`openssl rand -base64 32` 等)。
- **FR-005**: 系统 MUST NOT 在 compose 文件、脚本中硬编码任何密码、密钥、域名、邮箱。

#### 镜像

- **FR-006**: 系统 MUST 在镜像 entrypoint 中执行数据库迁移,**迁移成功后才启动应用进程**;迁移失败则容器退出非零,Docker 重启策略触发重试。
- **FR-007**: 镜像 MUST 包含迁移工具与 SQL 文件,不依赖外部源码。
- **FR-008**: 系统 MUST 通过 CI 同时构建 `linux/amd64` 与 `linux/arm64` 镜像,通过 manifest list 自动合并,覆盖 Intel / AMD / Apple Silicon / 树莓派 / ARM NAS。

#### 部署流程

- **FR-009**: 系统 MUST 提供一份 step-by-step README,覆盖 Synology Container Manager 与通用 Docker Compose 两个场景。
- **FR-010**: README MUST 列出 DSM 反向代理 + Let's Encrypt 的具体配置步骤 (控制面板 → 登录门户 → 高级 → 反向代理 + 证书)。
- **FR-011**: README MUST 列出 Cloudflare Tunnel 的最小配置示例 (作为 Synology 之外的 HTTPS 选项)。
- **FR-012**: 系统 MUST 在 Makefile 提供 `simple-up` / `simple-down` / `simple-logs` / `simple-backup` / `simple-restore` 五个 target,封装常用运维操作。

#### 数据库与卷

- **FR-013**: 系统 MUST 使用命名卷 (`balthasar_pg_data_simple`) 而非匿名卷,便于 Synology 用户在 File Station 中定位数据目录。
- **FR-014**: 系统 MUST NOT 默认将 Postgres 端口暴露到 `0.0.0.0`;默认绑 `127.0.0.1:5432`,只在用户显式配置 `POSTGRES_EXTERNAL=true` 时放开到 `0.0.0.0`。
- **FR-015**: 系统 MUST 在 PostgreSQL 数据卷损坏时,通过文档说明恢复路径 (从备份 `.sql.gz` 恢复),不承诺卷级别自愈。

#### 资源治理

- **FR-016**: 所有容器 MUST 配置 `restart: unless-stopped` (而非 `always`),允许用户主动停止且宿主重启时不自动拉起 (符合家用场景预期)。
- **FR-017**: 系统 MUST 为容器配置日志轮转,json-file 驱动,单文件 ≤ 10MB,保留 ≤ 3 个文件 (轻量场景比生产更紧凑)。
- **FR-018**: 系统 MUST 为应用与数据库容器配置内存上限,默认 app ≤ 512MB / postgres ≤ 512MB,用户可在 `.env` 中调整。
- **FR-019**: 系统 MUST NOT 强制 CPU 限制 (家用场景下多容器共存时,硬 CPU 限制可能反而不合理)。

#### 升级与备份

- **FR-020**: 升级流程 MUST 通过修改 `.env` 中 `DOCKER_TAG` + `docker compose pull` + `docker compose up -d` 三步完成,无需手动跑迁移命令 (entrypoint 自动跑)。
- **FR-021**: 备份 MUST 通过单条命令完成 (`docker compose exec -T postgres pg_dump -U <user> <db> | gzip > backup.sql.gz`),README 与 Makefile `simple-backup` 提供完整命令。
- **FR-022**: 恢复 MUST 通过单条命令完成 (`gunzip -c <file> | docker compose exec -T postgres psql -U <user> <db>`),README 与 Makefile `simple-restore` 提供完整命令。
- **FR-023**: 系统 MUST NOT 提供自动化定时备份 (与 012 区分);定时备份由 Synology Task Scheduler / cron / systemd timer 外部完成。
- **FR-031**: 系统 MUST 通过镜像 entrypoint 自动触发数据库迁移 (迁移成功后才启动应用进程),与 012-deploy-simplify 的"独立 init 容器触发"机制并存;二者**共享同一份 Drizzle Kit + SQL 迁移文件**,禁止逻辑分叉。

#### 账户与注册

- **FR-024**: 系统 MUST 在用户表为空时允许注册,首个注册的用户 MUST 自动被标记为家庭所有者 (Family owner) 并获得管理员权限。
- **FR-025**: 系统 MUST 在用户表非空时默认拒绝新注册请求 (返回 403 或重定向到登录页并显示"已关闭注册"提示),除非运维者显式将 `ALLOW_REGISTRATION=true` 写入环境变量临时重开。
- **FR-026**: 系统 MUST NOT 在注册关闭时暴露注册端点的存在性 (登录页不显示"注册"链接,访问 `/sign-up` 返回 404 或 403)。
- **FR-027**: 系统 MUST 在 `.env.simple.example` 中说明首次部署流程:先设 `ALLOW_REGISTRATION=true` 启动 → 浏览器注册第一个账号 → 改回 `false` (或删除变量) 后 `docker compose up -d` 重启,提示"忘记关闭 = 任何人都能注册"。

#### 时区

- **FR-028**: 镜像 MUST 默认设置 `TZ=Asia/Shanghai` 环境变量,使容器内 `new Date()` / `Date.now()` / 数据库客户端 `timestamptz` → `Date` 转换按上海时区计算;运维者可通过 `.env` 中 `TZ=<IANA 时区>` 覆盖。
- **FR-029**: 数据库列 MUST 使用 `timestamp with time zone` (PostgreSQL `timestamptz`) 存储 UTC 实际瞬时值,业务展示层 (Dashboard 月度汇总、交易列表"今天/昨天"标签) MUST 按容器 `TZ` 转换显示。
- **FR-030**: 系统 MUST 在 `.env.simple.example` 中给出 `TZ` 变量示例 (默认 `Asia/Shanghai`,提示海外用户改为 `America/Los_Angeles` 等 IANA 名称)。

### Key Entities

- **简易部署目录 (`deploy/simple/`)**: 仓库内集中存放 `docker-compose.simple.yml`、`.env.simple.example`、Synology 专用 README。
- **环境配置 (`.env`)**: 运维者本地维护,不入版本控制;`BETTER_AUTH_SECRET` 与 `BETTER_AUTH_URL` 为必填,`POSTGRES_*` 提供合理默认。
- **PostgreSQL 数据卷**: 命名卷 `balthasar_pg_data_simple`,挂载到 Docker 数据根 (Synology 通常是 `/volume1/docker/volumes/`)。
- **迁移产物 (`migrations/`)**: 打入镜像内部,通过 entrypoint 在 app 启动前自动执行。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在一台干净的 Synology NAS (DSM 7.2+, x86_64) 上,从克隆仓库到 Container Manager 显示"运行中",**总耗时 < 5 分钟** (前提: 镜像已拉取或预构建好)。
- **SC-002**: 在一台干净的 Ubuntu 22.04 上,从 git clone 到 `docker compose up -d` 完成、`curl localhost:3000` 返回 200,**总耗时 < 3 分钟** (前提: 镜像已拉取)。
- **SC-003**: 配合 DSM 反向代理后,`https://<域名>` 返回登录页,**证书有效且无需任何手工证书操作**。
- **SC-004**: 首次启动到数据库迁移完成,**应用容器在 60 秒内开始监听 3000 端口**。
- **SC-005**: 模拟 1000 笔交易后,**手动 `pg_dump + gzip` 备份体积 < 10 MB**。
- **SC-006**: 仓库内简易部署目录 (`deploy/simple/`) 的**总配置行数 < 150 行** (compose + `.env.simple.example` + README 中纯配置部分),相比 012 减少 ≥ 50%。
- **SC-007**: 简易部署镜像 MUST 支持 `linux/amd64` 与 `linux/arm64` 双架构,Apple Silicon / 树莓派 4 / Intel NUC / ARM NAS 均能直接 `docker pull` 不出现 `no matching manifest` 错误。
- **SC-008**: 升级到新版本 (修改 tag + pull + up),**应用停机时间 < 60 秒** (略高于 012 的 30 秒,因简易部署无零停机机制)。
- **SC-009**: README 简易部署章节**总字数 < 1500 字**,运维者按章节操作 30 分钟内能完成首次部署 + DSM 反向代理 + 证书配置。
- **SC-010**: 部署后用户表为空时,`POST /api/auth/sign-up-email` 返回 200~299;用户表非空且未设 `ALLOW_REGISTRATION=true` 时,同一端点返回 4xx 且**不创建新行**,登录页**不显示注册链接**。
- **SC-011**: 部署后未设 `TZ` 时,上海时间 8 月 1 日 00:30 创建一笔交易,**Dashboard "本月" 汇总立即包含此交易** (证明 `TZ=Asia/Shanghai` 默认生效,未走 UTC 漏算到上月)。

## Assumptions

- 群晖 DSM 7.2+ 提供 Container Manager (项目功能,等价于 docker-compose)。DSM 7.1 及更早用户需 SSH 后用命令行,体验略降级但不在范围外。
- x86_64 与 arm64 是仅有的两个目标架构;riscv64 / s390x 等不在范围。
- 镜像仍由 `.github/workflows/deploy.yml` 构建,但 CI 需扩展为多架构 (buildx + manifest list)。
- TLS / 反向代理 / 自动备份 / SMTP 告警均不在简易部署范围内,由部署平台提供:
  - Synology 用户:DSM 反向代理 + Let's Encrypt + Hyper Backup
  - 通用 Docker 用户:可选 Cloudflare Tunnel / Tailscale / 自建反向代理
- **与 012-deploy-simplify 的关系**: 两者并存,运维者按场景选择:
  - **简易部署** (本 feature):面向"我只想在家用 NAS / 内网跑一份",零编排负担,entrypoint 自动迁移
  - **生产部署** (012):面向"我要对外提供 HTTPS 服务",Caddy + 备份 sidecar + 多 override,独立 init 容器做迁移 (失败隔离)
  - **共享底座**: 二者使用同一份 Drizzle Kit + SQL 迁移文件 + 同一 GHCR 镜像,只是触发迁移的方式不同 (entrypoint vs init 容器)
- 数据库版本升级 (PostgreSQL major 升级) 不在本 feature 范围;文档说明需手动导出/导入。
- 现有 `docker/docker-compose.yml` (本地开发) 与 `docker/docker-compose.prod.yml` (012 生产) 在本 feature 完成后**保留**;新增 `deploy/simple/docker-compose.simple.yml` 作为第三个变体,服务于明确不同的场景。
- 镜像内 entrypoint 同时支持"先迁移再启动"和"仅迁移不启动"两种模式,后者供 CI 验证用。
- 反向代理配置 (DSM Reverse Proxy / Cloudflare Tunnel) 的具体步骤作为 README 内容,不在 compose 文件中,避免与平台耦合。
- 备份文件命名 `backup-YYYY-MM-DD.sql.gz` 由运维者管理;简易部署不提供自动轮转 (与 012 区分)。
- `BETTER_AUTH_URL` 必须与运维者实际访问的 URL (含协议) 一致;HTTP 部署时 cookie `Secure` flag 不设,HTTPS 部署时由 Better-Auth 自动处理。
