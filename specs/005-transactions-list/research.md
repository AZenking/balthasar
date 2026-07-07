# Phase 0 Research: 005-transactions-list

**Date**: 2026-07-07
**Status**: Complete

本 feature 不新增表/不新增依赖,Phase 0 仅 3 个实施层面决策。

---

## Q1: summary 聚合 — 单独查询 vs 同查询 inline

### Decision
**单独查询** `getTransactionSummary(familyId, filters)` —— 与 `listTransactions` 分离,各自查 DB。

### Rationale
- list 查询用 `LIMIT + cursor`,summary 需要 `SUM` 无 limit。混在一起会牺牲 list 性能 (PG 需全扫后 LIMIT)。
- 两次查询各走各的索引,list 用 `(family_id, occurred_at)`,summary 用 `(family_id, type)`。
- 响应延迟: list ~50ms + summary ~50ms ≈ 100ms,远低于 P95 < 500ms 目标。
- 当 `includeSummary: false` (默认) 时不执行 summary 查询,零开销。

### Alternatives Considered
- **窗口函数 inline**: `SUM(CASE...) OVER()` + LIMIT。复杂,PG 窗口函数对大结果集有内存风险。
- **单查询 + COUNT + SUM 不 LIMIT**: 拒绝。1000 笔全拉回应用层太重。

---

## Q2: keyword ILIKE 注入防御

### Decision
**Drizzle `ilike()` 函数 + 参数化查询**,不拼字符串 SQL。

### Rationale
- Drizzle 的 `ilike(transaction.remark, `%${keyword}%`)` 自动参数化,防 SQL 注入。
- keyword 先 `trim()`,空字符串跳过 (FR-007);超 200 字符截断 (FR-008)。
- 不使用 PG 全文搜索 (`tsvector`) —— YAGNI,ILIKE 对 < 1000 行足够快。

### Alternatives Considered
- **PG tsvector GIN 索引**: 拒绝。需要额外索引 + 迁移,YAGNI。V2 评估。
- **应用层过滤**: 拒绝。拉全表到内存再过滤,性能差。

---

## Q3: startDate/endDate 时区边界处理

### Decision
前端传 ISO 8601 with offset,后端用 `gte(occurredAt, startDate)` + `lte(occurredAt, endDate)`,闭区间。

### Rationale
- `startDate = "2026-07-01T00:00:00+08:00"` → PG `timestamptz` 自动转 UTC 比较。
- 闭区间: `>= startDate AND <= endDate`,包含边界当天全天。
- 若前端只传日期 `"2026-07-01"` 无时间 → zod `datetime()` 拒绝 (要求完整 ISO)。

### Alternatives Considered
- **开区间**: 拒绝。用户直觉是"包含边界"。
- **只传 date 不传 time**: 拒绝。与 004 occurredAt 时区策略不一致 (Q2 UTC + ISO offset)。

---

## 总结

3 项决策,均对齐宪章 v2.0.0。核心: summary 单独查询 + Drizzle ilike 参数化 + 闭区间日期。
