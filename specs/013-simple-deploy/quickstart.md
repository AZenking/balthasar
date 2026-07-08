# Quickstart: 013-simple-deploy

**Date**: 2026-07-08

本文档列出 3 个端到端验证场景,证明简易部署在目标平台可工作。每个场景 30 分钟内可执行完毕。

---

## 场景 A: 通用 Linux / macOS / WSL2 部署

**目标**: 验证 SC-002 (`docker compose up -d` 到 `curl 200` < 3 分钟)

### 前置

- Docker 24+ 与 Compose v2+ 已装
- 仓库已克隆到本地
- 网络可访问 ghcr.io (或本地已 `docker build` 出镜像)

### 步骤

```bash
# 1. 配置环境变量
cp deploy/simple/.env.simple.example deploy/simple/.env
# 编辑 .env:
#   BETTER_AUTH_SECRET=$(openssl rand -base64 32)
#   BETTER_AUTH_URL=http://localhost:3000
#   ALLOW_REGISTRATION=true   # 临时开放注册

# 2. 启动
make simple-up
# 或: docker compose -f deploy/simple/docker-compose.simple.yml --env-file deploy/simple/.env up -d

# 3. 等待 healthy (≤ 60s)
docker compose -f deploy/simple/docker-compose.simple.yml ps
# 期望: balthasar-app  Up (healthy), balthasar-pg  Up (healthy)

# 4. 验证应用启动
curl -I http://localhost:3000/api/v1/transactions
# 期望: HTTP/1.1 401 (无 key 时正确拒绝)
curl http://localhost:3000/healthz
# 期望: HTTP/1.1 200, body: "ok"
```

### 验证清单

- [ ] `docker compose ps` 显示所有容器 `healthy` ≤ 60s
- [ ] `curl http://localhost:3000/healthz` 返回 200
- [ ] `curl -I http://localhost:3000/api/v1/transactions` 返回 401 (REST 端点正常)
- [ ] 浏览器访问 `http://localhost:3000` 显示登录页
- [ ] 点击"注册"链接,能填写邮箱密码并提交
- [ ] 注册后自动跳转到 `/dashboard`,创建默认 family + member

### 关闭注册 (验证 SC-010)

```bash
# 修改 .env: ALLOW_REGISTRATION=false (或注释掉)
sed -i.bak 's/ALLOW_REGISTRATION=true/# ALLOW_REGISTRATION=true/' deploy/simple/.env
make simple-down
make simple-up

# 验证注册关闭
curl http://localhost:3000/sign-up
# 期望: HTTP/1.1 404
curl -I -X POST http://localhost:3000/api/auth/sign-up-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"should-fail","name":"Test"}'
# 期望: HTTP/1.1 400 (REGISTRATION_CLOSED)
```

---

## 场景 B: Synology DSM 7.2+ Container Manager 部署

**目标**: 验证 SC-001 (克隆到 Container Manager 显示"运行中" < 5 分钟)

### 前置

- Synology NAS,DSM 7.2+,x86_64 (DS220+ / DS920+ / DS1522+ 等主流型号)
- Container Manager 已启用 (套件中心安装)
- File Station 可访问 `/volume1/docker/`
- SSH 已启用 (控制面板 → 终端机和 SNMP) 用于上传 (可选,可用 File Station 替代)

### 步骤

```bash
# 在 PC/Mac 上
git clone https://github.com/AZenking/balthasar.git
cd balthasar

# 准备部署文件
cp deploy/simple/.env.simple.example deploy/simple/.env
# 编辑 .env:
#   BETTER_AUTH_SECRET=$(openssl rand -base64 32)
#   BETTER_AUTH_URL=https://balthasar.example.com   # 替换为你的域名
#   ALLOW_REGISTRATION=true   # 临时开放注册
#   TZ=Asia/Shanghai

# 上传到 NAS (任选其一):
#   方式 1: File Station 拖拽到 /volume1/docker/balthasar/
#   方式 2: scp -r deploy/simple/ user@nas:/volume1/docker/balthasar/
```

在 NAS DSM 中:

1. **打开 Container Manager** → 项目 → 新建
2. **项目名称**: `balthasar`
3. **路径**: `/volume1/docker/balthasar`
4. **来源**: 使用现有的 docker-compose 文件
5. **Compose 文件路径**: 选择 `/volume1/docker/balthasar/docker-compose.simple.yml`
6. **环境变量文件**: 选择 `/volume1/docker/balthasar/.env`
7. 点击 **下一步** → **完成**

Container Manager 自动:
- 拉取 `ghcr.io/azenking/balthasar/app:latest` (含 amd64 manifest)
- 启动 postgres + app 容器
- app entrypoint 自动跑迁移

### 验证清单

- [ ] Container Manager → 项目 → balthasar 显示"运行中"
- [ ] 容器列表中 balthasar-app 与 balthasar-pg 均 `healthy`
- [ ] 在 NAS 浏览器访问 `http://<NAS-IP>:3000` 返回登录页

### DSM 反向代理 + HTTPS (验证 SC-003)

1. **控制面板 → 登录门户 → 高级 → 反向代理 → 新增**
   - 来源类型: HTTPS
   - 来源主机名: `balthasar.example.com` (你的域名)
   - 来源端口: 443
   - 目标主机名: `localhost`
   - 目标端口: 3000

2. **控制面板 → 安全性 → 证书 → 新增**
   - 选择"添加新证书" → "Let's Encrypt"
   - 域名: `balthasar.example.com`
   - 邮箱: 你的邮箱
   - (DNS A 记录必须已指向 NAS 公网 IP)

