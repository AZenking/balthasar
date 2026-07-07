# Feature 规约: 第三方开放 API

**Feature 分支**: `011-open-api`

**创建日期**: 2026-07-07

**状态**: Draft

**输入**: 用户描述 "做个第三方 API 功能; api 需要有新增账单; 更新账单; 需要有 API Key"

## 概述

本 feature 为家庭记账系统提供一套**对外开放的 REST API**,允许第三方系统 (如自动化工具、浏览器插件、其他 App、脚本) 通过 API Key 认证来新增和更新交易 (账单)。

与内部 tRPC 端点不同,开放 API 使用标准 REST 协议 (JSON + HTTP),第三方无需了解 tRPC 即可集成。

核心能力:
- **API Key 管理**: 用户在设置页生成/查看/吊销 API Key
- **新增交易**: `POST /api/v1/transactions`
- **更新交易**: `PATCH /api/v1/transactions/:id`

本 feature 依赖前置 002-account + 003-category + 004-transaction。

## User Scenarios & Testing *(mandatory)*

### User Story 1 — API Key 管理 (Priority: P1)

已登录用户在设置页生成 API Key,系统返回一次性的完整 Key (后续只显示前缀)。用户可查看已有 Key 列表 + 吊销。

**为何此优先级**: 没有 Key 就无法调 API。

**Acceptance Scenarios**:

1. **Given** 用户已登录, **When** 在 /settings 点"生成 API Key", **Then** 系统生成一个 Key,完整显示一次,提示"请妥善保存,之后不再显示"。
2. **Given** 已有多个 Key, **When** 查看列表, **Then** 每个 Key 显示前缀 (如 `bk_abc...`) + 创建时间 + 最后使用时间 + "吊销"按钮。
3. **Given** 某 Key 已吊销, **When** 用该 Key 调 API, **Then** 返回 401 未授权。
4. **Given** 未登录, **When** 访问 Key 管理页面, **Then** 重定向 /login。

---

### User Story 2 — 新增交易 (Priority: P1) 🎯 MVP

第三方系统持有有效 API Key,通过 `POST /api/v1/transactions` 新增一笔交易。

**为何此优先级**: 核心功能 —— 自动化记账。

**Acceptance Scenarios**:

1. **Given** 有效 API Key + 正确请求体, **When** POST /api/v1/transactions, **Then** 返回 201 + 创建的交易数据。
2. **Given** 无 API Key, **When** POST, **Then** 返回 401。
3. **Given** 无效/已吊销 Key, **When** POST, **Then** 返回 401。
4. **Given** 请求体缺少必填字段 (type/accountId/categoryId/amount), **When** POST, **Then** 返回 400 + 字段错误列表。
5. **Given** amount ≤ 0 或非数字, **When** POST, **Then** 返回 400。
6. **Given** type 与 categoryId 类型不匹配, **When** POST, **Then** 返回 400。
7. **Given** accountId 属于其他家庭, **When** POST, **Then** 返回 400。
8. **Given** 同一 Key 短时间内大量请求, **When** 超过限流, **Then** 返回 429。

---

### User Story 3 — 更新交易 (Priority: P1)

第三方系统持有有效 API Key,通过 `PATCH /api/v1/transactions/:id` 更新已有交易。

**Acceptance Scenarios**:

1. **Given** 有效 Key + 正确 ID + 更新字段, **When** PATCH, **Then** 返回 200 + 更新后的交易。
2. **Given** 交易 ID 不存在或不属于该 Key 关联的家庭, **When** PATCH, **Then** 返回 404。
3. **Given** 更新字段含无效值 (如 amount ≤ 0), **When** PATCH, **Then** 返回 400。
4. **Given** 请求体为空对象 `{}`, **When** PATCH, **Then** 返回 400 "至少需要一个更新字段"。

---

### Edge Cases

