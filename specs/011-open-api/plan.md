# Implementation Plan: 第三方开放 API

**Branch**: `011-open-api` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

## Summary

对外开放 REST API,允许第三方系统通过 API Key 新增/更新交易。新增 `api_keys` 表 (SHA-256 hash 存储) + REST 端点 (`/api/v1/transactions`) + 设置页 API Key 管理组件。

## Technical Context

复用 001-010 栈,无新依赖。REST 端点独立于 tRPC,用 Next.js Route Handler。

**Performance**: API 端点 p95 < 500ms (Key hash 查询 + transaction create/update + audit)

## Constitution Check

| # | 原则 | 状态 |
|---|---|---|
| 一 MVP Scope | ✅ | 开放 API 是 V1 ROADMAP 隐含项 (自动化记账场景) |
| 二 Feature-Sliced | ✅ | REST route handler + tRPC key management router 分离 |
| 三 DDD | ✅ | Transaction 操作复用 004 query module |
| 四 Test-First | ✅ | curl 集成测试 + 单元测试 |
| 五 Performance | ✅ | p95 < 500ms,索引 `(key_hash)` |
| 六 YAGNI | ✅ | 不实现 GET/DELETE/OAuth2/Webhook |

**Gate Result**: ✅ ALL PASS。

## Project Structure

```text
src/
├── app/api/v1/
│   └── transactions/
│       ├── route.ts              # POST (新增) + OPTIONS (CORS)
│       └── [id]/route.ts         # PATCH (更新)
├── server/
│   ├── db/schema/
│   │   └── api-keys.ts           # 新增: api_keys 表
│   ├── api/routers/
│   │   └── api-key.ts            # 新增: tRPC (生成/列表/吊销, session 认证)
│   ├── auth/
│   │   └── api-key-auth.ts       # 新增: validateApiKey() 函数
│   └── domain/
│       └── api-key/
│           └── generate.ts       # 新增: bk_ + 32 字符随机串
├── app/(app)/settings/
│   └── api-keys.tsx              # 新增: API Key 管理组件 (设置页内)
└── tests/
    └── integration/api/
        ├── create-transaction.test.ts
        ├── update-transaction.test.ts
        └── auth.test.ts
```

## Complexity Tracking

无。
