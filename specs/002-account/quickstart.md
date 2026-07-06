# Quickstart: 002-account 验证指南

**Date**: 2026-07-06
**Purpose**: 端到端验证本 feature 的关键用户故事与成功标准。本文档是**验证脚本**,不是实现文档。

---

## 前置条件

- 已完成 `001-auth-family` feature,`docker-compose up -d postgres` 与 `pnpm db:migrate` 已跑过
- 001 的注册/登录流程可工作 (有至少 1 个已注册用户)
- `pnpm dev` 在 `http://localhost:3000` 运行

---

## 准备: 注册 + 登录拿 cookie

```bash
# 注册 (Better-Auth 直连端点,自动 Set-Cookie)
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -d '{"email":"accountuser@example.com","password":"correct-horse-battery-staple","name":"accountuser"}'

# Cookie 自动存到 /tmp/cookies.txt
```

---

## 验证 US1: 创建账户

**对应 SC**: SC-001 (30s 内完成) / SC-005 (跨家庭隔离) / SC-007 (初始余额只读)

```bash
# 创建第一个账户
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.create \
  -H 'Content-Type: application/json' \
  -d '{"json":{"name":"招商银行卡","currency":"CNY","initialBalance":100000}}' \
  -w '\nHTTP %{http_code}\n' | head -5
```

**期望**:
- HTTP 200
- Body 含 `id` (UUID v7)、`familyId`、`name:"招商银行卡"`、`currency:"CNY"`、`initialBalance:100000` (= 1000 元,分为单位)、`archivedAt:null`
- Body **不含** `password` / `token`

**字段级错误 (FR-002 / FR-003 / FR-004)**:
```bash
# 名称空 → 400
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.create \
  -H 'Content-Type: application/json' \
  -d '{"json":{"name":"","currency":"CNY","initialBalance":0}}' | grep -o '"code":[^,]*' | head -1
# 期望: "code":-32001 (BAD_REQUEST 系列)

# 币种不在白名单 → 400
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.create \
  -H 'Content-Type: application/json' \
  -d '{"json":{"name":"test","currency":"RMB","initialBalance":0}}' | grep -o '"code":[^,]*' | head -1
# 期望: "code":-32001
```

---

## 验证 US2: 列表查询

**对应 SC**: SC-002 (P95 < 200ms) / FR-007 (默认排除归档) / FR-008 (includeArchived)

```bash
# 创建 3 个账户 (含 1 个稍后归档的)
for NAME in "现金" "微信零钱" "支付宝"; do
  curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.create \
    -H 'Content-Type: application/json' \
    -d "{\"json\":{\"name\":\"$NAME\",\"currency\":\"CNY\",\"initialBalance\":0}}" > /dev/null
done

# 列表 (默认排除归档)
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/account.list" | python3 -c "
import json, sys
data = json.load(sys.stdin)
items = data['result']['data']['json']
print(f'账户数: {len(items)}')
for a in items:
    print(f'  - {a[\"name\"]} ({a[\"currency\"]}) = {a[\"initialBalance\"]} 分, archived={a[\"archivedAt\"] is not None}')
"
```

**期望**:
- 账户数 ≥ 4 (含招商银行卡 + 3 个新建)
- 按 `createdAt` 倒序
- 全部 `archivedAt = null`

**性能 (SC-002)**:
```bash
# 100 个账户规模 (先批量创建)
for i in $(seq 1 100); do
  curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.create \
    -H 'Content-Type: application/json' \
    -d "{\"json\":{\"name\":\"bench-$i\",\"currency\":\"CNY\",\"initialBalance\":0}}" > /dev/null &
done
wait

# 测 P95
for i in $(seq 1 20); do
  curl -s -b /tmp/cookies.txt -o /dev/null \
    -w "%{time_total}\n" \
    "http://localhost:3000/api/trpc/account.list"
done | sort -n | tail -1
# 期望: 最大值 < 0.2s (P95 近似)
```

---

## 验证 US3: 编辑账户

**对应 SC**: SC-006 (updatedAt 更新) / SC-007 (初始余额不可改) / FR-011 (归档不可编辑)

```bash
# 获取第一个账户的 ID
ACCOUNT_ID=$(curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/account.list" | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")

# 编辑名称
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.update \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"id\":\"$ACCOUNT_ID\",\"name\":\"招商银行卡 (已改名)\"}}" | python3 -m json.tool | head -10

# 尝试改 initialBalance → 服务端忽略或拒绝 (SC-007)
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.update \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"id\":\"$ACCOUNT_ID\",\"initialBalance\":999999}}" | python3 -m json.tool
# 期望: 字段被忽略 (DB 中 initialBalance 不变) 或返回 BAD_REQUEST
```

---

## 验证 US4: 归档/取消归档 (幂等)

