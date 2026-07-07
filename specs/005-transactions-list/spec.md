# Feature 规约: 流水列表与筛选

**Feature 分支**: `005-transactions-list`

**创建日期**: 2026-07-07

**状态**: Draft

**输入**: 004-transaction 已提供基础 list (cursor 分页 + occurredAt DESC),本 feature 在其上增加**筛选**与**页面小计**

## 概述

家庭记账系统中,流水是用户查看"钱花哪了"的核心页面。004-transaction 已实现基础的 `transaction.list` (cursor 分页、按时间倒序),但不支持按类型/账户/分类/日期筛选,也不提供当页收支小计。

本 feature 在 `transaction.list` 上增加:
- **筛选条件**: type (收入/支出)、accountId、categoryId、日期范围 (startDate/endDate)、remark 关键词
- **页面小计**: 对当前筛选条件下的全部交易 (非仅当前页) 做汇总 —— 总收入、总支出、净结余

本 feature **不新增表**,仅扩展 004 的 query module + procedure input schema。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 多维度筛选流水 (Priority: P1)

已登录用户在流水页通过筛选条件 (类型、账户、分类、日期范围、关键词) 过滤交易列表,看到符合条件的交易 + 筛选结果小计。

**为何此优先级**: 流水是日常最高频页面,筛选是"找到那笔账"的关键能力。

**独立测试**: 创建多笔不同类型/账户/分类/日期的交易后,各筛选条件独立 + 组合使用,结果准确。

**Acceptance Scenarios**:

1. **Given** 家庭下有多笔交易, **When** 调 `transaction.list({ type: 'expense' })`, **Then** 仅返回支出交易。
2. **Given** 多账户, **When** 调 `transaction.list({ accountId })`, **Then** 仅返回该账户的交易。
3. **Given** 多分类, **When** 调 `transaction.list({ categoryId })`, **Then** 仅返回该分类的交易。
4. **Given** 交易跨多月, **When** 调 `transaction.list({ startDate, endDate })`, **Then** 仅返回日期范围内的交易。
5. **Given** 交易有不同 remark, **When** 调 `transaction.list({ keyword: '咖啡' })`, **Then** 仅返回 remark 含"咖啡"的交易。
6. **Given** 多条件组合, **When** 调 `transaction.list({ type: 'expense', accountId, startDate, endDate })`, **Then** 返回同时满足所有条件的交易。
7. **Given** 未登录, **When** 调 list, **Then** 401。
8. **Given** accountId 属于其他家庭, **When** 调 list, **Then** 返回空结果 (不报错,跨家庭 account 过滤后无匹配)。

---

### User Story 2 - 筛选结果小计 (Priority: P1)

已登录用户筛选后,看到该筛选条件下的**全部交易** (非仅当前页) 的总收入、总支出、净结余。

**为何此优先级**: 小计是"我这个月花了多少"的直接答案,没有小计用户需要手动算。

**独立测试**: 创建 3 笔收入 (20000 + 5000 + 3000 = 28000) + 2 笔支出 (5000 + 3000 = 8000),调 list 含 `includeSummary: true`,小计 income=28000, expense=8000, net=20000。

**Acceptance Scenarios**:

1. **Given** 筛选条件下有 100 笔交易 (分 2 页), **When** 调 list 第 1 页含 `includeSummary: true`, **Then** summary 汇总的是全部 100 笔 (非仅 50 笔),summary.income / summary.expense / summary.net 正确。
2. **Given** 无交易, **When** 调 list 含 summary, **Then** summary 全为 0。
3. **Given** 仅支出交易, **When** 调 list 含 summary, **Then** summary.income = 0, summary.expense > 0。
4. **Given** 未登录, **When** 调 list 含 summary, **Then** 401。

---

### Edge Cases

