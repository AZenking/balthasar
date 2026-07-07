# Data Model: 011-open-api

**Date**: 2026-07-07

新增 1 张表 `api_keys`,REST 端点独立于 tRPC。

## 表: `api_keys`

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | uuid v7 | PK | |
| `user_id` | text | NOT NULL, FK → user.id, CASCADE | 关联 Better-Auth user |
| `key_prefix` | text | NOT NULL | 前 11 字符 (`bk_aB3dE6fG9`),列表展示 |
| `key_hash` | text | NOT NULL, UNIQUE, INDEX | SHA-256 hex |
| `name` | text | NOT NULL, default '默认' | 用户自定义标签, ≤ 50 字 |
| `last_used_at` | timestamptz | NULL | 每次请求更新 |
| `created_at` | timestamptz | NOT NULL, default now() | |
| `revoked_at` | timestamptz | NULL | NULL = 有效;非 NULL = 已吊销 |

**索引**: `(key_hash)` UNIQUE — Key 验证热路径。
**不变量**: 每用户最多 5 条 `revokedAt IS NULL`。

## REST 端点

### POST /api/v1/transactions

**Request**:
```
Authorization: Bearer bk_xxx
Content-Type: application/json

{
  "type": "expense",
  "accountId": "uuid",
  "categoryId": "uuid",
  "amount": "35.50",
  "remark": "午餐",
  "occurredAt": "2026-07-07T12:00:00Z"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "type": "expense",
  "amount": 3550,
  "accountId": "uuid",
  "categoryName": "餐饮",
  "categoryIcon": "🍔",
  "accountName": "招商银行卡",
  "remark": "午餐",
  "occurredAt": "2026-07-07T12:00:00.000Z",
  "createdAt": "2026-07-07T12:00:00.000Z",
  "updatedAt": "2026-07-07T12:00:00.000Z"
}
```

### PATCH /api/v1/transactions/:id

**Request**:
```
Authorization: Bearer bk_xxx
Content-Type: application/json

{
  "remark": "午餐咖啡",
  "amount": "38.00"
}
```

**Response 200**: 同 POST 但 200。

### 错误响应

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "API Key 无效",
    "details": { "field": "authorization" }
  }
}
```

| HTTP | code | 场景 |
|---|---|---|
| 400 | VALIDATION_ERROR | 缺字段/格式错 |
| 401 | UNAUTHORIZED | 无 Key / 无效 / 已吊销 |
| 404 | NOT_FOUND | 交易不存在/跨家庭 |
| 413 | PAYLOAD_TOO_LARGE | body > 4KB |
| 429 | RATE_LIMITED | 超限 |
| 500 | INTERNAL_ERROR | 后端异常 |

## CORS Headers

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, PATCH, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-API-Key
```

## tRPC 端点 (Key 管理,session 认证)

| Procedure | 功能 |
|---|---|
| `apiKey.create({ name })` | 生成 Key,返回明文 (一次性) |
| `apiKey.list()` | 列表 (仅 prefix + name + dates) |
| `apiKey.revoke({ id })` | 吊销 |