**对应 SC**: SC-004 (幂等)

```bash
# 归档
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.archive \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"id\":\"$ACCOUNT_ID\"}}" | python3 -m json.tool
# 期望: archivedAt 不为 null

# 重复归档 (幂等)
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.archive \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"id\":\"$ACCOUNT_ID\"}}" | python3 -m json.tool
# 期望: 200 (无错误),archivedAt 仍为原值

# 默认列表不再包含该账户
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/account.list" | \
  python3 -c "import json,sys; data=json.load(sys.stdin); print('列表中是否含归档账户:', any(a['id'] == '$ACCOUNT_ID' for a in data['result']['data']['json']))"
# 期望: False

# includeArchived=true 列表含归档
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/account.list?input=%7B%22json%22%3A%7B%22includeArchived%22%3Atrue%7D%7D" | \
  python3 -c "import json,sys; data=json.load(sys.stdin); print('完整列表含归档账户:', any(a['id'] == '$ACCOUNT_ID' for a in data['result']['data']['json']))"
# 期望: True

# 取消归档
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.unarchive \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"id\":\"$ACCOUNT_ID\"}}" | python3 -m json.tool
# 期望: archivedAt = null

# 已归档账户不可编辑 (先归档再 update)
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.archive \
  -H 'Content-Type: application/json' -d "{\"json\":{\"id\":\"$ACCOUNT_ID\"}}" > /dev/null

curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/trpc/account.update \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"id\":\"$ACCOUNT_ID\",\"name\":\"should-fail\"}}" | python3 -m json.tool
# 期望: 错误码 (CONFLICT 或 BAD_REQUEST)
```

---

## 验证 SC-003: 跨家庭访问返回 404

```bash
# 注册第二个用户 (不同家庭)
curl -s -c /tmp/cookies2.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"otheruser@example.com","password":"correct-horse-battery-staple","name":"otheruser"}'

# 用户 2 尝试编辑用户 1 的账户 (期望 NOT_FOUND,而非 FORBIDDEN)
curl -s -b /tmp/cookies2.txt -X POST http://localhost:3000/api/trpc/account.update \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"id\":\"$ACCOUNT_ID\",\"name\":\"stolen\"}}" | python3 -m json.tool
# 期望: code = NOT_FOUND (不区分"不存在"与"无权限")
```

---

## DB 层验证

```bash
# 验证账户表行数
docker exec balthasar-pg psql -U balthasar -d balthasar -c \
  "SELECT a.name, a.currency, a.initial_balance, a.archived_at, f.id as family_id
   FROM accounts a JOIN families f ON f.id = a.family_id
   JOIN \"user\" u ON u.id = f.owner_user_id
   WHERE u.email = 'accountuser@example.com';"

# 验证 account_events 审计齐全 (创建/编辑/归档/取消归档/归档)
docker exec balthasar-pg psql -U balthasar -d balthasar -c \
  "SELECT ae.event_type, ae.occurred_at, ae.before, ae.after
   FROM account_events ae
   JOIN accounts a ON a.id = ae.account_id
   JOIN families f ON f.id = a.family_id
   JOIN \"user\" u ON u.id = f.owner_user_id
   WHERE u.email = 'accountuser@example.com'
   ORDER BY ae.occurred_at DESC LIMIT 10;"
# 期望: 至少有 account_created、account_edited、account_archived、account_unarchived、account_archived 多条

# 验证 SC-004: account_events.before / .after 无敏感字段
docker exec balthasar-pg psql -U balthasar -d balthasar -t -A -c \
  "SELECT before::text || ' ' || after::text FROM account_events LIMIT 100;" | \
  grep -iE 'password|token|session' | head -5
# 期望: 0 行匹配
```

---

## 测试套件

```bash
pnpm test:unit         # currency / validate 纯函数
pnpm test:procedure    # account procedure 契约 (mock)
pnpm test:integration  # 真实 Postgres:跨家庭隔离、归档幂等、初始余额只读
```

---

## 通过判据 (Definition of Done)

| SC | 验证方式 | 状态 |
|---|---|---|
| SC-001 (30s 创建) | 手动计时 + 性能测试 | ⏳ |
| SC-002 (list P95 < 200ms) | 100 账户压测 | ⏳ |
| SC-003 (跨家庭 404) | 用户 2 访问用户 1 账户 → NOT_FOUND | ⏳ |
| SC-004 (归档幂等) | 重复归档/取消归档 200 | ⏳ |
| SC-005 (Unicode 名称) | 中文/emoji 名称创建成功 | ⏳ |
| SC-006 (updatedAt 更新) | 编辑后 updatedAt > createdAt | ⏳ |
| SC-007 (initialBalance 只读) | update 请求忽略该字段 | ⏳ |

全部 ⏳ → ✅ 即可进入实现阶段评审。
