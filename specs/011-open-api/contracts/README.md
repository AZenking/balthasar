# Contracts: 011-open-api

**状态**: REST 开放 API + tRPC Key 管理。

## REST 端点 (API Key 认证)

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/api/v1/transactions` | 新增交易 |
| PATCH | `/api/v1/transactions/:id` | 更新交易 |
| OPTIONS | `/api/v1/*` | CORS preflight |

## tRPC 端点 (Session 认证,内部)

| 路径 | 功能 |
|---|---|
| `trpc.apiKey.create({ name })` | 生成 Key |
| `trpc.apiKey.list()` | Key 列表 |
| `trpc.apiKey.revoke({ id })` | 吊销 Key |

## 认证

```
Authorization: Bearer bk_a1b2c3d4e5f6...
# 或
X-API-Key: bk_a1b2c3d4e5f6...
```

## 请求体 (POST 新增)

```json
{
  "type": "expense | income",
  "accountId": "uuid",
  "categoryId": "uuid",
  "amount": "35.50",
  "remark": "选填",
  "occurredAt": "ISO 8601, 选填, 默认 now"
}
```

## 请求体 (PATCH 更新)

```json
{
  "type": "expense | income",
  "accountId": "uuid",
  "categoryId": "uuid",
  "amount": "38.00",
  "remark": "新备注",
  "occurredAt": "ISO 8601"
}
```

所有字段可选,但至少一个。
