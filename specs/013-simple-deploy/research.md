# Phase 0 Research: 013-simple-deploy

**Date**: 2026-07-08

本文档解决 spec.md Technical Context 中标记为 NEEDS CLARIFICATION 的项,以及 /speckit-clarify 阶段 Deferred 的低 Impact 实现细节。

---

## Q1: 首用户检测 + 自动管理员 (FR-024)

### Decision

**用 `user` 表行数 == 0 作为判定 + 通过 Better-Auth `databaseHooks.user.create.before` 拦截注册**。

```typescript
// src/server/auth/hooks/registration-gate.ts (新增)
databaseHooks: {
  user: {
    create: {
      before: async (user) => {
        const allowRegistration = env.ALLOW_REGISTRATION === "true";
        const userCount = await db.$count(user);
        if (userCount === 0) return; // 首用户,放行
        if (!allowRegistration) {
          throw new Error("REGISTRATION_CLOSED");
        }
      },
      after: async (createdUser) => {
        // existing: family-init + audit
      },
    },
  },
}
```

### Rationale

- **不加 `role` 字段**:违反 YAGNI。家用场景 admin 判定靠 `ORDER BY created_at LIMIT 1`,频率极低 (仅用户管理操作),每次查 DB 完全可接受。
- **`before` hook 而非 `after`**:在数据写入前拦截,避免"先创建再删除"的脏数据。
- **抛错而非返回 false**:Better-Auth hook 抛错会中断事务,客户端收到 403,符合 spec FR-025。
- **复用 Better-Auth 既有 hook 机制**:与现有 `family-init` / `audit` 同栈,不引入新中间件。

### Alternatives Considered

- **DB 表加 `role text default 'member'`**:需要新 migration、Better-Auth plugin 配置、admin UI 才能切换。家用场景"我就是户主"无切换需求 → 违反 YAGNI。
- **独立 `app_settings` 表存 `registration_open: boolean`**:增加 schema 复杂度,且需要 UI 切换入口。
- **环境变量为唯一开关 (不查 user count)**:用户首次部署忘记开 env 就永远注册不了,体验差。

---

## Q2: 注册关闭时的端点行为 (FR-025, FR-026)

### Decision

**hook 抛错 → Better-Auth 返回 400 + `REGISTRATION_CLOSED` 错误码;客户端登录页根据 env 渲染是否显示注册链接**。

```typescript
// src/components/auth/sign-in-form.tsx (修改)
{env.NEXT_PUBLIC_ALLOW_REGISTRATION === "true" && (
  <Link href="/sign-up">注册新账号</Link>
)}
```

`/sign-up` 页面 server-side 检查:用户表非空 + env 不允许时,返回 404。

### Rationale

- **不返回 403 (Forbidden)**:会暴露端点存在性。404 是更安全的"不存在"信号。
- **登录页用 `NEXT_PUBLIC_*` env**:client-side 渲染,无需 API 调用即可决定是否显示链接。
- **env 是 PUBLIC 的**:运维者关闭注册后,登录页立即反映,无需 DB 查询。

### Alternatives Considered

- **每次登录页 SSR 查 user count**:增加 DB 负载,登录页变慢。
- **endpoint 返回 403 + 错误信息**:暴露端点存在性,违反 FR-026。

---

## Q3: Docker entrypoint 同时支持 "migrate-then-start" 与 "migrate-only" (CI 验证用)

### Decision

**用 `BALTHASAR_ENTRYPOINT_MODE` 环境变量切换**:

```bash
#!/bin/sh
# docker/entrypoint.sh (新增)
set -e

case "${BALTHASAR_ENTRYPOINT_MODE:-serve}" in
  migrate)
    echo "[entrypoint] migrate-only mode"
    node node_modules/drizzle-kit/bin.cjs migrate
    exit $?
    ;;
  serve)
    echo "[entrypoint] waiting for postgres..."
    until pg_isready -h "${POSTGRES_HOST:-postgres}" -U "${POSTGRES_USER:-balthasar}"; do
      sleep 1
    done
    echo "[entrypoint] running migrations..."
    node node_modules/drizzle-kit/bin.cjs migrate
    echo "[entrypoint] starting app..."
    exec node server.js
    ;;
  *)
    echo "Unknown BALTHASAR_ENTRYPOINT_MODE: ${BALTHASAR_ENTRYPOINT_MODE}"
    exit 1
    ;;
esac
```

### Rationale

- **shell case 而非 node script**:shell 启动开销 < 100ms,且不依赖 node_modules 完整加载。
- **`pg_isready` 复用 postgres-alpine 自带工具**:app 容器基于 `node:22-alpine`,需 `apk add postgresql-client`。
- **`exec node`**:替换 shell 进程,让 node 成为 PID 1 接收 SIGTERM (优雅停止)。
- **`migrate` 模式独立退出码**:CI 与未来 K8s init container 都可复用。

### Alternatives Considered

