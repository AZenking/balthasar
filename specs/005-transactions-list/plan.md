# Implementation Plan: 流水列表与筛选

**Branch**: `005-transactions-list` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-transactions-list/spec.md`

## Summary

在 004-transaction 的 `transaction.list` 上增加筛选条件 (type/accountId/categoryId/startDate/endDate/keyword) 与可选的 `includeSummary` (income/expense/net 全量聚合)。不新增表,仅扩展 query module 的 WHERE 条件 + SUM 聚合 + procedure input schema。

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 20 LTS (Next.js 16) — 与 001-004 一致

**Primary Dependencies**: 无新增 (复用 004 的 Drizzle + tRPC 栈)

**Storage**: PostgreSQL 16 (复用 004 的 transactions 表,不新增 schema)

**Performance Goals**: `transaction.list` 含筛选 + summary P95 < 500ms (1000 笔交易,FR-017)

**Constraints**: 筛选用 AND 逻辑,cursor 分页叠加 WHERE,summary 全量聚合 (非仅当前页)

## Constitution Check

| # | 原则 | 状态 | 备注 |
|---|---|---|---|
| 一 | MVP Scope | ✅ | 流水筛选在 MVP 范围 (`docs/MVP.md` 列"流水") |
| 二 | Feature-Sliced | ✅ | 扩展 004 的 `transaction.ts` router + queries,不新增文件 |
| 三 | DDD | ✅ | 复用 Transaction 实体,不新增聚合 |
| 四 | Test-First | ✅ | Vitest + testcontainers |
| 五 | Performance | ✅ | 索引 `(family_id, type)` + `(family_id, occurred_at)` 支撑筛选 + 聚合 |
| 六 | YAGNI | ✅ | 不引入全文搜索引擎 (ILIKE 够用),不物化 summary |

**Gate Result**: ✅ ALL PASS。

## Project Structure

不新增文件。修改 004 的:
- `src/server/api/routers/transaction.ts` — 扩展 `list` procedure input + response
- `src/server/db/queries/transaction.ts` — 扩展 `listTransactions` WHERE + 新增 `getTransactionSummary`
- `src/tests/integration/transaction/list.test.ts` — 追加筛选 + summary 集成测试

## Complexity Tracking

无。
