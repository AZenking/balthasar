# Quickstart: 011-open-api 验证指南

**Date**: 2026-07-07

## 前置条件

- 001-010 全部就绪,`pnpm dev` 运行
- 已注册用户 + 账户 + 分类

## 验证 US1: API Key 管理

```bash
# 1. 登录拿 cookie
curl -s -c /tmp/cookies_api.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"apiuser@example.com","password":"correct-horse-battery-staple","name":"apiuser"}' > /dev/null

# 2. 创建账户 (API 需要账户)
curl -s -b /tmp/cookies_api.txt -X POST http://localhost:3000/api/trpc/account.create \
  -H 'Content-Type: application/json' \
  -d '{"json":{"name":"测试卡","currency":"CNY","initialBalance":0}}' > /dev/null

# 3. 生成 API Key
RESULT=$(curl -s -b /tmp/cookies_api.txt -X POST http://localhost:3000/api/trpc/apiKey.create \
  -H 'Content-Type: application/json' \
  -d '{"json":{"name":"测试Key"}}')
echo "$RESULT" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']['data']['json']
print(f'  ✓ Key 明文: {r.get(\"plainKey\", \"?\")[:20]}...')
print(f'  ✓ Key ID: {r.get(\"id\", \"?\")[:12]}...')
"

# 提取 Key 明文
API_KEY=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json']['plainKey'])")

# 4. 列表
curl -s -b /tmp/cookies_api.txt "http://localhost:3000/api/trpc/apiKey.list" | python3 -c "
import json, sys
items = json.load(sys.stdin)['result']['data']['json']
print(f'  ✓ Key 数: {len(items)}')
"
```

## 验证 US2: 新增交易

```bash
ACCOUNT_ID=$(curl -s -b /tmp/cookies_api.txt "http://localhost:3000/api/trpc/account.list" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")
CATEGORY_ID=$(curl -s -b /tmp/cookies_api.txt "http://localhost:3000/api/trpc/category.list?input=%7B%22json%22%3A%7B%22type%22%3A%22expense%22%7D%7D" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")

echo "=== POST /api/v1/transactions ==="
curl -s -i -X POST http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"expense\",\"accountId\":\"$ACCOUNT_ID\",\"categoryId\":\"$CATEGORY_ID\",\"amount\":\"35.50\",\"remark\":\"API测试\"}" \
  | python3 -c "
import sys
lines = sys.stdin.read()
print('  ✓ HTTP 201' if '201' in lines.split('\n')[0] else '  ✗ 非 201')
"

echo "=== 无 Key → 401 ==="
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST http://localhost:3000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","accountId":"x","categoryId":"x","amount":"1"}'

echo "=== 无效 Key → 401 ==="
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer bk_invalid" \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","accountId":"x","categoryId":"x","amount":"1"}'
```

## 验证 US3: 更新交易

```bash
# 拿刚创建的交易 ID
TX_ID=$(curl -s -b /tmp/cookies_api.txt "http://localhost:3000/api/trpc/transaction.list" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json']['items'][0]['id'])")

echo "=== PATCH /api/v1/transactions/:id ==="
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X PATCH "http://localhost:3000/api/v1/transactions/$TX_ID" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"remark":"API更新"}'
```

## 通过判据

| SC | 验证 | 状态 |
|---|---|---|
| SC-001 (5分钟集成) | 从 Key 到第一笔 | ⏳ |
| SC-002 (p95 < 500ms) | 计时 | ⏳ |
| SC-003 (无 Key 拒绝) | curl 401 | ⏳ |
| SC-004 (吊销拒绝) | 吊销后再调 | ⏳ |
| SC-005 (限流 429) | 61 次/分钟 | ⏳ |
| SC-006 (跨家庭拒绝) | 错误 accountId | ⏳ |
| SC-007 (审计齐全) | DB 验证 | ⏳ |
