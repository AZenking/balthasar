# Feature 规约: 流水列表页

**Feature 分支**: `009-transactions-list-ui`

**创建日期**: 2026-07-07

**状态**: Draft

**输入**: `docs/MVP.md` "/transactions" 页面,基于 004-transaction + 005-transactions-list 后端 API

## 概述

本 feature 实现 `/transactions` 流水列表页 —— 用户查看所有交易记录,支持按类型/账户/分类筛选,查看当页收支小计,以及快速编辑和删除操作。

后端 005-transactions-list 已提供筛选 + cursor 分页 + summary 聚合,本 feature 是其前端 UI。

本 feature **不新增后端 API**,仅实现前端页面 + 组件。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查看流水列表 (Priority: P1)

已登录用户点底部导航"流水"tab,进入流水列表,看到所有交易按时间倒序排列,每笔显示类型 icon、金额、分类、账户、备注、日期。列表底部"加载更多"按钮翻页。

**为何此优先级**: 流水是日常高频页面,用户查看"钱花哪了"。

**Acceptance Scenarios**:

1. **Given** 有多笔交易, **When** 打开 /transactions, **Then** 按时间倒序显示交易列表,每笔含 icon+金额+分类+账户+备注+日期。
2. **Given** 交易 > 50 笔 (默认每页), **When** 滚到底部, **Then** 显示"加载更多"按钮,点击加载下一页。
3. **Given** 无交易, **When** 打开 /transactions, **Then** 显示"暂无交易"空状态。
4. **Given** 数据加载中, **When** 页面渲染, **Then** 显示骨架屏/loading。
5. **Given** 未登录, **When** 访问 /transactions, **Then** 重定向 /login。

---

### User Story 2 - 筛选 (Priority: P1)

用户在流水页面通过筛选条件过滤交易,看到当页小计 (收入/支出/结余)。

**Acceptance Scenarios**:

1. **Given** 流水页面, **When** 选"仅支出", **Then** 列表刷新仅显示支出交易 + 小计仅含支出。
2. **Given** 流水页面, **When** 选某账户, **Then** 仅显示该账户的交易。
3. **Given** 流水页面, **When** 选某分类, **Then** 仅显示该分类的交易。
4. **Given** 多条件组合, **When** 同时选类型+账户, **Then** 返回满足所有条件的交易。
5. **Given** 筛选后无结果, **When** 列表为空, **Then** 显示"无符合条件的交易"。
6. **Given** 筛选条件改变, **When** 列表刷新, **Then** 分页 cursor 重置 (从第 1 页开始)。

---

### User Story 3 - 编辑交易 (Priority: P2)

用户点击列表中某笔交易的"编辑"按钮,跳转到记账表单 (008 已实现),表单预填该交易数据,用户修改后提交。

**为何此优先级**: P2 —— 用户输错需要纠正,但不阻断核心记账流程。

**Acceptance Scenarios**:

1. **Given** 流水列表, **When** 点击某笔交易的编辑按钮, **Then** 跳转 /transaction/new?id=xxx。
2. **Given** 编辑页, **When** 页面加载, **Then** 表单预填该交易数据 (类型/账户/分类/金额/备注/日期)。
3. **Given** 修改后提交, **When** 后端成功, **Then** 返回流水列表,该笔交易数据已更新。

---

### User Story 4 - 删除交易 (Priority: P2)

用户点击列表中某笔交易的"删除"按钮,确认后硬删除,列表刷新。

**Acceptance Scenarios**:

1. **Given** 流水列表, **When** 点击删除按钮, **Then** 弹出确认"确认删除?"。
2. **Given** 确认对话框, **When** 点"确认", **Then** 交易删除,列表刷新 (该笔消失)。
3. **Given** 确认对话框, **When** 点"取消", **Then** 不删除,对话框关闭。

---

### Edge Cases

