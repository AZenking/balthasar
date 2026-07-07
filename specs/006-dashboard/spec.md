# Feature 规约: 首页统计

**Feature 分支**: `006-dashboard`

**创建日期**: 2026-07-07

**状态**: Draft

**输入**: `docs/MVP.md` 列出的 "Dashboard" 功能,基于 004-transaction + 005-transactions-list 的数据

## 概述

首页统计是用户打开 App 后看到的第一屏 —— 一眼回答"本月花了多少、赚了多少、钱花哪了"。本 feature 提供一个聚合查询端点,返回当月收支汇总 + 最近交易 + 支出分类占比,让前端 Dashboard 页面一次性拿到所有数据。

本 feature **不新增表**,仅对 004 的 transactions 表做聚合查询 (SUM + GROUP BY + LIMIT)。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查看首页统计 (Priority: P1)

已登录用户打开首页,系统返回当月 (自然月,按用户本地时区起止) 的收支汇总、最近 5 笔交易、支出按分类的占比排名。

**为何此优先级**: 首页是用户每天打开的第一屏,没有统计 = 用户看不到"今天花了多少"。

**独立测试**: 创建若干交易后调 `dashboard.summary`,返回 `{ monthIncome, monthExpense, monthNet, recentTransactions, topExpenseCategories }`。

**Acceptance Scenarios**:

1. **Given** 当月有多笔收支, **When** 调 `dashboard.summary`, **Then** 返回当月 income/expense/net 汇总 (仅当月,不含其他月份)。
2. **Given** 当月有 10 笔交易, **When** 调 summary, **Then** recentTransactions 返回最近 5 笔 (按 occurredAt DESC)。
3. **Given** 当月支出分布在 3 个分类, **When** 调 summary, **Then** topExpenseCategories 返回 3 项,按金额 DESC 排序,含 categoryName / categoryIcon / amount / percentage。
4. **Given** 当月无交易, **When** 调 summary, **Then** monthIncome=0, monthExpense=0, monthNet=0, recentTransactions=[], topExpenseCategories=[]。
5. **Given** 未登录, **When** 调 summary, **Then** 401。
6. **Given** 上月有交易但本月无, **When** 调 summary, **Then** 本月数据全 0 (不返回上月数据)。

---

### Edge Cases

- "当月" 定义: 以用户请求时刻的 **UTC** 自然月 (每月 1 日 00:00:00 UTC ~ 月末 23:59:59 UTC)。MVP 不做用户本地时区 (UTC 简化,Clarification Q2 已确认 UTC 策略)。
- percentage 计算: `categoryAmount / totalExpense * 100`,保留 1 位小数 (如 33.3%)。
- percentage 总和可能不等于 100% (四舍五入),这是可接受的。
- 跨家庭隔离: summary 自动按 `family_id = $currentFamilyId` 过滤 (与 004 一致)。
- 已归档账户的交易仍计入统计 (归档 ≠ 删除)。
- 并发: 新建交易 + 查 summary 同时 → summary 可能不包含刚建的 (LWW 一致性)。
- 性能: 1000 笔交易规模,summary 聚合 P95 < 500ms (PG 索引 `(family_id, type)` + `(family_id, occurred_at)` 支撑)。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 提供 `dashboard.summary` 查询端点,返回当月收支汇总 + 最近交易 + 支出分类占比。
- **FR-002**: `monthIncome` MUST 等于当月所有 income 交易的 amount 绝对值之和 (signed bigint 中正值之和)。
- **FR-003**: `monthExpense` MUST 等于当月所有 expense 交易的 amount 绝对值之和 (signed bigint 中负值之绝对值)。
- **FR-004**: `monthNet` MUST 等于 `monthIncome - monthExpense`。
- **FR-005**: `recentTransactions` MUST 返回最近 5 笔交易 (按 occurredAt DESC),含 accountName + categoryName + categoryIcon (JOIN,同 004 get)。
- **FR-006**: `topExpenseCategories` MUST 返回当月支出按分类的金额排名 (DESC),每项含 `categoryName`、`categoryIcon`、`amount` (绝对值)、`percentage` (占当月总支出百分比,1 位小数)。
- **FR-007**: "当月" MUST 按 UTC 自然月计算 (每月 1 日 00:00 UTC ~ 月末 23:59:59 UTC)。
- **FR-008**: 所有数据 MUST 自动按 `family_id = $currentFamilyId` 过滤 (跨家庭隔离)。
- **FR-009**: 当月无交易时 MUST 返回全零 + 空数组 (不报错)。
- **FR-010**: `dashboard.summary` 性能 MUST P95 < 500ms (1000 笔交易规模)。
- **FR-011**: 系统 MUST NOT 在本 feature 中提供"自定义日期范围统计" —— 那是 005-transactions-list 的 `includeSummary` 功能,本 feature 固定"当月"。
- **FR-012**: 已归档账户的交易 MUST 仍计入统计 (归档 ≠ 删除)。

### Key Entities

- **DashboardSummary**: 值对象 (非持久化)。字段: `monthIncome` (number)、`monthExpense` (number)、`monthNet` (number)、`recentTransactions` (Transaction[])、`topExpenseCategories` (CategoryBreakdown[])。
- **CategoryBreakdown**: 值对象。字段: `categoryId`、`categoryName`、`categoryIcon`、`amount` (number, 正)、`percentage` (number, 1 位小数)。
- **Transaction** (引用 004): recentTransactions 复用 004 的 serializeTransaction。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户在首页 2 秒内看到完整统计 (当月汇总 + 最近交易 + 分类占比)。
- **SC-002**: `dashboard.summary` 服务端 P95 < 500ms (1000 笔交易,FR-010)。
- **SC-003**: monthIncome + monthExpense + monthNet 与手动 SUM 完全一致 (准确率 100%)。
- **SC-004**: percentage 准确 (categoryAmount / totalExpense * 100, 1 位小数四舍五入)。
- **SC-005**: 跨家庭隔离 —— 用户 A 的 summary 不含用户 B 的数据。
- **SC-006**: 当月无交易 → 全零 + 空数组,不报错。
- **SC-007**: recentTransactions 仅返回最近 5 笔 (不多不少,除非当月不足 5 笔)。

## Assumptions

- "当月" 以 UTC 自然月计算 (与 004 occurredAt UTC 存储一致,Clarification Q2)。
- percentage 1 位小数四舍五入;总和可能 ≠ 100% (可接受)。
- topExpenseCategories 不限制返回数量 —— 当月有多少支出分类就返回多少 (MVP 家庭场景 < 12 种内置分类)。
- 不提供"上月对比" (环比/同比) —— V2 评估。
- 不提供"按账户分组统计" —— V2 评估。
- 不提供"趋势图数据" (按天/周汇总) —— V2 评估。
- 不提供"预算 vs 实际"对比 —— V2 评估 (路线图有"预算")。
- 本 feature 不新增表,仅聚合查询。
- summary 不缓存 (每次请求实时聚合);V2 可考虑物化视图或 Redis 缓存。