- **两份 entrypoint 脚本**:维护成本翻倍,违反 DRY。
- **node 写 entrypoint**:启动慢,且需要 node_modules 完整加载才能执行 (鸡生蛋问题)。
- **不显式等 postgres,靠 `depends_on: service_healthy`**:compose 层 OK,但 K8s / docker run 场景不行。entrypoint 内重试更通用。

---

## Q4: GitHub Actions buildx 多架构构建 (FR-008)

### Decision

**用 `docker/setup-qemu-action@v3` + `docker/build-push-action@v5` + `linux/amd64,linux/arm64` 平台列表**:

```yaml
# .github/workflows/deploy.yml (修改)
- uses: docker/setup-qemu-action@v3
- uses: docker/setup-buildx-action@v3

- name: Build and push (multi-arch)
  uses: docker/build-push-action@v5
  with:
    context: .
    file: ./Dockerfile
    platforms: linux/amd64,linux/arm64
    push: true
    tags: |
      ghcr.io/${{ steps.image.outputs.registry }}/app:${{ steps.image.outputs.version }}
      ghcr.io/${{ steps.image.outputs.registry }}/app:${{ steps.image.outputs.major_minor }}
      ghcr.io/${{ steps.image.outputs.major }}
      ghcr.io/${{ steps.image.outputs.registry }}/app:latest
      ghcr.io/${{ steps.image.outputs.registry }}/app:${{ steps.image.outputs.short_sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Rationale

- **QEMU emulation**:arm64 镜像在 x86_64 runner 上跨架构构建,GHA 原生支持,无需自建 arm runner。
- **`cache-from/cache-to: type=gha`**:GitHub Actions cache,跨 workflow run 复用层,arm64 构建慢 (~15 min) 但有 cache 后 < 5 min。
- **buildx 替代 docker compose build**:buildx 直接产出多架构 manifest list,docker compose build 只能单架构。原 workflow 用 `docker compose build` 推多 tag 的方式不适用多架构。
- **Dockerfile 不需要 platform-specific 改动**:node:22-alpine 本身有多架构 manifest,从 apt 源到 npm 包都跨架构兼容。

### Alternatives Considered

- **两个独立 workflow 分别构建 amd64 / arm64 + `docker manifest create`**:维护成本高,且 manifest create 已被 buildx 内部处理。
- **自建 arm64 self-hosted runner**:GHA 免费额度不含 arm64 runner (2026 起 GHA arm64 OSS free tier 已扩容,但仍受额度限制)。QEMU 够用。
- **只构建 amd64**:违反 FR-008,Apple Silicon / 树莓派 / ARM NAS 用户无法使用。

---

## Q5: PostgreSQL timestamptz + Node `Date` 对象的时区处理 (FR-028, FR-029)

### Decision

**Node 进程 `TZ=Asia/Shanghai` + Drizzle `mode: 'date'` 默认返回 UTC `Date` 对象 + 业务层显式按 `America/...` 转换**。

```typescript
// PostgreSQL 内部存 UTC (timestamptz)
// node-postgres 解析后返回 Date 对象 (UTC 等价瞬时)
// 业务层做 "本月起始" 计算:
import { startOfMonth, format } from "date-fns-tz";

const now = new Date(); // UTC 等价
const tz = process.env.TZ ?? "Asia/Shanghai";
const monthStart = startOfMonth(now, { timeZone: tz });
// SELECT ... WHERE occurred_at >= monthStart AND occurred_at < endOfMonth(now, { timeZone: tz })
```

### Rationale

- **数据库永远存 UTC**:跨时区迁移不破坏数据。
- **业务层用 `date-fns-tz`**:已在前端 transaction-form 中使用 (008-transaction-ui),无新依赖。
- **Node `process.env.TZ`**:Node 原生支持,V8 内部 ICU 库据此决定 `Date.toString()` 输出。但 DB 查询用的是 UTC Date 对象,不受 TZ 影响 (避免歧义)。
- **Dockerfile `ENV TZ=Asia/Shanghai`**:确保 `new Date().toString()` 在日志中显示上海时间,方便排查。

### Alternatives Considered

- **DB 列改 `timestamp without time zone` + 存上海时间字符串**:跨时区迁移数据错乱,违反 FR-029。
- **后端永远 UTC,前端按 user locale 转换展示**:违反 SC-011,Dashboard "本月" 计算口径不对。
- **数据库存 epoch bigint**:Drizzle 已用 `timestamp` 模式,改动成本大,且失去 PG 时间函数便利 (`date_trunc` 等)。

---

## Q6: Synology DSM 反向代理 + Let's Encrypt 配置文档化 (FR-010)

### Decision

**README 直接嵌入步骤截图链接 + 文字步骤,不引入自动化脚本**:

```markdown
## Synology DSM 反向代理配置

1. **控制面板 → 登录门户 → 高级 → 反向代理** → 新增
   - 来源: `balthasar.example.com` / HTTPS / 443
   - 目标: `http://localhost:3000` / HTTP
2. **控制面板 → 安全性 → 证书** → 新增 → Let's Encrypt
   - 域名: `balthasar.example.com`
   - 邮箱: 你的邮箱
