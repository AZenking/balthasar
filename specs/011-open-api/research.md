# Phase 0 Research: 011-open-api

**Date**: 2026-07-07

## Q1: API Key 生成与存储

### Decision
**`bk_` + 32 字符 base62 随机串,DB 存 SHA-256 hash**。

```typescript
// 生成
const raw = 'bk_' + crypto.randomBytes(24).toString('base64url').slice(0, 32);
// raw: bk_aB3dE6fG9hIjKlMnOpQrStUvWxYz012345
// 存储
const hash = crypto.createHash('sha256').update(raw).digest('hex');
// DB: { keyHash: hash, keyPrefix: raw.slice(0, 11) }
```

### Rationale
- SHA-256 不可逆,DB 泄漏不暴露明文。
- `keyPrefix` (`bk_aB3dE6fG9`) 用于列表展示,用户识别 Key。
- 验证: `SHA256(input) === keyHash` 查 DB,索引 `(key_hash)`。
- `crypto.randomBytes` Node 原生,无新依赖。

---

## Q2: REST 端点 — Next.js Route Handler vs 独立 Express

### Decision
**Next.js Route Handler** (`src/app/api/v1/transactions/route.ts`)。

### Rationale
- 与现有 `/api/trpc` + `/api/auth` 同栈,无新进程。
- Next.js Route Handler 支持所有 HTTP methods + middleware 式包装。
- CORS 在 route handler 内设 header,简单直接。
- 独立 Express 需额外进程 + 端口管理,违反 YAGNI。

---

## Q3: API Key 认证 — 中间件 vs 函数

### Decision
**函数 `validateApiKey(request) → { userId, familyId }`**,在 route handler 开头调用。

### Rationale
- Next.js App Router Route Handler 没有 Express 式 middleware。
- 函数模式: `const auth = await validateApiKey(req); if (!auth) return 401;`。
- 可复用: POST 和 PATCH 都调同一函数。
- 函数内做: 提取 Key → SHA256 → 查 DB → 检查 revokedAt → 更新 lastUsedAt → 返回 userId。
- familyId 通过 userId 反查 (复用 002 `loadFamilyAndMemberIdsByUserId`)。

---

## Q4: 限流 — 内存 vs DB

### Decision
**内存 Map**,key 格式 `keyPrefix:minuteBucket`,60 次/分钟。

### Rationale
- 与 Better-Auth rateLimit 一致 (内存,restart 重置)。
- 60/min/Key,足够自动化记账 (< 1 次/秒)。
- 超限 → 429 + `X-RateLimit-Reset` header。
- V2 改 DB 或 Redis 支持多实例。

---

## Q5: 金额 — API 接受元 vs 分

### Decision
**API 接受元 (string/number,如 `"35.50"`)，后端转分**。

### Rationale
- 与 008 前端表单一致 (用户直觉)。
- 第三方集成更友好 (不需要知道"分"的概念)。
- 后端 `yuanToCents()` (008 已有) 复用。

---

## 总结

5 项决策: bk_ + SHA-256 存储 + Next.js Route Handler + 函数认证 + 内存限流 + 元转分。
