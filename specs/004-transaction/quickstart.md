# Quickstart: 004-transaction 验证指南

**Date**: 2026-07-07
**Purpose**: 端到端验证本 feature 的关键用户故事与成功标准。

---

## 前置条件

- 已完成 `001-auth-family` + `002-account` + `003-category`
- `docker compose up -d postgres` + `pnpm db:migrate` 已跑过 (含 0001/0002/0003)
- `pnpm dev` 在 `http://localhost:3000` 运行
- 至少 1 个已注册用户 (用于鉴权测试)
- 该用户家庭下至少有 1 个未归档账户 (002-account.create)

---

## 准备: 登录 + 创建账户

```bash
curl -s -c /tmp/cookies_tx.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"txuser@example.com","password":"correct-horse-battery-staple","name":"txuser"}' \
  > /dev/null

# 创建一个账户 (002-account)
curl -s -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/account.create \
  -H 'Content-Type: application/json' \
  -d '{"json":{"name":"招商银行卡","currency":"CNY","initialBalance":100000}}' > /dev/null

# 拿账户 ID + 分类 ID
ACCOUNT_ID=$(curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/account.list" | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")
EXPENSE_CAT_ID=$(curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/category.list?input=%7B%22json%22%3A%7B%22type%22%3A%22expense%22%7D%7D" | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")
INCOME_CAT_ID=$(curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/category.list?input=%7B%22json%22%3A%7B%22type%22%3A%22income%22%7D%7D" | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")

echo "ACCOUNT_ID=$ACCOUNT_ID"
echo "EXPENSE_CAT_ID=$EXPENSE_CAT_ID"
echo "INCOME_CAT_ID=$INCOME_CAT_ID"
```

---

## 验证 US1: 创建交易

**对应 SC**: SC-001 (10s 热路径) / SC-002 (create p95 < 300ms) / SC-008 (type/category 匹配) / SC-009 (已归档账户不可用)

```bash
echo "=== 创建支出交易 ==="
RESP=$(curl -s -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/transaction.create \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"type\":\"expense\",\"accountId\":\"$ACCOUNT_ID\",\"categoryId\":\"$EXPENSE_CAT_ID\",\"amount\":5000,\"remark\":\"午餐\"}}")
echo "$RESP" | python3 -c "
import json, sys
data = json.load(sys.stdin)
r = data.get('result', {}).get('data', {}).get('json', {})
if r:
    print(f'  ✓ id: {r[\"id\"][:12]}...')
    print(f'  ✓ type: {r[\"type\"]}')
    print(f'  ✓ amount: {r[\"amount\"]} (前端正数,展示用)')
    print(f'  ✓ accountName: {r.get(\"accountName\")}')
    print(f'  ✓ categoryName: {r.get(\"categoryName\")}')
else:
    print('  ✗ error:', json.dumps(data.get('error', {}), ensure_ascii=False)[:200])
"

echo ""
echo "=== SC-008: type=expense + income categoryId → 400 ==="
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/transaction.create \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"type\":\"expense\",\"accountId\":\"$ACCOUNT_ID\",\"categoryId\":\"$INCOME_CAT_ID\",\"amount\":5000}}")
echo "  type/category 不匹配 → HTTP $STATUS (期望 400)"

echo ""
echo "=== FR-003: amount ≤ 0 → 400 ==="
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/transaction.create \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"type\":\"expense\",\"accountId\":\"$ACCOUNT_ID\",\"categoryId\":\"$EXPENSE_CAT_ID\",\"amount\":0}}")
echo "  amount=0 → HTTP $STATUS (期望 400)"

echo ""
echo "=== FR-015: 跨家庭 accountId → 400 ==="
# 注册第二个用户,拿其账户 ID
curl -s -c /tmp/cookies_tx2.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"txuser2@example.com","password":"correct-horse-battery-staple","name":"txuser2"}' > /dev/null
curl -s -b /tmp/cookies_tx2.txt -X POST http://localhost:3000/api/trpc/account.create \
  -H 'Content-Type: application/json' \
  -d '{"json":{"name":"other","currency":"CNY","initialBalance":0}}' > /dev/null
OTHER_ACCOUNT_ID=$(curl -s -b /tmp/cookies_tx2.txt "http://localhost:3000/api/trpc/account.list" | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")

STATUS=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/transaction.create \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"type\":\"expense\",\"accountId\":\"$OTHER_ACCOUNT_ID\",\"categoryId\":\"$EXPENSE_CAT_ID\",\"amount\":5000}}")
echo "  跨家庭 accountId → HTTP $STATUS (期望 400)"
```

---

## 验证 US2: 查询交易 (含 JOIN)

