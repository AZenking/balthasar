---

description: "Task list for 011-open-api (第三方开放 REST API + API Key)"

---

# Tasks: 第三方开放 API (011-open-api)

**Input**: Design documents from `/specs/011-open-api/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/README.md, research.md, quickstart.md

**Tests**: curl 集成测试。

## Format: `- [ ] [ID] [P?] [Story?] Description`

---

## Phase 1: Setup

无新依赖。

---

## Phase 2: Foundational (数据层 + 认证 + 限流)

**⚠️ CRITICAL**: 阻塞所有 US

- [X] T001 [P] Create `src/server/db/schema/api-keys.ts` —— `api_keys` 表: id (uuid v7) + userId (text FK→user.id CASCADE) + keyPrefix (text) + keyHash (text UNIQUE INDEX) + name (text ≤ 50) + lastUsedAt (timestamptz NULL) + createdAt + revokedAt (timestamptz NULL)
- [X] T002 Update `src/server/db/schema/index.ts` 追加 export `./api-keys`
- [X] T003 Generate migration `src/server/db/migrations/0005_api_keys.sql` via `pnpm db:generate`
- [X] T004 [P] Create `src/server/domain/api-key/generate.ts` —— `generateApiKey()` 返回 `{ plainKey: "bk_" + 32字符 base62, keyHash: SHA-256 hex, keyPrefix: plainKey.slice(0,11) }`,用 `crypto.randomBytes` + `crypto.createHash`
- [X] T005 [P] Create `src/server/auth/api-key-auth.ts` —— `validateApiKey(req: Request)` 函数: 从 `Authorization: Bearer bk_xxx` 或 `X-API-Key` 提取 Key → SHA-256 → 查 `api_keys WHERE key_hash AND revokedAt IS NULL` → 返回 `{ userId }` 或 null + 更新 `lastUsedAt` (异步,不阻塞响应)
- [X] T006 [P] Create `src/server/auth/api-rate-limit.ts` —— 内存限流: `checkRateLimit(keyPrefix)` 返回 `{ allowed: boolean, retryAfter: number }`,60 次/分钟/Key,Map 存储 `{ keyPrefix: { count, windowStart } }`

**Checkpoint**: schema + 迁移 + Key 生成/验证/限流就绪。

---

## Phase 3: User Story 1 — API Key 管理 (Priority: P1)

**Goal**: 用户在 /settings 生成/查看/吊销 API Key

### Implementation

- [X] T007 [US1] Create `src/server/api/routers/api-key.ts` —— tRPC router (protectedProcedure): `create({ name })` 调 `generateApiKey()` + 存 DB + 返回 `{ id, plainKey, name, createdAt }` (明文一次性);`list()` 返回 `[{ id, keyPrefix, name, createdAt, lastUsedAt }]` (无 hash);`revoke({ id })` 设 `revokedAt = now()`;create 时检查 ≤ 5 个有效 Key
- [X] T008 [US1] Wire `apiKeyRouter` into `appRouter` in `src/server/api/root.ts`
- [X] T009 [US1] Create `src/components/settings/api-key-manager.tsx` —— `"use client"` 组件: `trpc.apiKey.list.useQuery()` + `trpc.apiKey.create.useMutation()` + `trpc.apiKey.revoke.useMutation()`;列表显示 keyPrefix + name + createdAt + lastUsedAt + "吊销"按钮;创建表单 (name 输入 + 生成按钮) → 成功后一次性弹窗显示完整 Key + "复制"按钮 + "关闭后不再显示"提示
- [X] T010 [US1] Update `src/app/(app)/settings/page.tsx` —— 在账户管理区域下方加 `<ApiKeyManager />` 组件

**Checkpoint**: US1 可测 —— 设置页生成 Key → 一次性显示 → 列表 → 吊销。

---

## Phase 4: User Story 2 — 新增交易 POST (Priority: P1) 🎯 MVP

**Goal**: 第三方系统 POST /api/v1/transactions 创建交易

### Implementation

- [X] T011 [US2] Create `src/app/api/v1/transactions/route.ts` —— `POST` handler: 调 `validateApiKey(req)` (T005) → 无效返回 401;调 `checkRateLimit(keyPrefix)` (T006) → 超限返回 429;解析 body → 校验 (type/accountId/categoryId/amount 必填,amount 正数 ≤ 2 位小数);`yuanToCents(amount)` 转分;调 `loadFamilyAndMemberIdsByUserId(userId)` + `validateAccountAndCategory`;`db.transaction` 写 transaction + writeTransactionEvent (metadata `via: "open_api"`);返回 201 + 完整交易 JSON;`OPTIONS` handler 设 CORS headers
- [X] T012 [US2] Create CORS helper `src/server/auth/cors.ts` —— `setCorsHeaders(res)` 设 `Access-Control-Allow-Origin: *` + `Access-Control-Allow-Methods: POST, PATCH, OPTIONS` + `Access-Control-Allow-Headers: Authorization, Content-Type, X-API-Key`

**Checkpoint**: US2 可测 —— curl POST + Bearer Key → 201 + DB 验证交易创建 + 审计写入。

---

## Phase 5: User Story 3 — 更新交易 PATCH (Priority: P1)

**Goal**: 第三方系统 PATCH /api/v1/transactions/:id 更新交易

### Implementation

- [X] T013 [US3] Create `src/app/api/v1/transactions/[id]/route.ts` —— `PATCH` handler: 同 US2 认证 + 限流;解析 body (至少一个可变字段);查交易 WHERE id AND family_id;存在 → 更新 + writeTransactionEvent (metadata `via: "open_api"`);不存在 → 404;`OPTIONS` CORS

**Checkpoint**: US3 可测 —— curl PATCH → 200 + DB 验证更新 + 审计写入。

---

## Phase 6: Polish

- [X] T014 [P] 验证 US1 完整流程: 生成 → 一次性显示 → 列表 → 吊销 → 吊销后调 API → 401
- [X] T015 [P] 验证 US2 错误场景: 无 Key 401 + 无效 Key 401 + 缺字段 400 + amount ≤ 0 400 + type/category 不匹配 400 + 跨家庭 400
- [X] T016 [P] 验证 US3 错误场景: 不存在 ID 404 + 空对象 400 + 无效 amount 400
- [X] T017 [P] 验证限流: 同 Key 61 次 → 429 + Retry-After
- [X] T018 [P] 验证 CORS: OPTIONS preflight → 正确 headers
- [X] T019 Run [quickstart.md](./quickstart.md) end-to-end curl validation; tick all 7 SC items

---

## Dependencies

- Phase 2 (T001-T006) 阻塞所有 US
- US1 (T007-T010) 依赖 Phase 2 (需要 schema + generate)
- US2 (T011-T012) 依赖 Phase 2 (需要 validateApiKey + rateLimit)
- US3 (T013) 依赖 Phase 2 + 数据依赖 US2 (需要已存在交易)
- Polish 依赖所有 US

## MVP 范围

US1 + US2 = Key 管理 + 新增交易 (自动化记账闭环)。US3 快速跟进。

## Notes

- 新增 1 张表 `api_keys` + 1 个迁移
- REST 端点独立于 tRPC (`/api/v1/*` vs `/api/trpc/*`)
- API Key 明文仅生成时返回,DB 存 SHA-256 hash
- 认证: `Authorization: Bearer bk_xxx` 或 `X-API-Key: bk_xxx`
- 限流: 内存,60 次/分钟/Key
- CORS: `/api/v1/*` 允许 `*`
- 审计: `transaction_events` + metadata `via: "open_api"`
- 金额: API 接受元 (string),后端 `yuanToCents()` 转分
