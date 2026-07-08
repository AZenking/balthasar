# Feature Specification: 部署精简 (deploy-simplify)

**Feature Branch**: `012-deploy-simplify`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "参考业界规范；我的整体部署需要调整；最好能够精简"

## 背景与动机

当前部署体系经过 011-open-api 周边迭代已积累 3 份 compose 变体 (`docker-compose.yml` 本地构建 / `docker-compose.prod.yml` 拉镜像无代理 / 讨论中的 `compose.direct.yml` 直暴 80),并暴露了 6 类问题:

1. 生产 compose 期待反向代理但未给出接入方式,运维者直接 `up` 后访问不到应用
2. 镜像不包含迁移机制,首次启动空数据库时 app 500
3. 无备份策略,卷毁即数据全丢
4. Postgres 默认映射宿主 5432,本地开发也对外暴露
5. 三份 compose 文件互相重复 60%+ 配置,长期维护时易漂移
6. 资源未限制、日志未轮转、容器名硬编码

本 feature 目标:以业界自托管单 VM 部署规范 (Twelve-Factor App + Docker compose + 反向代理自动 TLS) 为基准,**合并三份 compose 为一份 + 一份 override**,**补齐迁移/备份/健康检查/资源治理**,使一台干净的 Linux VM 在运维者克隆仓库后,5 分钟内能拉起一个对外可服务的 HTTPS 实例。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 运维者一键部署 (Priority: P1)

运维者 (自托管用户) 在一台干净的 Linux VM 上,克隆仓库、填好 `.env`,执行一条命令,5 分钟内浏览器访问 `https://<域名>` 出现登录页且证书自动签发。

**Why this priority**: 用户的核心场景。没有这个,后续 story 都无意义。是宪章 "MVP Docker 一键启动" 验收标准在生产语境下的真正落地。

**Independent Test**: 在干净的 Ubuntu 22.04 VM (已装 docker + compose) 上执行 README 中的部署命令,5 分钟内 `curl -I https://<域名>` 返回 200 + 证书有效。

**Acceptance Scenarios**:

1. **Given** 一台装了 Docker 24+ 和 Compose v2+ 的 Linux VM,**When** 运维者克隆仓库、填写 `.env` (域名、密钥、Postgres 密码) 后执行部署命令,**Then** 5 分钟内 `https://<域名>` 返回登录页,证书有效。
2. **Given** 首次启动空数据库,**When** 容器编排启动,**Then** 数据库迁移作为独立步骤先于应用启动执行;迁移完成前 app 容器等待,迁移完成后 app 容器才进入 healthy。
3. **Given** 部署完成后执行 `docker compose ps`,**When** 运维者查看服务状态,**Then** 所有服务显示 `healthy`,无 `unhealthy` 或 `restarting`。
4. **Given** DNS 尚未生效就执行部署,**When** 反向代理启动,**Then** 容器持续重试,90 秒内 DNS 生效后自动获取证书,无需人工干预。

---

### User Story 2 - 运维者升级回滚 (Priority: P2)

运维者升级到新版本时,一条命令完成;迁移失败时,日志清晰指出问题且应用不启动。

**Why this priority**: 升级是日常运维。出问题时如果不能快速恢复或日志不清,运维者会失去信心。比 P1 低一档,因为不影响首次部署。

**Independent Test**: 模拟一次版本升级 (拉新镜像 + 跑迁移 + 重启),应用 30 秒内重启完成,数据保留;再模拟一次迁移失败,日志中能定位到具体失败的 SQL 语句。

**Acceptance Scenarios**:

1. **Given** BALTHASAR 在 v0.1.0 正常运行,**When** 运维者修改 `.env` 中的版本 tag 并执行升级命令,**Then** 应用停机时间 < 30 秒,数据完整,UI 显示新版本号。
2. **Given** 升级过程中迁移失败 (如新增字段与现有数据冲突),**When** 运维者查看迁移容器日志,**Then** 错误信息包含失败 SQL、错误码、影响的表,app 容器未启动 (避免新代码跑在旧 schema 上)。
3. **Given** 升级后发现新版本有 bug,**When** 运维者改回旧 tag 并重启,**Then** 5 分钟内恢复旧行为,数据保持升级后的状态 (向后兼容)。

---

### User Story 3 - 运维者备份恢复 (Priority: P3)

运维者每天自动备份,需要时一键恢复到指定日期。

**Why this priority**: 数据是账本,丢失不可逆。但个人/家庭场景下备份触发频率极低,自动化即可,P3。

**Independent Test**: 触发一次手动备份 → 删除若干交易 → 恢复昨日备份 → 被删交易重新出现。

**Acceptance Scenarios**:

1. **Given** BALTHASAR 正常运行,**When** 每天 03:00 (宿主时区) 自动执行备份,**Then** 备份文件按 `YYYY-MM-DD.sql.gz` 命名,体积 < 10MB (按 1000 笔交易模拟),保留最近 30 天,过期自动删除。
2. **Given** 运维者误删数据,**When** 执行恢复命令指定日期 `2026-07-08`,**Then** 数据库恢复到当天备份的状态,所有账单数据完整,应用无需重启即可访问恢复后的数据。
3. **Given** 部署机磁盘故障,**When** 运维者从异地拷回一份备份文件 + 在新 VM 上执行部署命令,**Then** 全新 VM 上恢复出原数据,可立即对外服务。

### Edge Cases

- 升级时迁移跑了 30 秒,期间用户访问:返回 503 + `Retry-After: 30`,而不是 500 错误页
- 备份失败 (磁盘满 / pg_dump 异常):写 ERROR 日志,不影响主服务,下一个 03:00 重试
- TLS 证书续期失败 (ACME 服务故障):服务继续运行,证书过期前 7 天的窗口期允许修复
- 宿主机重启:所有容器按 `restart: always` 拉起,迁移服务在 app 前
- 容器 OOM:内存限制触发杀进程,restart 拉起,日志保留死因 (exit code 137)
- 同时启动两个 BALTHASAR 实例 (端口冲突 / 容器名冲突):compose 在启动前显式报错,不留半拉状态
- DNS A 记录未生效就启动反向代理:容器持续重试,日志显示等待 DNS
- 备份产物损坏 (gzip 校验失败):恢复命令拒绝加载并提示具体文件
- 镜像拉取失败 (GHCR 限速 / 网络中断):compose 报错,提示 `docker login ghcr.io` 解决方案
- 升级跨多个版本 (跳过中间 tag):迁移按顺序跑完所有 step,任一步失败则停止

## Requirements *(mandatory)*

### Functional Requirements

#### 部署拓扑与配置

- **FR-001**: 系统 MUST 提供一份 `docker-compose.yml` 作为唯一部署入口,本地开发与生产部署通过 override 文件 (`compose.override.yml` 与 `compose.prod.yml`) 区分,基础文件与 override 共享 ≥ 70% 配置。
- **FR-002**: 系统 MUST NOT 在仓库内维护超过 2 份 compose 变体 (基础 + 至多 2 个 override)。
- **FR-003**: 系统 MUST 在仓库内提供 `Makefile` 或等价脚本,封装 `deploy` / `upgrade` / `backup` / `restore` / `logs` 等运维命令,运维者无需记忆 compose 参数。
- **FR-004**: 系统 MUST 强制运维者通过环境变量提供以下三类敏感信息 (缺失则拒绝启动):应用密钥、数据库密码、对外公开 URL。
- **FR-005**: 系统 MUST NOT 在 compose 文件、Makefile、Caddyfile 模板中硬编码任何密码、密钥、域名、邮箱。
- **FR-006**: 系统 MUST 在 `.env.example` 中列出所有必填与选填环境变量,附生成方式 (如 `openssl rand -base64 32`)。

#### CI/CD

- **FR-007**: 系统 MUST 在每次合并到主分支时自动构建并推送镜像到 GHCR,无需人工触发。
- **FR-008**: 镜像 MUST 同时打 5 个 tag:语义版本号、主版本、主次版本、`latest`、8 位 git 短 SHA。
- **FR-009**: 镜像 MUST 包含数据库迁移工具与 SQL 文件,可在容器内执行 `migrate` 命令而不依赖外部源码。

#### 迁移

- **FR-010**: 系统 MUST 在应用启动前以独立容器执行数据库迁移,迁移容器成功退出后 app 容器才启动。
- **FR-011**: 系统 MUST 在迁移容器失败时阻止 app 容器启动,迁移容器日志包含失败 SQL、错误码、影响表名。
- **FR-012**: 系统 MUST 在升级场景下自动执行迁移 (无需运维者手动跑命令),且支持空数据库初始化。

#### TLS