```bash
# 拿刚创建的交易 ID
TX_ID=$(curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/transaction.list" | \
  python3 -c "import json,sys; items=json.load(sys.stdin)['result']['data']['json']['items']; print(items[0]['id'])")

echo "=== get 返回完整字段 + JOIN ==="
curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/transaction.get?input=%7B%22json%22%3A%7B%22id%22%3A%22$TX_ID%22%7D%7D" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']['data']['json']
print(f'  ✓ id: {r[\"id\"][:12]}...')
print(f'  ✓ accountName: {r[\"accountName\"]}')
print(f'  ✓ categoryName: {r[\"categoryName\"]}')
print(f'  ✓ categoryIcon: {r[\"categoryIcon\"]}')
print(f'  ✓ amount: {r[\"amount\"]} (响应正数)')
"

echo ""
echo "=== FR-014: 跨家庭 get → 404 ==="
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/cookies_tx2.txt \
  "http://localhost:3000/api/trpc/transaction.get?input=%7B%22json%22%3A%7B%22id%22%3A%22$TX_ID%22%7D%7D")
echo "  用户 B 查用户 A 交易 → HTTP $STATUS (期望 404)"
```

---

## 验证 US3: 编辑交易 (LWW)

```bash
echo "=== 编辑 remark ==="
curl -s -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/transaction.update \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"id\":\"$TX_ID\",\"remark\":\"午餐 (改备注)\"}}" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']['data']['json']
print(f'  ✓ remark: {r[\"remark\"]}')
"

echo ""
echo "=== SC-005: updatedAt 自动更新 ==="
curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/transaction.get?input=%7B%22json%22%3A%7B%22id%22%3A%22$TX_ID%22%7D%7D" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']['data']['json']
print(f'  updatedAt: {r[\"updatedAt\"]}')
print(f'  createdAt: {r[\"createdAt\"]}')
print(f'  ✓ updatedAt > createdAt: {r[\"updatedAt\"] > r[\"createdAt\"]}')
"
```

---

## 验证 US4: 删除交易 (硬删除)

```bash
echo "=== 删除 ==="
curl -s -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/transaction.delete \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"id\":\"$TX_ID\"}}" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']['data']['json']
print(f'  ✓ success: {r[\"success\"]}')"

echo ""
echo "=== SC-006: 重复删除 → 404 ==="
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/transaction.delete \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"id\":\"$TX_ID\"}}")
echo "  重复删除 → HTTP $STATUS (期望 404,非 500)"

echo ""
echo "=== DB 验证行已消失 ==="
docker exec balthasar-pg psql -U balthasar -d balthasar -t -A -c \
  "SELECT COUNT(*) FROM transactions WHERE id = '$TX_ID';"
# 期望: 0
```

---

## DB 层验证

```bash
echo "=== signed amount 验证 (Q1) ==="
docker exec balthasar-pg psql -U balthasar -d balthasar -c \
  "SELECT type, amount, remark FROM transactions
   WHERE family_id = (SELECT f.id FROM families f JOIN \"user\" u ON u.id=f.owner_user_id WHERE u.email='txuser@example.com')
   ORDER BY occurred_at DESC LIMIT 5;"
# 期望: expense 行 amount 为负,income 行为正

echo ""
echo "=== 审计事件齐全 ==="
docker exec balthasar-pg psql -U balthasar -d balthasar -c \
  "SELECT event_type, COUNT(*) FROM transaction_events te
   JOIN transactions t ON t.id = te.transaction_id
   JOIN families f ON f.id = t.family_id
   JOIN \"user\" u ON u.id = f.owner_user_id
   WHERE u.email = 'txuser@example.com'
   GROUP BY event_type;"
# 期望: transaction_created / transaction_edited 至少各 1 条
#       (deleted 因为 ON DELETE CASCADE,审计行也删了 —— SC-006 验证后不再可见)
```

---

## 通过判据 (Definition of Done)

| SC | 验证方式 | 状态 |
|---|---|---|
| SC-001 (10s 创建) | 手动计时 | ⏳ |
| SC-002 (create P95 < 300ms) | 性能测试 | ⏳ |
| SC-003 (get P95 < 100ms) | 性能测试 | ⏳ |
| SC-004 (跨家庭 100% 拒绝) | 集成测试 | ⏳ |
| SC-005 (updatedAt 更新) | 集成测试 | ⏳ |
| SC-006 (删除后 404) | 集成测试 | ⏳ |
| SC-007 (审计无敏感字段) | DB grep | ⏳ |
| SC-008 (type/category 匹配) | 集成测试 | ⏳ |
| SC-009 (已归档账户不可用) | 集成测试 | ⏳ |
| SC-010 (amount 分单位) | DB 验证 signed | ⏳ |

全部 ⏳ → ✅ 即可进入实现阶段评审。
