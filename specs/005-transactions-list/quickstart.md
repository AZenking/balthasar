# Quickstart: 005-transactions-list 验证指南

**Date**: 2026-07-07

## 前置条件

- 001-004 已完成,`pnpm dev` 运行
- 已注册用户 + 账户 + 至少几笔交易

## 准备

```bash
curl -s -c /tmp/cookies_tx.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"txlist@example.com","password":"correct-horse-battery-staple","name":"txlist"}' > /dev/null

# 创建账户
curl -s -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/account.create \
  -H 'Content-Type: application/json' \
  -d '{"json":{"name":"招商银行卡","currency":"CNY","initialBalance":100000}}' > /dev/null

ACCOUNT_ID=$(curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/account.list" | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")

# 拿分类 ID
EXPENSE_CAT=$(curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/category.list?input=%7B%22json%22%3A%7B%22type%22%3A%22expense%22%7D%7D" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")
INCOME_CAT=$(curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/category.list?input=%7B%22json%22%3A%7B%22type%22%3A%22income%22%7D%7D" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")

# 创建 5 笔交易 (3 支出 + 2 收入)
for AMT in 5000 3000 8000; do
  curl -s -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/transaction.create \
    -H 'Content-Type: application/json' \
    -d "{\"json\":{\"type\":\"expense\",\"accountId\":\"$ACCOUNT_ID\",\"categoryId\":\"$EXPENSE_CAT\",\"amount\":$AMT,\"remark\":\"支出$AMT\"}}" > /dev/null
done
for AMT in 20000 5000; do
  curl -s -b /tmp/cookies_tx.txt -X POST http://localhost:3000/api/trpc/transaction.create \
    -H 'Content-Type: application/json' \
    -d "{\"json\":{\"type\":\"income\",\"accountId\":\"$ACCOUNT_ID\",\"categoryId\":\"$INCOME_CAT\",\"amount\":$AMT,\"remark\":\"收入$AMT\"}}" > /dev/null
done
echo "✓ 创建 5 笔交易 (3 支出 + 2 收入)"
```

## US1: 筛选

```bash
echo "=== type=expense 筛选 ==="
curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/transaction.list?input=%7B%22json%22%3A%7B%22type%22%3A%22expense%22%7D%7D" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']['data']['json']
print(f'  ✓ 账户数: {len(r[\"items\"])} (期望 3)')
"

echo "=== keyword 筛选 ==="
curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/transaction.list?input=%7B%22json%22%3A%7B%22keyword%22%3A%225000%22%7D%7D" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']['data']['json']
print(f'  ✓ 含 5000 的交易: {len(r[\"items\"])} (期望 2: 支出5000 + 收入5000)')
"
```

## US2: Summary

```bash
echo "=== includeSummary=true 全量小计 ==="
curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/transaction.list?input=%7B%22json%22%3A%7B%22includeSummary%22%3Atrue%7D%7D" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']['data']['json']
s = r.get('summary', {})
print(f'  ✓ income: {s.get(\"income\")} (期望 25000)')
print(f'  ✓ expense: {s.get(\"expense\")} (期望 16000)')
print(f'  ✓ net: {s.get(\"net\")} (期望 9000)')
"

echo "=== type=expense + summary ==="
curl -s -b /tmp/cookies_tx.txt "http://localhost:3000/api/trpc/transaction.list?input=%7B%22json%22%3A%7B%22type%22%3A%22expense%22%2C%22includeSummary%22%3Atrue%7D%7D" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']['data']['json']
s = r.get('summary', {})
print(f'  ✓ income: {s.get(\"income\")} (期望 0, 因为筛选 expense)')
print(f'  ✓ expense: {s.get(\"expense\")} (期望 16000)')
"
```

## 通过判据

| SC | 验证 | 状态 |
|---|---|---|
| SC-001 (2s 内列表+小计) | 手动计时 | ⏳ |
| SC-002 (P95 < 500ms) | 性能测试 | ⏳ |
| SC-003 (summary 准确) | income=25000, expense=16000, net=9000 | ⏳ |
| SC-004 (keyword 不区分大小写) | ILIKE 验证 | ⏳ |
| SC-005 (跨家庭 account 空列表) | 集成测试 | ⏳ |
| SC-006 (start>end 空列表) | 集成测试 | ⏳ |
| SC-007 (cursor+筛选连续) | 集成测试 | ⏳ |
