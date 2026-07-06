# Quickstart: 001-auth-family (v2.0.0 T3 Stack) 验证指南

**Date**: 2026-07-06
**Purpose**: 端到端验证本 feature 的关键用户故事与成功标准。本文档是**验证脚本**,不是实现文档。

---

## 前置条件

- Node.js 20 LTS 已安装
- Docker 已安装并能运行
- `pnpm` 已安装
- 仓库根目录已是 T3 Stack 工程 (本 feature 期间由 tasks 创建)
- `.env` 已配置 (见 [research.md](./research.md) Q8)

```bash
# .env 示例
DATABASE_URL=postgres://balthasar:balthasar@localhost:5432/balthasar
BETTER_AUTH_SECRET=<生成 32 字节随机串>
BETTER_AUTH_URL=http://localhost:3000
NODE_ENV=development
```

生成 BETTER_AUTH_SECRET:
```bash
openssl rand -base64 32
```

---

## 启动开发环境

```bash
# 1. 起 Postgres
docker run -d --name balthasar-pg \
  -e POSTGRES_USER=balthasar \
  -e POSTGRES_PASSWORD=balthasar \
  -e POSTGRES_DB=balthasar \
  -p 5432:5432 \
  postgres:16-alpine

# 2. 安装依赖 (首次)
pnpm install

# 3. 应用 Drizzle 迁移 (含 Better-Auth 表)
pnpm db:migrate

# 4. 启动 Next.js (开发模式)
pnpm dev   # 监听 http://localhost:3000
```

---

## 验证 US1: 注册 + 自动建家庭

**对应 SC**: SC-001 (60s 内完成) / SC-005 (1:1:1 严格关系) / SC-006 (并发只一成功)

### 浏览器路径 (UX 验证)

1. 打开 `http://localhost:3000/register`
2. 填邮箱 `charles@example.com` + 密码 `correct-horse-battery-staple`
3. 提交 → 自动跳转 `/dashboard` (本 feature 暂未实现 dashboard,跳 404 也算通过)
4. 检查浏览器 DevTools > Application > Cookies,应有 `better-auth.session_token` (HttpOnly; SameSite=Lax)

### tRPC 路径 (机器验证)

```bash
# 用任意 HTTP 客户端调 tRPC mutation (内部走 POST)
curl -i -X POST http://localhost:3000/api/trpc/auth.register \
  -H 'Content-Type: application/json' \
  -d '{
    "json": {
      "email": "charles@example.com",
      "password": "correct-horse-battery-staple"
    }
  }'
```

**期望**:
- HTTP 200,tRPC response body 含 `result.data.user/family/member`
- Set-Cookie 含 `better-auth.session_token` (HttpOnly; Secure 在生产生效)
- 响应体**不**含 `password` / `passwordHash` / `token`

**DB 验证** (单事务原子写,SC-005):
```sql
SELECT
  (SELECT COUNT(*) FROM users WHERE email='charles@example.com') AS users,
  (SELECT COUNT(*) FROM families f JOIN users u ON u.id = f.owner_user_id) AS families,
  (SELECT COUNT(*) FROM members m JOIN users u ON u.id = m.user_id) AS members;
-- 期望: 1, 1, 1
```

**并发测试** (SC-006):
```bash
seq 5 | xargs -P5 -I{} curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST http://localhost:3000/api/trpc/auth.register \
  -H 'Content-Type: application/json' \
  -d '{"json":{"email":"concurrent@example.com","password":"same-pass-123"}}'
# 期望: 恰好一个 200,其余 409
```

---

## 验证 US2: 登录 + 锁定

**对应 SC**: SC-002 (5s P95) / SC-007 (锁定生效)

```bash
# 正常登录
curl -i -X POST http://localhost:3000/api/trpc/auth.login \
  -H 'Content-Type: application/json' \
  -d '{
    "json": {
      "email": "charles@example.com",
      "password": "correct-horse-battery-staple"
    }
  }'
# 期望: 200 + Set-Cookie
```

```bash
# 失败 5 次 (SC-007)
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:3000/api/trpc/auth.login \
    -H 'Content-Type: application/json' \
    -d '{"json":{"email":"charles@example.com","password":"wrong-pass-xxxx"}}' \
    -w '\n%{http_code}\n'
done
# 期望: 5 次 401 UNAUTHORIZED

# 第 6 次正确密码 (Clarification Q4 锁定 UX)
curl -i -X POST http://localhost:3000/api/trpc/auth.login \
  -H 'Content-Type: application/json' \
  -d '{
    "json": {
      "email": "charles@example.com",
      "password": "correct-horse-battery-staple"
    }
  }'
# 期望: tRPC error 含 data.retryAfterSeconds (锁定中)
```

**计时泄漏** (FR-007 防御):
```bash
# Better-Auth 默认 constant-time,验证生效
time curl -s -X POST .../auth.login -d '{"json":{"email":"nonexistent@x.com","password":"x"}}'
time curl -s -X POST .../auth.login -d '{"json":{"email":"charles@example.com","password":"x"}}'
# 期望: 偏差 < 50ms
```

---

## 验证 US3: 登出

