# BALTHASAR 简易部署 (simple-deploy)

适用于 **Synology NAS / 家用服务器 / 内网 / 个人评估** 的 Docker 单文件部署。零外部依赖,TLS 与备份由部署平台提供。

如果你需要对外提供 HTTPS 服务 (Caddy + 自动备份 sidecar),用 [012 生产部署](../../docker/docker-compose.prod.yml)。

---

## 系统要求

- **Synology DSM 7.2+** (Container Manager) 或任意 **Docker 24+ + Compose v2+** 主机
- 架构: **x86_64** 或 **arm64** (Apple Silicon / 树莓派 4 / ARM NAS)
- 最低内存: 1 GB (app 限 512 MB + postgres 限 512 MB)
- 端口: 3000 (app), 5432 (postgres,默认仅本机)

---

## 场景 A: Synology DSM 7.2+ Container Manager 部署

### 步骤 1: 准备文件

在你的 PC/Mac 上:

```bash
git clone https://github.com/AZenking/balthasar.git
cd balthasar

cp deploy/simple/.env.simple.example deploy/simple/.env
```

编辑 `.env`,至少改这两项:

```bash
# 生成密钥: openssl rand -base64 32
BETTER_AUTH_SECRET=替换为你的随机密钥

# 你的域名 (稍后配反代用),或 http://<NAS-IP>:3000 走内网直连
BETTER_AUTH_URL=https://balthasar.example.com

# 首次部署:临时开放注册,注册完第一个账号后改回 false
ALLOW_REGISTRATION=true
NEXT_PUBLIC_ALLOW_REGISTRATION=true
```

把这两个文件上传到 NAS:

- **方式 1 (File Station)**: 创建 `/volume1/docker/balthasar/` 目录,把 `docker-compose.simple.yml` 和 `.env` 拖进去
- **方式 2 (SSH)**: `scp -r deploy/simple/ user@nas:/volume1/docker/balthasar/`

### 步骤 2: 启动 Container Manager 项目

1. **打开 Container Manager** (套件中心安装,如未装)
2. 切换到 **项目** 标签页 → **新增**
3. **项目名称**: `balthasar`
4. **路径**: 选择 `/volume1/docker/balthasar` (你刚上传的目录)
5. **来源**: 选择"使用现有的 docker-compose.yml 文件"
6. **Compose 文件**: Container Manager 会自动找到 `docker-compose.simple.yml`
7. 点击 **下一步** → **完成**

Container Manager 会:
- 拉取 `ghcr.io/azenking/balthasar/app:latest` (匹配你的 NAS 架构)
- 启动 postgres 容器,等待 healthcheck 通过
- 启动 app 容器,entrypoint 自动跑数据库迁移
- 监听 NAS 的 3000 端口

### 步骤 3: 验证启动

```bash
# 在 NAS SSH 终端或 PC 上
curl http://<NAS-IP>:3000/api/v1/transactions
# 期望: HTTP/1.1 401 (正确拒绝无 Key 请求,证明 app 已就绪)

curl http://<NAS-IP>:3000/healthz
# 期望: HTTP/1.1 200 ok
```

浏览器访问 `http://<NAS-IP>:3000` 应显示登录页。

### 步骤 4: 注册第一个账号

1. 浏览器访问 `http://<NAS-IP>:3000`
2. 点击"注册"链接 (因为 `NEXT_PUBLIC_ALLOW_REGISTRATION=true` 才显示)
3. 填邮箱 + 密码,提交
4. 注册成功 → 自动跳到 Dashboard,默认 Family "我的家庭" 已建好
5. **这个账号就是家庭所有者 (admin)**

### 步骤 5: 关闭注册 (重要!)

在 NAS 上编辑 `/volume1/docker/balthasar/.env`:
- 把 `ALLOW_REGISTRATION=true` 改成 `ALLOW_REGISTRATION=false` (或加 `#` 注释掉)
- `NEXT_PUBLIC_ALLOW_REGISTRATION=true` 同样改

回到 Container Manager → 项目 → balthasar → **停止** → **启动** (或 **重建**)

验证:
- `curl http://<NAS-IP>:3000/sign-up` → 返回 404
- 登录页不再显示"注册"链接

### 步骤 6 (可选): DSM 反向代理 + HTTPS

如果你要通过域名访问 (而不是 IP:端口):

1. **控制面板 → 登录门户 → 高级 → 反向代理** → 新增
   - 来源类型: **HTTPS**
   - 来源主机名: `balthasar.example.com` (你的域名)
   - 来源端口: **443**
   - 目标主机名: `localhost`
   - 目标端口: **3000**

2. **控制面板 → 安全性 → 证书** → 新增 → 选 **Let's Encrypt**
   - 域名: `balthasar.example.com`
   - 邮箱: 你的邮箱
   - (DNS A 记录必须已指向 NAS 公网 IP)

3. **回到反向代理列表** → 选刚才的规则 → 编辑 → 证书 → 选刚创建的 Let's Encrypt 证书

4. 验证: `curl -I https://balthasar.example.com/healthz` → `HTTP/2 200`

**重要**: `.env` 里 `BETTER_AUTH_URL` 必须是 `https://balthasar.example.com` (与反代源 URL 完全一致),否则 cookie 域错位,登录后立即登出。

### 步骤 7 (可选): Cloudflare Tunnel 替代方案

如果 NAS 没有公网 IP 或被 ISP 封 80/443:

1. 在 NAS 套件中心安装 **Cloudflare Tunnel** (或用 docker 跑 `cloudflare/cloudflared`)
2. 配置一个 tunnel,把 `balthasar.example.com` 路由到 `http://localhost:3000`
3. Cloudflare 自动终结 TLS,源站不需要证书
4. `.env` 里 `BETTER_AUTH_URL=https://balthasar.example.com`

### 常见问题

- **`no matching manifest`**: 你的 NAS 是 ARM 架构 (DS218/DS420j 等),但镜像没多架构。等 CI 跑过多架构构建 (Phase 6) 后重试,或本地 `docker build` 自建
- **端口冲突**: NAS 的 3000 已被其他服务占用 → `.env` 改 `APP_PORT=3001`
- **数据库连不上**: Container Manager 项目日志看 postgres 是否 healthy;entrypoint 等待 60s 后超时退出
- **卷权限**: DSM 默认 root 跑容器,通常无问题。若启用非 root 用户,把 `/volume1/docker/volumes/balthasar_pg_data_simple` 所有者改为 `999:999` (postgres 容器内 UID)
- **忘记关注册**: 第二个陌生人可能注册 → 立即把 `ALLOW_REGISTRATION=false` 并重启,然后查 `docker compose exec postgres psql -U balthasar -c "SELECT id, email, created_at FROM \"user\";"` 删陌生人

---

## 场景 B: 通用 Docker 部署 (Linux / macOS / WSL2)

适用于任何装了 Docker 24+ 与 Compose v2+ 的主机。Synology 之外的家用 PC / VPS / 开发机 / 树莓派都走这套。

### 步骤 1: 克隆仓库 + 配置 .env

```bash
git clone https://github.com/AZenking/balthasar.git
cd balthasar

cp deploy/simple/.env.simple.example deploy/simple/.env

# 必填两项:
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> deploy/simple/.env
# 用编辑器把 .env 里的 BETTER_AUTH_URL 改成实际访问 URL

# 首次部署:临时开注册
sed -i.bak 's/^# ALLOW_REGISTRATION=true/ALLOW_REGISTRATION=true/' deploy/simple/.env
sed -i.bak 's/^# NEXT_PUBLIC_ALLOW_REGISTRATION=true/NEXT_PUBLIC_ALLOW_REGISTRATION=true/' deploy/simple/.env
```

### 步骤 2: 一键启动

```bash
make simple-up
# 等价: docker compose -f deploy/simple/docker-compose.simple.yml --env-file deploy/simple/.env up -d
```

等待 60 秒内两个容器都 healthy:

```bash
make simple-ps
# 期望: balthasar-app  Up (healthy), balthasar-pg  Up (healthy)
```

### 步骤 3: 验证 + 注册首用户

```bash
curl http://localhost:3000/healthz                                # 200 ok
curl -I http://localhost:3000/api/v1/transactions                  # 401 (REST 端点正常)
```

浏览器 `http://localhost:3000` → 注册 → 自动跳 Dashboard。这个账号即 admin。

### 步骤 4: 关闭注册

```bash
sed -i.bak 's/^ALLOW_REGISTRATION=true/ALLOW_REGISTRATION=false/' deploy/simple/.env
sed -i.bak 's/^NEXT_PUBLIC_ALLOW_REGISTRATION=true/NEXT_PUBLIC_ALLOW_REGISTRATION=false/' deploy/simple/.env
make simple-down && make simple-up
```

验证关闭:
```bash
curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/sign-up   # 404
```

### 内网 / VPN / Cloudflare Tunnel 场景

如果源站只走 HTTP,不在意 TLS:

- 保持 `BETTER_AUTH_URL=http://<内网-IP>:3000`
- 用 Cloudflare Tunnel / Tailscale / SSH 隧道加密外部访问
- 不需要在容器栈里加反向代理

### 常用命令

```bash
make simple-logs                 # 跟踪 app 日志
make simple-logs SVC=postgres    # 跟踪 db 日志
make simple-down                 # 停止 (保留卷)
make simple-up                   # 再次启动
```

---

## 场景 C: 升级与备份

### 升级到新版本

修改 `.env` 中的 `DOCKER_TAG`,然后 pull + restart:

```bash
make simple-upgrade TAG=1.0.0
# 内部: sed 改 .env DOCKER_TAG → docker compose pull → docker compose up -d
# entrypoint 自动跑新版本数据库迁移
```

应用停机 < 60 秒 (镜像拉取时间另算)。数据完整保留。

### 手动备份

```bash
make simple-backup
# 产物: ./backups/backup-2026-07-08.sql.gz (Synology 在 BACKUP_DIR 指定路径)

# 改输出路径:
make simple-backup BACKUP_DIR=/volume1/backup/balthasar
```

1000 笔交易约 500 KB (gzip 压缩比 ≥ 5:1)。

### 从备份恢复

```bash
make simple-restore DATE=2026-07-08
# 内部: 停 app → gunzip → psql restore → 启 app
# 5 秒倒计时取消窗口,文件不存在则报错退出
```

⚠️ **恢复会覆盖当前所有数据**,无确认提示。

### 危险操作警告

- `docker compose down -v` 会**删除数据卷**,日常用 `make simple-down` 即可 (不带 `-v`)
- `docker compose rm -fsv` 同上
- 直接删 `/volume1/docker/volumes/balthasar_pg_data_simple/` 会丢全部数据