- 筛选条件变化时 cursor 必须重置 (否则分页错乱)。
- 删除最后一页的唯一交易后,"加载更多"消失,列表为空。
- 编辑跳转携带交易 ID 作为 query param,表单需检测 `?id=` 判断是新建还是编辑模式。
- 网络断开 → "加载更多"失败,显示"网络错误,请重试"。
- 并发: 删除交易 + 刷新列表 → 列表可能短暂包含已删行 (tRPC cache invalidation 后修正)。
- Mobile-First: 筛选区域可折叠 (展开/收起),节省手机屏幕。
- 小计: 筛选结果实时显示 income/expense/net (005 includeSummary)。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 提供 `/transactions` 页面,展示交易列表 (按 occurredAt DESC)。
- **FR-002**: 每笔交易 MUST 显示: 类型 icon、金额 (元,2 位小数)、分类 icon+名称、账户名称、备注、日期。
- **FR-003**: 系统 MUST 支持无限滚动或"加载更多"按钮分页 (调用 `transaction.list({ cursor })`)。
- **FR-004**: 系统 MUST 提供类型筛选 (全部/仅支出/仅收入)。
- **FR-005**: 系统 MUST 提供账户筛选 (下拉,含"全部账户"选项)。
- **FR-006**: 系统 MUST 提供分类筛选 (下拉,按当前类型筛选条件联动)。
- **FR-007**: 筛选条件变化时 MUST 重置 cursor (从第 1 页开始),并刷新列表。
- **FR-008**: 系统 MUST 显示当前筛选条件下的收支小计 (income/expense/net,调用 `transaction.list({ includeSummary: true })`)。
- **FR-009**: 无交易时 MUST 显示"暂无交易"空状态。
- **FR-010**: 筛选无结果时 MUST 显示"无符合条件的交易"。
- **FR-011**: 每笔交易 MUST 提供"编辑"操作,跳转 /transaction/new?id=交易ID。
- **FR-012**: 每笔交易 MUST 提供"删除"操作,弹出确认对话框,确认后调 `transaction.delete`。
- **FR-013**: 删除成功后 MUST 从列表中移除该交易 + 刷新小计。
- **FR-014**: 数据加载中 MUST 显示 loading 状态 (骨架屏或 spinner)。
- **FR-015**: 所有操作 MUST Mobile-First 适配。
- **FR-016**: 筛选区域 MUST 可折叠 (默认收起,点击展开),节省手机屏幕。

### Key Entities

无新增。复用 004 Transaction + 005 TransactionFilters + TransactionSummary。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 流水列表首次加载 (含 API) ≤ 2 秒。
- **SC-002**: 筛选条件变化后列表刷新 ≤ 1 秒。
- **SC-003**: 页面在 iPhone SE (375px) 上无横向滚动。
- **SC-004**: 小计实时反映筛选结果 (income/expense/net 准确)。
- **SC-005**: 删除交易后列表立即更新 (该笔消失 + 小计刷新)。
- **SC-006**: "加载更多"分页连续不跳过 (cursor 正确传递)。

## Assumptions

- 后端 004-transaction + 005-transactions-list 全部就绪。
- 008-transaction-ui 的记账表单组件可复用 (编辑模式预填)。
- tRPC client hooks 已配置 (007 providers.tsx)。
- 筛选用 `trpc.transaction.list.useQuery({ type, accountId, categoryId, cursor, includeSummary })`。
- 分页用 cursor (005 已实现),前端维护 "已加载全部" 状态 (nextCursor=null)。
- 删除确认用 `window.confirm` (MVP 简化,不用自定义 dialog 组件;V2 评估 shadcn Dialog)。
- 编辑模式: `/transaction/new?id=xxx` query param,008 表单组件需适配 (本 feature 改 008 表单加 edit 模式)。
- 筛选区域可折叠: 默认收起,点击"筛选"按钮展开;展开时显示类型/账户/分类选择器 + 实时小计。
- 不实现日期范围筛选 (005 后端支持,但前端日历组件复杂;V2 评估)。
- 不实现关键词搜索 (005 后端支持,前端搜索框;V2 评估)。
- Mobile-First: 筛选区域折叠后仅显示标题 + 筛选按钮 + 小计摘要。