3. **反向代理** → 选择刚才的规则 → 设置 → 证书 → 选刚创建的证书
```

### Rationale

- **不引入自动化**:DSM UI 步骤无法脚本化 (除非用 SSH + dsm configs),违反 YAGNI。
- **截图 + 步骤**:与业界自托管项目文档一致 (Vaultwarden / Immich / Nextcloud)。
- **Cloudflare Tunnel 作为独立章节**:不强制用户用 DSM 反代,Cloudflare Tunnel 更适合无公网 IP 场景。

### Alternatives Considered

- **提供 DSM 反代 API 脚本**:DSM 7.2+ 有 SYNO.Core.ReverseProxy.Proxy API,但需要 DSM 账号密码,引入新的安全面,违反 YAGNI。
- **只支持 Cloudflare Tunnel**:Synology 用户未必用 Cloudflare,且国内访问 Cloudflare 不稳。

---

## Q7: Drizzle Kit migrate 在 entrypoint 中确保 idempotent

### Decision

**Drizzle Kit `migrate` 本身就是 idempotent (基于 `__drizzle_migrations` 表追踪),entrypoint 直接调用即可**:

```bash
node node_modules/drizzle-kit/bin.cjs migrate \
  --config=drizzle.config.ts \
  --dialect=postgresql
```

### Rationale

- **`__drizzle_migrations` 表**:Drizzle Kit 自动维护,记录已应用的 migration hash。
- **重复运行**:已应用的 migration 跳过,新 migration 按顺序应用。
- **失败回滚**:Drizzle Kit 默认无 down migration (需要手动 `drizzle-kit drop`),但 PG 事务保护单条 migration 原子性。
- **跨版本升级**:从 v0.1.0 升到 v0.2.0 时,镜像内 migrations 目录包含全部历史,顺序应用差集即可。

### Alternatives Considered

- **写自定义迁移脚本**:重新发明轮子。
- **用 Prisma Migrate**:换工具链,违反 constitution "Drizzle" 选择。

---

## Q8 (Deferred from clarify): 备份输出具体路径

### Decision

**默认输出到 PWD 当前目录,Makefile `simple-backup` target 提供 `BACKUP_DIR` 变量**:

```makefile
# Makefile
simple-backup:
	@mkdir -p $(BACKUP_DIR)
	docker compose -f deploy/simple/docker-compose.simple.yml exec -T postgres \
		pg_dump -U $$(grep POSTGRES_USER .env | cut -d= -f2) $$(grep POSTGRES_DB .env | cut -d= -f2) \
		| gzip > $(BACKUP_DIR)/backup-$$(date +%F).sql.gz

# 默认 BACKUP_DIR=./backups
# Synology 用户可在 .env 设 BACKUP_DIR=/volume1/backup/balthasar
```

### Rationale

- **不写死路径**:Linux 用户用 PWD 即可,Synology 用户改 `BACKUP_DIR` 指向 `/volume1/backup/`。
- **`BACKUP_DIR` 走 .env**:运维者一次配置,所有 `simple-*` target 共享。

---

## Q9 (Deferred from clarify): Synology PUID/PGID 文件权限

### Decision

**暂不引入 PUID/PGID 机制,文档说明 Synology Docker 数据目录权限要求**:

```markdown
## Synology 文件权限

Synology Container Manager 默认以 root 跑容器,数据卷可读写。
若启用了非 root 用户 (DSM 控制面板 → 文件服务 → 高级 → 文件系统),
需将 /volume1/docker/volumes/balthasar_pg_data_simple 所有者改为 999:999
(postgres 容器内用户 UID)。
```

### Rationale

- **linuxserver.io 模式过于复杂**:PUID/PGID 需要镜像 entrypoint 支持 `usermod`/`groupmod`,而我们的镜像是 `node:22-alpine` 直接 USER nextjs,改造成本不值。
- **Synology DSM 7.2+ 默认 root 模式工作正常**:绝大多数家用场景无权限问题。
- **进阶用户用 DSM File Station 改权限即可**:文档化即可。

---

## Q10 (Deferred from clarify): arm64 buildx CI 配置细节

### Decision

见 Q4,GitHub Actions cache 优化 + QEMU emulation,无需额外配置。

---

## 总结

10 项 NEEDS CLARIFICATION 全部解决。Phase 1 设计可基于以下原则展开:

1. **零 schema 变更**:首用户 admin 靠 user count + createdAt 启发式,不加 role 字段。
2. **零业务侵入**:注册开关通过 Better-Auth `databaseHooks.user.create.before` 实现,业务代码无感。
3. **共享底座**:Drizzle Kit + SQL migrations + Dockerfile 复用 011-open-api 既有产物。
4. **GHA 多架构**:buildx + QEMU + GHA cache,单 workflow 跑完 amd64 + arm64。
5. **TZ 默认值**:Dockerfile `ENV TZ=Asia/Shanghai`,业务层用 `date-fns-tz` 已有依赖。
6. **文档化平台细节**:DSM 反代 / PUID/PGID / Cloudflare Tunnel 全部走 README,不进 compose。
