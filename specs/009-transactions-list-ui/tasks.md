---

description: "Task list for 009-transactions-list-ui (流水列表页前端)"

---

# Tasks: 流水列表页 (009-transactions-list-ui)

**Input**: Design documents from `/specs/009-transactions-list-ui/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/README.md, research.md, quickstart.md

**Tests**: 手动浏览器验证。

## Format: `- [ ] [ID] [P?] [Story?] Description`

---

## Phase 1: Setup

无新依赖。

---

## Phase 2: Foundational (组件)

- [X] T001 [P] Create `src/components/transactions/transaction-list-item.tsx` —— 单笔交易行: icon+金额(元)+分类名+账户名+备注+日期+"编辑"和"删除"按钮,接收 `transaction` props + `onEdit(id)` + `onDelete(id)` callbacks
- [X] T002 [P] Create `src/components/transactions/transaction-summary.tsx` —— 收支小计条: 3 列 (收入/支出/结余),接收 `{ income, expense, net }` props,金额分→元转换
- [X] T003 [P] Create `src/components/transactions/transaction-filters.tsx` —— 可折叠筛选区: 类型 tab (全部/支出/收入) + 账户下拉 (`account.list`) + 分类下拉 (`category.list({ type })` 联动),接收当前筛选值 + onChange callbacks,默认收起 `filtersExpanded` state

**Checkpoint**: 3 个子组件就绪,可组装到列表页。

---

## Phase 3: User Story 1+2 — 流水列表 + 筛选 (Priority: P1)

**Goal**: `/transactions` 显示交易列表 + 筛选 + 小计 + 分页

### Implementation

- [X] T004 [US1] Replace `src/app/(app)/transactions/page.tsx` —— `"use client"` 页面: 管理筛选 state (type/accountId/categoryId) + cursor 分页 + items 累积 + "加载更多"按钮;调 `trpc.transaction.list.useQuery({ type, accountId, categoryId, includeSummary: true })` 获取数据;筛选变化时重置 cursor + 清空 items;loading 显示 Skeleton;空数据显示"暂无交易";渲染 TransactionFilters + TransactionSummary + TransactionListItem 列表

**Checkpoint**: US1+US2 可测 —— 列表 + 筛选 + 小计 + 分页完整。

---

## Phase 4: User Story 3 — 编辑交易 (Priority: P2)

**Goal**: 点编辑按钮跳转 008 表单预填数据

### Implementation

- [X] T005 [US3] Update `src/app/(app)/transaction/new/page.tsx` —— 检测 `useSearchParams().get('id')`,若有则传 `editId` prop 给 TransactionForm
- [X] T006 [US3] Update `src/components/transaction/transaction-form.tsx` —— 加 `editId?` prop,若有则: 初始 `trpc.transaction.get.useQuery({ id: editId })` 预填表单,提交调 `trpc.transaction.update.useMutation()` (而非 create),成功后跳转 /transactions (而非 /dashboard)

**Checkpoint**: US3 可测 —— 编辑按钮 → 表单预填 → 修改提交 → 返回列表。

---

## Phase 5: User Story 4 — 删除交易 (Priority: P2)

**Goal**: 点删除按钮 → confirm → 硬删除 → 刷新

### Implementation

- [X] T007 [US4] Update `src/app/(app)/transactions/page.tsx` —— 加删除处理: `window.confirm("确认删除?")` → `trpc.transaction.delete.useMutation()` → `utils.transaction.list.invalidate()` 刷新列表 + 小计

**Checkpoint**: US4 可测 —— 删除确认 → 交易消失 → 小计更新。

---

## Phase 6: Polish

- [X] T008 [P] 验证 Mobile-First: 375px 筛选区折叠 + 列表无横向滚动 (SC-003)
- [X] T009 [P] 验证筛选联动: 选类型 → 分类下拉刷新;筛选 → cursor 重置 (SC-002)
- [X] T010 [P] 验证分页连续: 加载更多不跳过 (SC-006)
- [X] T011 Run [quickstart.md](./quickstart.md) end-to-end browser validation; tick all 6 SC items

---

## Dependencies

- Phase 2 (T001-T003) 阻塞 US1+US2
- US1+US2 (T004) 依赖 Phase 2
- US3 (T005-T006) 依赖 008 TransactionForm (已存在)
- US4 (T007) 依赖 US1+US2 (列表页)
- Polish 依赖所有 US

## MVP 范围

US1+US2 = 列表 + 筛选 (核心体验)。US3+US4 快速跟进。

## Notes

- 不新增后端/表/迁移
- 分页用 cursor + items 累积 + "加载更多"按钮 (不用 useInfiniteQuery)
- 筛选用客户端 useState (不用 URL searchParams)
- 删除用 window.confirm (MVP 简化)
- 编辑复用 008 TransactionForm + editId prop
