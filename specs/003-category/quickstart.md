# Quickstart: 003-category 验证指南

**Date**: 2026-07-06
**Purpose**: 端到端验证本 feature 的关键用户故事与成功标准。

---

## 前置条件

- 已完成 `001-auth-family` + `002-account`
- `docker compose up -d postgres` + `pnpm db:migrate` 已跑过 (含 0001/0002)
- `pnpm dev` 在 `http://localhost:3000` 运行
- 至少 1 个已注册用户 (用于鉴权测试)

---

## 准备: 登录拿 cookie

```bash
# 用 002 验证过的账号
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"categoryuser@example.com","password":"correct-horse-battery-staple","name":"categoryuser"}' \
  > /dev/null
```

---

## 验证 US1: 查询分类列表

**对应 SC**: SC-001 (≥20 总数) / SC-002 (≥12 expense) / SC-003 (≥5 income) / SC-004 (P95 < 100ms) / FR-001/002/003/012

### 1.1 默认 list (无 type 过滤)

```bash
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/category.list" | python3 -c "
import json, sys
items = json.load(sys.stdin)['result']['data']['json']
print(f'分类总数: {len(items)}  (期望 ≥ 20,SC-001)')
print()
print('前 5 个 (按 sortOrder ASC):')
for c in items[:5]:
    print(f'  {c[\"icon\"]} {c[\"name\"]} ({c[\"type\"]}, sort={c[\"sortOrder\"]})')
print('...')
print('后 3 个:')
for c in items[-3:]:
    print(f'  {c[\"icon\"]} {c[\"name\"]} ({c[\"type\"]}, sort={c[\"sortOrder\"]})')
"
```

### 1.2 type=expense 过滤 (SC-002)

```bash
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/category.list?input=%7B%22json%22%3A%7B%22type%22%3A%22expense%22%7D%7D" | python3 -c "
import json, sys
items = json.load(sys.stdin)['result']['data']['json']
print(f'支出分类数: {len(items)}  (期望 ≥ 12,SC-002)')
print('全部:')
for c in items:
    print(f'  {c[\"icon\"]} {c[\"name\"]}')
"
```

### 1.3 type=income 过滤 (SC-003)

```bash
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/category.list?input=%7B%22json%22%3A%7B%22type%22%3A%22income%22%7D%7D" | python3 -c "
import json, sys
items = json.load(sys.stdin)['result']['data']['json']
print(f'收入分类数: {len(items)}  (期望 ≥ 5,SC-003)')
for c in items:
    print(f'  {c[\"icon\"]} {c[\"name\"]}')
"
```

### 1.4 性能 (SC-004)

```bash
# 跑 20 次 list,统计 P95
for i in $(seq 1 20); do
  curl -s -b /tmp/cookies.txt -o /dev/null \
    -w "%{time_total}\n" \
    "http://localhost:3000/api/trpc/category.list"
done | sort -n | awk 'NR==19 {print "P95:", $1*1000, "ms (期望 < 100)"}'
```

---

## 验证 US2: 查询单个分类

### 2.1 happy path

```bash
# 拿第一个分类的 ID
CATEGORY_ID=$(curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/category.list" | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")

echo "查询分类 ID: $CATEGORY_ID"
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/category.get?input=%7B%22json%22%3A%7B%22id%22%3A%22$CATEGORY_ID%22%7D%7D" | python3 -m json.tool
```

### 2.2 不存在 ID → 404 (FR-005)

```bash
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/category.get?input=%7B%22json%22%3A%7B%22id%22%3A%2200000000-0000-5000-8000-000000000000%22%7D%7D" | python3 -c "
import json, sys
data = json.load(sys.stdin)
err = data.get('error', {}).get('json', {}).get('data', {})
print(f'code: {err.get(\"code\")}  (期望 NOT_FOUND)')
"
```

---

## 验证 SC-005: ID 跨环境稳定

```bash
# 拿两次 list 的第一个 ID,验证一致
ID1=$(curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/category.list" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")
ID2=$(curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/category.list" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['data']['json'][0]['id'])")
echo "ID1: $ID1"
echo "ID2: $ID2"
[ "$ID1" = "$ID2" ] && echo "✓ 一致 (SC-005)" || echo "✗ 不一致"

# 验证 ID 是 UUID v5 (版本字段 = 5)
echo "$ID1" | python3 -c "
import sys, uuid
id_str = sys.stdin.read().strip()
u = uuid.UUID(id_str)
print(f'UUID version: {u.version}  (期望 5)')
print(f'variant: {u.variant}')
"
```

---

## DB 层验证

```bash
# 验证表存在 + 种子数据计数
docker exec balthasar-pg psql -U balthasar -d balthasar -c \
  "SELECT type, COUNT(*) FROM categories GROUP BY type ORDER BY type;"

# 期望:
#  expense | 12
#  income  | 8

# 验证 seed 幂等 —— 重新跑迁移,行数应不变
pnpm db:migrate
docker exec balthasar-pg psql -U balthasar -d balthasar -t -A -c \
  "SELECT COUNT(*) FROM categories;"
# 期望: 20

# 验证 is_built_in 全部为 true (MVP 内置)
docker exec balthasar-pg psql -U balthasar -d balthasar -t -A -c \
  "SELECT COUNT(*) FROM categories WHERE is_built_in = false;"
# 期望: 0
```

---

## 跨家庭一致性验证 (FR-007 共享)

```bash
# 注册第二个用户 (不同家庭)
curl -s -c /tmp/cookies2.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"otheruser@example.com","password":"correct-horse-battery-staple","name":"otheruser"}' \
  > /dev/null

# 用户 A 与用户 B 的 list 应完全相同
LIST_A=$(curl -s -b /tmp/cookies.txt "http://localhost:3000/api/trpc/category.list" | python3 -c "import json,sys; items=json.load(sys.stdin)['result']['data']['json']; print(sorted([c['id'] for c in items]))")
LIST_B=$(curl -s -b /tmp/cookies2.txt "http://localhost:3000/api/trpc/category.list" | python3 -c "import json,sys; items=json.load(sys.stdin)['result']['data']['json']; print(sorted([c['id'] for c in items]))")

[ "$LIST_A" = "$LIST_B" ] && echo "✓ 跨家庭一致 (FR-007 共享)" || echo "✗ 不一致"
```

---

## 测试套件

```bash
pnpm test:unit         # formatCategoryForDisplay 纯函数
pnpm test:procedure    # category procedure 契约 (mock)
pnpm test:integration  # 真实 Postgres: seed 幂等 + type 过滤 + 排序 + 跨家庭一致
```

---

## 通过判据 (Definition of Done)

| SC | 验证方式 | 状态 |
|---|---|---|
| SC-001 (≥20 总数) | list 计数 | ⏳ |
| SC-002 (≥12 expense) | type=expense 计数 | ⏳ |
| SC-003 (≥5 income) | type=income 计数 | ⏳ |
| SC-004 (list P95 < 100ms) | 20 次请求计时 | ⏳ |
| SC-005 (ID 跨环境稳定) | UUID v5 验证 | ⏳ |
| SC-006 (name 1-30 字符) | 单元测试 | ⏳ |
| SC-007 (type ∈ income\|expense) | DB pgEnum 验证 | ⏳ |
| SC-008 (icon 合法 emoji) | 单元测试 UTF-16 ≤ 4 | ⏳ |

全部 ⏳ → ✅ 即可进入实现阶段评审。
