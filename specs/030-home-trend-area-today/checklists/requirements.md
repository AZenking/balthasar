# Specification Quality Checklist: 首页趋势图改面积平滑 + 本日支出

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - 注: recharts / `next/dynamic` / `<linearGradient>` 等出现在 **Assumptions**(实现约束),而非 Functional Requirements。FR 仅描述"平滑曲线""渐变面积""最近 7 天"等用户可观测行为。Assumptions 段记录实现约束是 spec-template 允许的(为 plan 阶段提供上下文),不违反"FR 不含实现细节"。
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed (User Scenarios / Requirements / Success Criteria)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified (跨家庭 / UTC 今天 / 历史月窗口边界 / 单点 / 全 0 / 降级 / 加载态)
- [x] Scope is clearly bounded (纯 UI + 聚合窗口调整,不触碰领域不变量)
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria (FR-001..FR-010 ↔ US1/US2/US3 acceptance)
- [x] User scenarios cover primary flows (本日支出 / 7 天窗口 / 平滑+面积)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification (FR 段无)

## Notes

- 本 spec 建立在 **027-mobile-home-revamp 已落地** 之上,假设 recharts、`getDailyTrend`、`getMonthSummary`、`SummaryHeroCard`、隐私 CSS、`next/dynamic` 加载纪律均已存在(plan 阶段会以既有代码为基线)。已在 Assumptions 显式列出这些复用前提。
- **2026-07-17 Clarification session(5 问)** 澄清了 5 个对实现/测试有实质影响的点,已写入 spec `## Clarifications` 与对应 FR/US/SC/Edge/Assumptions:
  1. hero 卡 **主从层级**(本月大、本日小)—— FR-001/US1。
  2. 趋势窗口**固定为"本周"(周一..周日 UTC),不随月份导航变化**—— 原先"最近 7 天滚动 + 历史月月末锚点"假设被推翻,改为更简单的"当前自然周固定"语义。FR-004/005、US2、SC-006。
  3. 本周未来日**补零**(7 桶固定)—— FR-005、Edge Cases。
  4. **移除"较上月"环比徽标**(本周窗口下语义不成立)—— 新增 FR-009、SC-007。
  5. UTC 边界 + **拉取时刷新**(不自动刷新、不引入定时器)—— 新增 FR-011、Edge Cases。
- **plan 阶段关键实现点**(由 Clarification 派生,供参考):趋势窗口的"本周"语义与所选 month 输入解耦,意味着 `dashboard.summary` 的趋势聚合不再依赖传入的 year/month,而是基于"当前 UTC 周";hero 卡可复用 027 既有 `monthExpense` 主大数字 + 新增次级 `dayExpense`;环比徽标相关的 `prevSummaryQuery` / `comparisonPercent` 客户端逻辑可一并移除。
- 本日支出的"今天"口径选择 UTC 日(与 027 既有口径一致),已在 Assumptions 说明,避免双口径。
- 三项变更均为**纯增量**到 027 既有首页,不修改记账/分类/账户规则,不新增表,属 MVP 范围内(宪章原则一),无宪章前置依赖(对比 027 US1 需要先修宪章)。
