# Quickstart: 014-ops-docs

**Date**: 2026-07-08

本文档列出 3 个端到端验证场景,证明文档体系达成 SC-001 / SC-002 / SC-003。每个场景需找一位**未接触过本仓库**的真实用户操作 (开发者朋友 / 运维朋友)。

---

## 场景 A: 新开发者上手 (验证 SC-001 < 30 分钟)

### 前置

- 一位**未读代码、未部署过本仓库**的开发者
- 干净的 Linux / macOS / WSL2 环境
- 已装 Node 22+ / pnpm 11+ / Docker 24+ (或文档指导装)

### 步骤

```bash
# 0. 计时开始
START=$(date +%s)

# 1. clone
git clone https://github.com/AZenking/balthasar.git
cd balthasar

# 2. 跟随 docs/getting-started.md
open docs/getting-started.md   # 或 code docs/getting-started.md
```

**用户操作** (开发者按文档逐步执行,观察员不插话):

1. 阅读"前置环境"章节,跑 `node --version` / `pnpm --version` / `docker info`
2. 跑 `pnpm install`
3. 复制 `.env.example` 为 `.env`,填 `BETTER_AUTH_SECRET=$(openssl rand -base64 32)`
4. 启动 Postgres:`docker compose -f docker/docker-compose.yml up -d postgres`
5. 跑迁移:`pnpm db:migrate`
6. 启动 dev:`pnpm dev`
7. 验证:`curl http://localhost:3000/healthz`

```bash
# 计时结束
END=$(date +%s)
echo "耗时: $((END - START)) 秒"
# 期望: < 1800 秒 (30 分钟)
```

### 验证清单

- [ ] 耗时 < 30 分钟 (SC-001)
- [ ] `curl http://localhost:3000/healthz` 返回 200
- [ ] 浏览器 `http://localhost:3000` 显示登录页
- [ ] 开发者能跑 `pnpm test` 至少一次全绿 (或明确指出哪些预存在失败)
- [ ] 开发者能用 `pnpm tsc --noEmit` 验证类型 (即使有预存在错误,也能理解输出)
- [ ] 开发者能找到"架构导览"章节并指出 5 个关键目录用途

### 反馈收集 (场景后)

询问开发者:
- 哪一步卡住超过 5 分钟?
- 哪个术语不懂?
- 还想看什么文档没找到?

把反馈合并到 `docs/getting-started.md` 的"常见首次启动失败"章节。

---

## 场景 B: 部署运维者首次部署 (验证 SC-002 < 15 分钟)

### 前置

- 一位**未部署过本仓库**的运维者
- 干净的 Linux VM (Ubuntu 22.04+ 推荐) 或 Synology NAS (DSM 7.2+)
- DNS A 记录已指向部署机 (例:`balthasar.test.example.com`)
- 80/443 端口开放

### 步骤

```bash
# 0. 计时开始
START=$(date +%s)

# 1. clone
git clone https://github.com/AZenking/balthasar.git
cd balthasar

# 2. 跟随 docs/deployment.md
open docs/deployment.md
```

**用户操作**:

1. 阅读"选哪种模式?"决策树 (4 问表格)
2. 根据场景选 simple 模式 → 点击"simple 部署"章节
3. 跟随链接到 `deploy/simple/README.md`,按 Synology 或 Generic Docker 步骤
4. 复制 `.env.simple.example` 为 `.env`,填 `BETTER_AUTH_SECRET` 与 `BETTER_AUTH_URL`
5. 临时设 `ALLOW_REGISTRATION=true`
6. 启动:`make simple-up`
7. 等 60 秒,验证:`curl http://localhost:3000/healthz`
8. 浏览器注册第一个账号
9. 改 `ALLOW_REGISTRATION=false` 重启
10. 配置 DSM 反向代理 / Cloudflare Tunnel (按文档)
11. 验证 HTTPS:`curl -I https://balthasar.test.example.com/healthz`

```bash
END=$(date +%s)
echo "耗时: $((END - START)) 秒"
# 期望: < 900 秒 (15 分钟,前提镜像已 pull)
```

### 验证清单

- [ ] 耗时 < 15 分钟 (SC-002,前提镜像已就绪)
- [ ] 浏览器 HTTPS 访问到登录页,证书有效 (SC-003)
- [ ] 跑部署后 5 项验证 checklist (SC-003 全项):
  - [ ] `curl https://<域名>/healthz` → 200
  - [ ] `docker compose logs app | grep "migrate"` 显示迁移成功
  - [ ] `curl https://<域名>/sign-up` → 404 (注册关闭)
  - [ ] `make simple-backup && ls -lh backups/*.sql.gz` 文件存在
  - [ ] 时区正确:`docker compose exec app date` 显示 CST

### 反馈收集

询问运维者:
- 决策树 4 问是否覆盖你的场景?
- 哪个章节步骤不清晰?
- 部署后验证 checklist 是否够用?

---

## 场景 C: 已部署运维者日常运维 (验证 SC-005 ≥ 15 症状)

### 前置

- 场景 B 已完成,BALTHASAR 运行中
- 已注册用户,创建若干交易 (模拟数据)

### 步骤 1: 升级

