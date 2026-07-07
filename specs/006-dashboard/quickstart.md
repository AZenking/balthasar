# Quickstart: 006-dashboard 验证指南

**Date**: 2026-07-07

## 前置条件

- 001-005 已完成,`pnpm dev` 运行
- 已注册用户 + 账户 + 至少几笔当月交易

## 准备

```bash
curl -s -c /tmp/cookies_dash.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"dashuser@example.com","password":"correct-horse-battery-staple","name":"dashuser"}' > /dev/null

# 创建账户
curl -s -b /tmp/cookies_dash.txt -X POST http://localhost:3000/api/trpc/account.create \
  -H 'Content-Type: application/json' \
  -d '{"json":{"name":"招商银行卡","currency":"CNY","initialBalance":100000}}' > /dev/null

ACCOUNT_ID=$(curl -s -b /tmp/cookies_dash.txt "http://localhost:3000/api/trpc/account.list" | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")

# 拿分类
EXPENSE_CAT=$(curl -s -b /tmp/cookies_dash.txt "http://localhost:3000/api/trpc/category.list?input=%7B%22json%22%3A%7B%22type%22%3A%22expense%22%7D%7D" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")
EXPENSE_CAT2=$(curl -s -b /tmp/cookies_dash.txt "http://localhost:3000/api/trpc/category.list?input=%7B%22json%22%3A%7B%22type%22%3A%22expense%22%7D%7D" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][1]['id'])")
INCOME_CAT=$(curl -s -b /tmp/cookies_dash.txt "http://localhost:3000/api/trpc/category.list?input=%7B%22json%22%3A%7B%22type%22%3A%22income%22%7D%7D" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")

# 创建交易: 3 笔支出 (2 个分类) + 1 笔收入
curl -s -b /tmp/cookies_dash.txt -X POST http://localhost:3000/api/trpc/transaction.create \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"type\":\"expense\",\"accountId\":\"$ACCOUNT_ID\",\"categoryId\":\"$EXPENSE_CAT\",\"amount\":5000,\"remark\":\"午餐\"}}" > /dev/null
curl -s -b /tmp/cookies_dash.txt -X POST http://localhost:3000/api/trpc/transaction.create \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"type\":\"expense\",\"accountId\":\"$ACCOUNT_ID\",\"categoryId\":\"$EXPENSE_CAT\",\"amount\":3000,\"remark\":\"咖啡\"}}" > /dev/null
curl -s -b /tmp/cookies_dash.txt -X POST http://localhost:3000/api/trpc/transaction.create \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"type\":\"expense\",\"accountId\":\"$ACCOUNT_ID\",\"categoryId\":\"$EXPENSE_CAT2\",\"amount\":2000,\"remark\":\"地铁\"}}" > /dev/null
curl -s -b /tmp/cookies_dash.txt -X POST http://localhost:3000/api/trpc/transaction.create \
  -H 'Content-Type: application/json' \
  -d "{\"json\":{\"type\":\"income\",\"accountId\":\"$ACCOUNT_ID\",\"categoryId\":\"$INCOME_CAT\",\"amount\":20000,\"remark\":\"工资\"}}" > /dev/null
echo "✓ 创建 4 笔交易 (3 支出 + 1 收入)"
```

## 验证 dashboard.summary

```bash
curl -s -b /tmp/cookies_dash.txt "http://localhost:3000/api/trpc/dashboard.summary" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']['data']['json']

print('=== 当月收支 ===')
print(f'  monthIncome:  {r[\"monthIncome\"]} (期望 20000)')
print(f'  monthExpense: {r[\"monthExpense\"]} (期望 10000)')
print(f'  monthNet:     {r[\"monthNet\"]} (期望 10000)')

print()
print('=== 最近交易 (5 笔) ===')
for t in r['recentTransactions']:
    print(f'  {t[\"type\"]:8} {t[\"amount\"]:>6} {t[\"categoryIcon\"]} {t[\"categoryName\"]:6} [{t[\"accountName\"]}] {t[\"remark\"]}')

print()
print('=== 支出分类占比 ===')
for c in r['topExpenseCategories']:
    print(f'  {c[\"categoryIcon\"]} {c[\"categoryName\"]:6} {c[\"amount\"]:>6} ({c[\"percentage\"]}%)')

# Assertions
ok = (
    r['monthIncome'] == 20000 and
    r['monthExpense'] == 10000 and
    r['monthNet'] == 10000 and
    len(r['recentTransactions']) == 4 and  # only 4 created, not 5
    len(r['topExpenseCategories']) == 2    # 2 expense categories
)
print()
print(f'{\"✓ ALL PASS\" if ok else \"✗ MISMATCH\"} ')
"
```

## 通过判据

| SC | 验证 | 状态 |
|---|---|---|
| SC-001 (2s 内完整统计) | 手动计时 | ⏳ |
| SC-002 (P95 < 500ms) | 性能测试 | ⏳ |
| SC-003 (汇总准确) | income=20000, expense=10000, net=10000 | ⏳ |
| SC-004 (percentage 准确) | 餐饮 80% (8000/10000), 交通 20% (2000/10000) | ⏳ |
| SC-005 (跨家庭隔离) | 集成测试 | ⏳ |
| SC-006 (无交易→全零) | 集成测试 | ⏳ |
| SC-007 (最近 5 笔) | len ≤ 5 | ⏳ |