- API Key 格式: 前缀 `bk_` + 32 字符随机串,如 `bk_a1b2c3d4e5f6...`,总长度 35 字符。
- API Key 存储: DB 中只存 SHA-256 hash,不存明文。生成时一次性显示完整 Key。
- API Key 查询: 用 `WHERE key_hash = SHA256(input)` 查 DB,不暴露 hash 给客户端。
- API Key 关联: 每个 Key 绑定到生成它的 user (通过 user_id),该 user 的 family 就是 API 操作的家庭范围。
- 限流: 每个 Key 默认 60 次/分钟,超限返回 429 + `Retry-After` header。
- 审计: 所有 API 写操作 (新增/更新) MUST 记录到 `transaction_events` 审计表 (与 004 一致)。
- CORS: 开放 API 端点 MUST 允许跨域 (`Access-Control-Allow-Origin: *`),内部 tRPC/Better-Auth 端点不变。
- 金额: 与 008 前端一致,API 接受**元** (decimal,如 `"35.50"`),后端转分 (integer 3550)。
- 日期: `occurredAt` 可选,默认 now,允许过去,不允许未来 (> now + 1 day)。
- 并发: 同一 Key 并发请求 → 各自处理 (无锁)。
- 请求体大小: 最大 4KB。
- 响应格式: 标准 JSON 错误信封 `{ error: { code, message } }` + HTTP 状态码。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 提供 API Key 生成能力,Key 格式为 `bk_` + 32 字符随机串。
- **FR-002**: API Key 明文 MUST 仅在生成时返回一次;DB 中 MUST 只存 SHA-256 hash。
- **FR-003**: 系统 MUST 提供 API Key 列表查询 (仅显示前缀 `bk_xxxx...` + 创建时间 + 最后使用时间)。
- **FR-004**: 系统 MUST 提供 API Key 吊销 (revoke) 能力,吊销后 Key 立即失效。
- **FR-005**: 系统 MUST 提供 REST 端点 `POST /api/v1/transactions` 新增交易。
- **FR-006**: 系统 MUST 提供 REST 端点 `PATCH /api/v1/transactions/:id` 更新交易。
- **FR-007**: 所有开放 API 端点 MUST 通过 API Key 认证 (Authorization: Bearer bk_xxx 或 X-API-Key header)。
- **FR-008**: 无效/缺失/已吊销 Key MUST 返回 401 + `{ error: { code: "UNAUTHORIZED", message: "API Key 无效" } }`。
- **FR-009**: 新增交易请求体 MUST 包含: type (income|expense)、accountId、categoryId、amount (元,正数,≤ 2 位小数);可选: remark (≤ 200)、occurredAt (ISO 8601)。
- **FR-010**: 更新交易请求体 MUST 至少包含一个可变字段 (type, accountId, categoryId, amount, remark, occurredAt),空对象返回 400。
- **FR-011**: 所有 API 操作 MUST 限定在 API Key 所属用户的家庭范围内 (跨家庭返回 400/404)。
- **FR-012**: type 与 categoryId 类型不匹配 MUST 返回 400。
- **FR-013**: amount MUST > 0,精度 ≤ 2 位小数,后端自动 ×100 转分。
- **FR-014**: 所有 API 写操作 MUST 写入 `transaction_events` 审计表 (与 004 一致)。
- **FR-015**: API Key 管理端点 (生成/列表/吊销) MUST 走 tRPC (内部 session 认证,不走 API Key)。
- **FR-016**: 系统 MUST 对每个 API Key 限流 60 次/分钟,超限返回 429 + `Retry-After`。
- **FR-017**: 开放 API 端点 MUST 允许跨域 (CORS `*`),与内部端点独立。
- **FR-018**: API Key 最后使用时间 MUST 在每次请求后更新 (用于列表展示)。
- **FR-019**: 成功响应 MUST 返回完整交易对象 (含 accountName, categoryName, categoryIcon,与 004 get 一致)。
- **FR-020**: 请求体超过 4KB MUST 返回 413。

### Key Entities

- **ApiKey**: API 密钥实体。属性: id (UUID v7)、userId、keyPrefix (前 8 字符,如 `bk_a1b2c3`)、keyHash (SHA-256)、name (用户自定义标签,如"浏览器插件")、lastUsedAt、createdAt、revokedAt (可空)。
- **OpenApiTransaction**: 开放 API 请求/响应体。属性: type, accountId, categoryId, amount (元), remark, occurredAt。与 004 Transaction 对应但 amount 用元。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 第三方系统从获取 API Key 到成功创建第一笔交易 ≤ 5 分钟。
- **SC-002**: `POST /api/v1/transactions` 服务端响应 p95 < 500ms (含 Key 验证 + 创建 + 审计)。
- **SC-003**: 100% 无效 Key 请求被拒绝 (401)。
- **SC-004**: API Key 吊销后该 Key 的后续请求 100% 被拒绝。
- **SC-005**: 限流生效 —— 第 61 次/分钟请求返回 429。
- **SC-006**: 跨家庭访问 100% 被拒绝 (400/404,不泄漏存在性)。
- **SC-007**: 所有 API 写操作审计事件齐全 (transaction_created/edited)。

## Assumptions

- 后端 002-account + 003-category + 004-transaction 全部就绪。
- API Key 存储为 SHA-256 hash (不可逆),明文仅生成时返回。
- API Key 前缀 `bk_` (bookkeeping 缩写) + 32 字符 base62 随机串,总长 35。
- 认证方式: `Authorization: Bearer bk_xxx` (推荐) 或 `X-API-Key: bk_xxx` (兼容),两种 header 任一即可。
- 限流: 内存计数 (与 Better-Auth rateLimit 一致),60 次/分钟/Key,restart 重置。
- CORS: 开放 API 端点 (`/api/v1/*`) 允许 `*`,内部端点 (`/api/trpc/*`, `/api/auth/*`) 不变。
- 不实现 GET (查询交易) —— 第三方只需写入 (自动化记账),查询走前端 UI。
- 不实现 DELETE (删除交易) —— 安全考虑,删除只允许 UI 操作。
- API Key 不设过期时间 (长期有效),用户手动吊销。
- API Key 名称: 用户自定义标签 (如"浏览器插件"、"微信机器人"),最多 50 字。
- 每个用户最多 5 个有效 API Key (防止滥用)。
- 开放 API 端点不走 Next.js middleware auth guard (不需要 session cookie)。
- 审计 metadata 记录 `via: "open_api"` + `api_key_prefix`。
- 响应 Content-Type 始终 `application/json`。
- 错误响应统一信封 `{ error: { code: "ERROR_CODE", message: "中文说明", details?: {...} } }`。
- 不实现 API 版本 > v1 (MVP 只 v1)。
- 不实现 webhook 回调 (V2)。
- 不实现 OAuth2 (API Key 够用)。
- 开放 API 的 REST 端点独立于 tRPC,不复用 tRPC router (REST ≠ tRPC 协议)。