```bash
# 跟随 docs/operations.md#升级
make simple-upgrade TAG=0.2.0   # 假设 0.2.0 已发布
# 期望: 停机 < 60 秒,数据保留
```

### 步骤 2: 备份 + 恢复

```bash
# 跟随 docs/operations.md#备份
make simple-backup
ls -lh backups/backup-*.sql.gz
# 期望: 体积 < 10 MB (按 1000 笔交易)

# 跟随 docs/operations.md#恢复
make simple-restore DATE=2026-07-08
# 期望: 数据库回到备份时点状态
```

### 步骤 3: 故障排查模拟 (≥ 3 个症状)

运维者**随机制造** 3 个故障,然后查 `docs/troubleshooting.md` 排查:

**故障 1**: 改 `.env` 中 `BETTER_AUTH_URL` 为错误域名,重启,尝试登录
- 期望症状: 登录后立即登出 / cookie 错位
- 期望文档: troubleshooting 表格"登录后立即登出"行

**故障 2**: `docker compose stop postgres`,等 30 秒,再 `start`,看 app 是否自动恢复
- 期望症状: app 临时 502,PG 起来后 app 恢复
- 期望文档: troubleshooting 表格"postgres 重启后 app 不恢复"行 (如无,加新行)

**故障 3**: 改 `TZ=America/Los_Angeles` 重启,看 Dashboard
- 期望症状: 上海时间 8 月 1 日 00:30 的交易被算到 7 月 (因为 LA 时区还在 7 月 31 日)
- 期望文档: troubleshooting 表格"Dashboard 月度漏算"行 + configuration.md TZ 警告

### 验证清单

- [ ] 升级停机 < 60 秒
- [ ] 备份文件 < 10 MB (gzip)
- [ ] `gunzip -t backups/backup-*.sql.gz` 通过
- [ ] 恢复后数据完整 (行数 + 关键字段)
- [ ] troubleshooting.md 覆盖 ≥ 15 个症状 (SC-005),人工数行确认
- [ ] 3 个模拟故障的修复步骤都能在文档中找到

---

## 场景 D: 文档质量交叉验证

**目标**: 验证 SC-004 (字数) / SC-006 (TOC 锚点) / SC-007 (DRY) / SC-008 (env 对齐) / SC-009 (角色矩阵) / SC-010 (feature 列表)。

### 步骤

```bash
# 1. 字数 (SC-004)
wc -w docs/getting-started.md docs/deployment.md docs/operations.md \
     docs/troubleshooting.md docs/configuration.md docs/architecture.md
# 期望: 总和 ≤ 6000 字

# 2. TOC 锚点 (SC-006) — 人工点击每份文档头部 TOC 链接
# 期望: 全部跳转正确,无 404

# 3. DRY (SC-007) — 人工 grep 关键命令
grep -r "openssl rand -base64 32" docs/
# 期望: 仅在 configuration.md + getting-started.md (引用) 出现,无复制
grep -r "make simple-backup" docs/
# 期望: 仅在 operations.md 主源,其他文档链接

# 4. env 对齐 (SC-008)
SRC=$(grep -oE '^\s+[A-Z_]+:\s+z\.' src/lib/env.ts | awk -F: '{print $1}' | tr -d ' ' | sort -u)
DOC=$(grep -oE '^\| \`[A-Z_]+\`' docs/configuration.md | sed 's/|`//g' | sed 's/`//g' | sort -u)
diff <(echo "$SRC") <(echo "$DOC")
# 期望: 无输出 (两份一致)

# 5. 角色矩阵 (SC-009)
grep -A 6 "按角色入口" README.md
# 期望: 4 行表格 (开发者 / 部署运维者 / 已部署运维者 / 排障),每行链到对应文档

# 6. feature 列表 (SC-010)
grep -A 15 "已交付" docs/architecture.md
# 期望: 13 个 feature (001-013),每个一行摘要
```

### 验证清单

- [ ] 6 份文档总字数 ≤ 6000 (SC-004)
- [ ] 每份文档 TOC 锚点全部可点击 (SC-006)
- [ ] DRY: 关键命令单一主源 (SC-007)
- [ ] env.ts 变量数 == configuration.md 变量数 (SC-008)
- [ ] README 角色矩阵 4 行 + 6 份文档链接无死链 (SC-009)
- [ ] architecture.md feature 列表 13 项 (SC-010)

---

## 共同验收清单 (实施任务 T018 用)

执行所有场景后,确认 11 项 SC 全部通过:

- [ ] SC-001: 新开发者 < 30 分钟跑通 (场景 A)
- [ ] SC-002: 运维者 < 15 分钟部署 (场景 B)
- [ ] SC-003: 部署后 5 项验证 (场景 B)
- [ ] SC-004: 总字数 ≤ 6000 (场景 D)
- [ ] SC-005: troubleshooting ≥ 15 症状 (场景 C + D)
- [ ] SC-006: TOC 锚点完整 (场景 D)
- [ ] SC-007: DRY 单一主源 (场景 D)
- [ ] SC-008: env 对齐 (场景 D)
- [ ] SC-009: 角色矩阵 4 行 (场景 D)
- [ ] SC-010: feature 列表 13 项 (场景 D)

任何一项失败,需在 tasks.md 标记回归或更新 spec。