```bash
# 用 US1 拿到的 cookie
SESSION='better-auth.session_token=...'

curl -i -X POST http://localhost:3000/api/trpc/auth.logout \
  -H "Cookie: $SESSION"
# 期望: 200 + Set-Cookie Max-Age=0

# 验证旧 cookie 已失效 (SC-008)
curl -i http://localhost:3000/api/trpc/auth.me \
  -H "Cookie: $SESSION"
# 期望: 401 UNAUTHORIZED

# 二次登出 (幂等)
curl -i -X POST http://localhost:3000/api/trpc/auth.logout \
  -H "Cookie: $SESSION"
# 期望: 200 (无错误)
```

---

## 验证 US4: 会话查询与审计

```bash
# 注册新账号,跑全套认证流程
curl -X POST .../auth.register -d '{"json":{"email":"alice@x.com","password":"alice-pass-123"}}'
COOKIE='better-auth.session_token=...'

# 故意失败一次
curl -X POST .../auth.login -d '{"json":{"email":"alice@x.com","password":"wrong"}}'

# 登出再登录
curl -X POST .../auth.logout -H "Cookie: $COOKIE"
curl -X POST .../auth.login -d '{"json":{"email":"alice@x.com","password":"alice-pass-123"}}'

# 查询当前会话
curl http://localhost:3000/api/trpc/auth.me -H "Cookie: $COOKIE"
# 期望: 200, result.data 含 user/family/member 三 ID

# 查询审计事件 (FR-017)
curl http://localhost:3000/api/trpc/auth.auditEvents -H "Cookie: $COOKIE"
# 期望: 200, events 数组含
#   - register_success
#   - login_failure
#   - logout
#   - login_success
# 按 occurredAt DESC 排序
# 任一字段均不得为 password / token (SC-010)
```

---

## 验证 SC-009: 30 天滑动续期 (Better-Auth updateAge=1d)

```bash
# 集成测试场景 (手动验证可在 DB 层改时间戳):
psql -c "UPDATE sessions SET expires_at = now() - interval '29 days' WHERE user_id = ...;"

curl -i http://localhost:3000/api/trpc/auth.me -H "Cookie: $COOKIE"
# 期望: 200 (29 天 < 30 天,会话仍有效)

# 验证 Better-Auth 滑动续期 (updateAge=1d: 每天最多更新一次)
psql -c "SELECT expires_at FROM sessions WHERE user_id = ...;"
# 期望: expires_at 已被更新为 now + 30 days
```

---

## 验证 SC-011: 注册 IP 限流

```bash
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "$i: %{http_code}\n" \
    -X POST http://localhost:3000/api/trpc/auth.register \
    -H 'Content-Type: application/json' \
    -d "{\"json\":{\"email\":\"u${i}@x.com\",\"password\":\"pass-1234\"}}"
done
# 期望: 1-10 = 200, 11 = 429
# 验证 DB: 11 个 user/family/member 行数 = 10 (第 11 个未写入, SC-011)
```

---

## 验证 SC-004: 密码与 token 不泄漏

```bash
# 抓包验证
tcpdump -i lo0 -A port 3000 | grep -i 'password\|passwordHash\|token'
# 期望: 0 匹配 (启动后跑任意流程,均不应出现敏感字段)

# 日志验证 (Next.js 默认 stdout)
pnpm dev 2>&1 | grep -i 'password'
# 期望: 0 匹配

# auth_events.metadata jsonb 验证
psql -c "SELECT metadata FROM auth_events LIMIT 100;"
# 期望: metadata 中不出现 password / token / ip / ua 字段
```

---

## 测试套件运行

```bash
# 全套
pnpm test

# 仅单元 (无 DB)
pnpm test:unit

# 仅 procedure (createCaller,无 DB)
pnpm test:procedure

# 仅集成 (起 testcontainers Postgres)
pnpm test:integration

# 覆盖率
pnpm test:coverage
# 期望: domain > 90%, procedure > 80%, integration > 70%
```

---

## 通过判据 (Definition of Done)

| SC | 验证方式 | 状态 |
|---|---|---|
| SC-001 (60s 注册) | 浏览器手动计时 + 性能测试 | ⏳ |
| SC-002 (5s 登录 P95) | autocannon 性能测试 | ⏳ |
| SC-003 (99% 单次成功) | autocannon 错误率 < 1% | ⏳ |
| SC-004 (零密码泄漏) | 抓包 + grep + DB 抽查 | ⏳ |
| SC-005 (1:1:1) | DB COUNT 查询 | ⏳ |
| SC-006 (并发只一成功) | xargs 并发脚本 | ⏳ |
| SC-007 (锁定生效) | 5 失败 + 6 正确仍拒 | ⏳ |
| SC-008 (登出失效) | 旧 cookie 访问 401 | ⏳ |
| SC-009 (30 天滑动) | DB 时间戳操纵 + Better-Auth updateAge | ⏳ |
| SC-010 (审计查询 < 5s) | 1k 行压测 | ⏳ |
| SC-011 (注册 IP 限流) | 第 11 次 429 | ⏳ |

全部 ⏳ → ✅ 即可进入实现阶段评审。
