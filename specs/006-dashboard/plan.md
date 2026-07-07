# Implementation Plan: 首页统计

**Branch**: `006-dashboard` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

## Summary

单端点 `dashboard.summary` 返回当月收支汇总 + 最近 5 笔交易 + 支出分类占比。不新增表,3 个独立聚合查询 (SUM + LIMIT + GROUP BY) 并发执行,合并响应。

## Technical Context

复用 001-005 栈,无新依赖。PostgreSQL 聚合查询利用 004 已建的 `(family_id, type)` + `(family_id, occurred_at)` 索引。

**Performance**: P95 < 500ms (1000 笔,3 个查询各 < 100ms + Promise.all 并行)

## Constitution Check

| # | 原则 | 状态 |
|---|---|---|
| 一 MVP Scope | ✅ | Dashboard 在 MVP 范围 |
| 二 Feature-Sliced | ✅ | 新增 `dashboard.ts` router + `dashboard.ts` queries |
| 三 DDD | ✅ | 复用 Transaction 实体,DashboardSummary 是值对象 |
| 四 Test-First | ✅ | Vitest + testcontainers |
| 五 Performance | ✅ | 3 查询 Promise.all,索引支撑 |
| 六 YAGNI | ✅ | 不缓存、不物化、不自定义日期 |

**Gate Result**: ✅ ALL PASS。

## Project Structure

```text
src/server/
├── api/routers/dashboard.ts          # 新增: summary procedure
└── db/queries/dashboard.ts           # 新增: 3 个聚合查询
src/tests/
├── procedure/dashboard.test.ts       # 契约测试
└── integration/dashboard/summary.test.ts  # 集成测试
```

## Complexity Tracking

无。