- 筛选条件全部为空 → 等价于 004 基础 list (全量分页)。
- startDate > endDate → 返回空列表 (不报错,语义自然)。
- keyword 空字符串 → 忽略 (等价于不传 keyword)。
- keyword 超过 200 字符 → 截断到 200 (与 remark 最大长度一致)。
- accountId 是已归档账户 → 仍然返回该账户的历史交易 (归档 ≠ 删除,交易保留)。
- categoryId 是内置分类 → 正常工作 (categories 共享,无家庭隔离)。
- summary 计算用 `SUM(amount)` (signed bigint),income = SUM(正),expense = SUM(负的绝对值),net = SUM(amount)。
- 大数据量 (1000 笔) summary 聚合性能 MUST < 500ms (PG 索引支撑)。
- 并发: 筛选 + 新建交易同时进行 → 筛选结果可能不包含刚建的 (cursor 分页一致性,LWW 语义)。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `transaction.list` MUST 支持可选筛选参数: `type`、`accountId`、`categoryId`、`startDate`、`endDate`、`keyword`。
- **FR-002**: `type` 筛选 MUST 仅返回匹配 type 的交易 (income 或 expense)。
- **FR-003**: `accountId` 筛选 MUST 仅返回该账户的交易;跨家庭 accountId 返回空列表 (不报错)。
- **FR-004**: `categoryId` 筛选 MUST 仅返回该分类的交易。
- **FR-005**: `startDate` / `endDate` 筛选 MUST 按 `occurredAt` 过滤,范围闭区间 [startDate, endDate]。
- **FR-006**: `keyword` 筛选 MUST 对 `remark` 做不区分大小写的模糊匹配 (LIKE '%keyword%')。
- **FR-007**: `keyword` 空字符串或仅空白 MUST 被忽略 (等价于不传)。
- **FR-008**: `keyword` 超过 200 字符 MUST 截断到 200。
- **FR-009**: 多条件组合 MUST 用 AND 逻辑 (同时满足所有条件)。
- **FR-010**: 筛选 MUST 与 cursor 分页兼容 —— cursor 仍按 `occurredAt DESC`,筛选条件在 cursor 之上叠加 WHERE。
- **FR-011**: `transaction.list` MUST 支持可选 `includeSummary: boolean` 参数 (默认 false)。
- **FR-012**: 当 `includeSummary: true` 时,响应 MUST 包含 `summary` 字段: `{ income, expense, net }`,汇总的是**当前筛选条件下全部交易** (非仅当前页)。
- **FR-013**: `summary.income` = 该筛选条件下所有 income 交易的 amount 绝对值之和。
- **FR-014**: `summary.expense` = 该筛选条件下所有 expense 交易的 amount 绝对值之和。
- **FR-015**: `summary.net` = `summary.income - summary.expense`。
- **FR-016**: `summary` 计算用数据库聚合 (非应用层遍历),利用 004 已建的索引 `(family_id, type)` + `(family_id, occurred_at)`。
- **FR-017**: `transaction.list` 含筛选 + summary 的响应 MUST 在 P95 < 500ms (1000 笔交易规模,FR-016 索引支撑)。
- **FR-018**: 所有筛选 MUST 自动附加 `family_id = $currentFamilyId` (跨家庭隔离,与 004 一致)。

### Key Entities

- **Transaction** (引用 004): 不新增字段,仅查询扩展。
- **TransactionSummary**: 值对象 (非持久化),字段: `income` (number,正)、`expense` (number,正)、`net` (number,可负)。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户在 2 秒内看到筛选后的流水列表 + 小计 (1000 笔规模)。
- **SC-002**: `transaction.list` 含 3 个以上筛选条件 + summary 的 P95 < 500ms。
- **SC-003**: summary 准确率 100% —— 对任意筛选条件组合,income/expense/net 与手动 SUM 完全一致。
- **SC-004**: keyword 模糊搜索不区分大小写 (英文 remark 场景)。
- **SC-005**: 跨家庭 accountId 筛选返回空列表,不暴露其他家庭数据。
- **SC-006**: startDate > endDate 返回空列表,不报错。
- **SC-007**: cursor 分页 + 筛选组合: 第 2 页用 cursor + 相同筛选条件,结果连续不跳过。

## Assumptions

- 004-transaction 的 `transaction.list` 已实现基础 cursor 分页 + occurredAt DESC,本 feature 在其 input schema 上扩展。
- summary 聚合用 SQL `SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)` + `SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END)`,利用 signed bigint 存储 (004 Q1)。
- keyword 用 PG `ILIKE '%keyword%'` (不区分大小写)。中文不区分大小写无影响 (中文无大小写),但英文 remark 有用。
- startDate/endDate 用 ISO 8601 with offset (与 004 occurredAt 时区处理一致,Q2 UTC 存储)。
- 不实现"按 remark 排序" —— 流水永远按 occurredAt DESC。
- 不实现"按金额范围筛选" (minAmount/maxAmount) —— V2 评估。
- 不实现"导出 CSV" —— V2 评估。
- 不实现"批量删除/编辑" —— V2 评估。
- 已归档账户的交易仍可在筛选中看到 (归档 ≠ 删除)。