3. **回到反向代理** → 选择刚才的规则 → 编辑 → 证书 → 选刚创建的 Let's Encrypt 证书

4. **验证**:
   ```bash
   curl -I https://balthasar.example.com/healthz
   # 期望: HTTP/2 200
   curl -I https://balthasar.example.com/api/v1/transactions
   # 期望: HTTP/2 401
   ```

### 关闭注册

在 File Station 编辑 `/volume1/docker/balthasar/.env`:
- 注释掉 `ALLOW_REGISTRATION=true` (前加 `#`)
- 保存

Container Manager → 项目 → balthasar → 停止 → 启动 (或重启)

---

## 场景 C: 升级 + 备份 + 恢复

**目标**: 验证 SC-005 (备份体积 < 10MB) + SC-008 (升级停机 < 60s)

### 前置

- 场景 A 或 B 已完成,应用运行中
- 已注册至少一个用户,创建至少 10 笔交易 (模拟数据)
- 已登录,session 有效

### 备份

```bash
make simple-backup
# 或: docker compose -f deploy/simple/docker-compose.simple.yml exec -T postgres \
#       pg_dump -U balthasar balthasar | gzip > backups/backup-$(date +%F).sql.gz

ls -lh backups/
# 期望: backup-2026-07-08.sql.gz 体积 < 10 MB (实测 1000 笔交易约 500KB)
gunzip -t backups/backup-2026-07-08.sql.gz && echo "gzip integrity OK"
```

### 验证备份内容

```bash
mkdir -p /tmp/backup-verify
gunzip -c backups/backup-2026-07-08.sql.gz > /tmp/backup-verify/dump.sql
grep -c "INSERT INTO" /tmp/backup-verify/dump.sql
# 期望: ≥ 10 (至少 10 笔交易对应 INSERT)
grep -c "CREATE TABLE" /tmp/backup-verify/dump.sql
# 期望: ≥ 7 (Better-Auth 4 + family/member + account/category/transaction/...)
```

### 升级

```bash
# 模拟版本升级 (从 latest 改为某个具体 tag,然后回 latest 触发 pull)
make simple-upgrade TAG=0.1.0
# 内部: sed 改 .env DOCKER_TAG → docker compose pull → docker compose up -d

# 验证升级期间停机
time curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/healthz
# 升级前: 200 (秒级)
# 升级中: 拒绝连接 (旧容器停 → 新容器启)
# 升级后: 200 (秒级)
# 总停机时间应 < 60s

# 验证数据保留
docker compose -f deploy/simple/docker-compose.simple.yml exec postgres \
  psql -U balthasar -d balthasar -c "SELECT COUNT(*) FROM transaction;"
# 期望: 与备份时一致
```

### 恢复

```bash
# 模拟误删数据 (在 UI 删除若干交易)
# 或直接 SQL:
docker compose -f deploy/simple/docker-compose.simple.yml exec postgres \
  psql -U balthasar -d balthasar -c "DELETE FROM transaction WHERE remark LIKE 'test%';"

# 从备份恢复
make simple-restore DATE=2026-07-08
# 内部: 停 app → gunzip → psql restore → 起 app

# 验证恢复
docker compose -f deploy/simple/docker-compose.simple.yml exec postgres \
  psql -U balthasar -d balthasar -c "SELECT COUNT(*) FROM transaction;"
# 期望: 与备份时一致 (test% 的交易恢复)
```

---

## 场景 D: 多架构镜像验证 (Apple Silicon / 树莓派)

**目标**: 验证 SC-007 (linux/amd64 + linux/arm64 双架构)

### 前置

- 一台 Apple Silicon Mac (M1/M2/M3) 或树莓派 4 (arm64)
- Docker Desktop 或等同已装

### 步骤

```bash
# 在 Apple Silicon Mac 上
uname -m  # 期望: arm64

git clone https://github.com/AZenking/balthasar.git
cd balthasar
cp deploy/simple/.env.simple.example deploy/simple/.env
# 编辑 .env (同场景 A)

make simple-up
# 期望: 拉取 arm64 manifest,无 "no matching manifest" 错误

docker compose -f deploy/simple/docker-compose.simple.yml ps
# 期望: balthasar-app Up (healthy)

curl http://localhost:3000/healthz
# 期望: 200
```

### 验证架构匹配

```bash
docker inspect ghcr.io/azenking/balthasar/app:latest | grep -E "Architecture|Os"
# 期望 (在 arm64 主机):
#   "Architecture": "arm64",
#   "Os": "linux"
```

---

## 共同验收清单

执行所有场景后,确认以下都通过:

- [ ] SC-001: Synology NAS 部署 < 5 分钟
- [ ] SC-002: 通用 Docker 部署 < 3 分钟
- [ ] SC-003: DSM 反向代理 + Let's Encrypt 自动签发
- [ ] SC-004: 容器启动到监听 3000 < 60 秒
- [ ] SC-005: 备份体积 < 10 MB
- [ ] SC-006: deploy/simple/ 目录总配置 < 150 行
- [ ] SC-007: amd64 + arm64 双架构
- [ ] SC-008: 升级停机 < 60 秒
- [ ] SC-009: README < 1500 字
- [ ] SC-010: 注册关闭后 `/sign-up` 返回 404,API 返回 400
- [ ] SC-011: 8 月 1 日 00:30 上海时间记账,Dashboard "本月" 立即包含

任何一项失败,需在实施任务中标记回归 (per `/speckit-implement` 规则)。