- **FR-013**: 系统 MUST 通过反向代理容器自动获取并续期 ACME 证书 (Let's Encrypt 等),无需运维者手工准备证书文件。
- **FR-014**: 系统 MUST 在本地开发场景 (`BETTER_AUTH_URL=http://localhost:3000`) 回退到 HTTP 或自签证书,不触发 ACME 流程。
- **FR-015**: 系统 MUST 在证书过期前 ≥ 14 天自动续期;续期失败时写日志但不停服。

#### 备份与恢复

- **FR-016**: 系统 MUST 每日 03:00 (按宿主时区) 自动执行数据库全量备份 (pg_dump + gzip)。
- **FR-017**: 系统 MUST 保留最近 30 天备份,过期文件自动删除。
- **FR-018**: 系统 MUST 提供 `restore` 命令,从指定日期备份恢复数据库,恢复前自动停止应用写入。
- **FR-019**: 备份文件 MUST 以 gzip 压缩,平均压缩比 ≥ 5:1 (相对原始 SQL)。
- **FR-020**: 备份容器 MUST 与数据库容器解耦 (独立容器/独立调度),数据库故障时备份仍可独立启动恢复流程。

#### 可观测性与资源治理

- **FR-021**: 所有容器 MUST 配置日志轮转,json-file 驱动,单文件 ≤ 10MB,每个容器保留 ≤ 5 个文件。
- **FR-022**: 应用 MUST 暴露 `/healthz` 端点返回 200 (liveness),反向代理据此做健康检查。
- **FR-023**: 系统 MUST 为每个非临时容器配置 `restart: always`,宿主机重启后自动拉起。
- **FR-024**: 系统 MUST 为应用与数据库容器配置内存上限,防止单容器吃光宿主资源 (具体数值由 override 决定)。
- **FR-025**: 系统 MUST 为应用容器配置 `stop_grace_period: 30s`,确保正在处理的请求优雅退出。
- **FR-026**: 系统 MUST NOT 将数据库端口直接映射到宿主机公网接口 (默认绑 `127.0.0.1` 或不映射)。

### Key Entities *(include if feature involves data)*

- **部署目录 (`deploy/`)**: 仓库内集中存放运维相关文件,包含基础 compose、override、Makefile、反向代理配置模板、`.env.example`。
- **环境配置 (`.env`)**: 运维者维护的本地文件,包含所有部署变量,不入版本控制。
- **备份产物 (`backups/`)**: 持久化卷上的目录,文件命名 `YYYY-MM-DD.sql.gz`,自动轮转。
- **迁移产物 (`migrations/`)**: 打入镜像内部,与运行时分离,通过独立 entrypoint 触发。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在一台干净的 Linux VM (Ubuntu 22.04+, Docker 24+ 预装) 上,从克隆仓库到浏览器访问到登录页 (含证书生效),**总耗时 < 10 分钟**,前提是 DNS 已解析、80/443 端口已开放。
- **SC-002**: 部署完成后立即访问 `https://<域名>`,**证书有效且无需任何手工证书操作**。
- **SC-003**: 升级到新版本时,**应用停机时间 < 30 秒** (从旧版本停止接受请求到新版本开始接受请求)。
- **SC-004**: 模拟 1000 笔交易后,**单日备份产物体积 < 10 MB** (gzip 压缩后)。
- **SC-005**: 备份恢复后,**所有账单数据校验通过,无丢失** (按行数 + 关键字段 hash 比对)。
- **SC-006**: 仓库内 `deploy/` 目录的**总配置行数 < 300 行** (基础 compose + override + Makefile + 反向代理模板 + `.env.example`),与当前 3 份 compose + 散落脚本相比 **减少 ≥ 40%**。
- **SC-007**: 生产镜像体积 **< 200 MB** (`docker images` 显示的 virtual size),与当前版本不增加。
- **SC-008**: `docker compose ps` 在生产部署 7 天后,所有服务仍显示 `healthy`,无重启循环 (重启次数 < 3)。
- **SC-009**: 仓库内**不再保留** `docker/docker-compose.yml`、`docker/docker-compose.prod.yml`、`docker/.env.example`、`docker/.env.prod.example` 多份变体,改为 `deploy/` 单一目录。

## Assumptions

- 运维者具备基本 Linux 命令行能力,但不必熟悉 Docker / 反向代理 / 数据库迁移工具内部细节。
- 部署目标是一台 x86_64 Linux VM (Ubuntu 22.04+ 推荐),已安装 Docker 24+ 和 Docker Compose v2+。
- 域名已购买,DNS 由运维者管理,可设置 A 记录指向部署机 IP。
- 部署机 80/443 端口对公网开放 (Let's Encrypt HTTP-01/TLS-ALPN 校验需要)。
- 备份产物保存在部署机本地卷;异地备份 (S3/B2/rclone) 是 V2 范围,本版本只生成 `.gz` 文件。
- 邮件告警 (SMTP) 是 V2 范围,本版本告警只输出到容器日志。
- 多机集群、Kubernetes、蓝绿部署、零停机滚动升级均不在范围 (YAGNI,违反宪章原则六)。
- 数据库仍为容器化 PostgreSQL,不使用 RDS/Cloud SQL 等托管服务 (YAGNI;迁移到托管 PG 在 V2 评估)。
- 反向代理采用 **Caddy**,因其零配置自动 HTTPS (相比 nginx + certbot 减少约 70% 配置)。Caddy 也是业界自托管场景的主流选择 (Popular in self-hosting community)。
- 镜像构建仍由现有 `.github/workflows/deploy.yml` 完成,本 feature 复用其产物,不重写 CI。
- 当前 GitHub 账号解封后 CI 才会真正跑起来,本 feature 的实施与验证不依赖 CI 解封 (可本地 `docker build` 测试)。
- 备份命令以 PostgreSQL 自带 `pg_dump` 为基础,不引入 pgBackRest / wal-g 等重型工具 (YAGNI)。
- 镜像内迁移工具沿用项目现有的 Drizzle Kit,不引入新工具链。
