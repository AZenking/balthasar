---

description: "Task list for 008-transaction-ui (记账表单前端)"

---

# Tasks: 记账表单 (008-transaction-ui)

**Input**: Design documents from `/specs/008-transaction-ui/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/README.md, research.md, quickstart.md

**Tests**: 手动浏览器验证。

## Format: `- [ ] [ID] [P?] [Story?] Description`

---

## Phase 1: Setup

无新依赖 (复用 007 的 RHF + shadcn/ui)。

---

## Phase 2: Foundational

- [X] T001 [P] Create `src/lib/validators/transaction.ts` —— zod schema: type (income|expense) + accountId (uuid) + categoryId (uuid) + amount (string, regex /^\d+(\.\d{1,2})?$/) + remark (max 200, optional) + occurredAt (string, 默认今天, max=today)

**Checkpoint**: zod 校验 schema 就绪。

---

## Phase 3: User Story 1 — 快速记账 (Priority: P1) 🎯 MVP

**Goal**: 用户在 /transaction/new 选类型/账户/分类/金额,提交后创建交易,跳转 Dashboard

### Implementation for User Story 1

- [X] T002 [US1] Create `src/components/transaction/transaction-form.tsx` —— `"use client"` 表单组件: RHF + zod (T001),类型切换 (收入/支出 tab),账户下拉 (`trpc.account.list.useQuery`),分类下拉 (`trpc.category.list.useQuery({ type })` 类型联动),金额输入 (`inputMode="decimal"` 自动聚焦),备注输入,日期选择 (max=today),提交调 `trpc.transaction.create.useMutation`,金额 `Math.round(parseFloat * 100)` 转分,成功后 `useUtils().dashboard.summary.invalidate()` + `router.push('/dashboard')`,失败显示错误保留表单,loading 禁用按钮
- [X] T003 [US1] Replace `src/app/(app)/transaction/new/page.tsx` —— 替换 007 占位页,渲染 `<TransactionForm />`,无账户时显示"请先创建账户"+ /settings 链接

**Checkpoint**: US1 独立可测 —— 记账表单提交后 Dashboard 更新。

---

## Phase 4: User Story 2 — 默认值与快捷操作 (Priority: P2)

**Goal**: 默认值优化让"10 秒"更容易

### Implementation for User Story 2

- [X] T004 [US2] 在 `src/components/transaction/transaction-form.tsx` 中: 默认 type='expense',默认 accountId=第一个未归档账户,日期默认今天,金额框 `autoFocus` + `inputMode="decimal"`;类型切换时清空 categoryId (旧分类可能类型不匹配)

**Checkpoint**: US2 可测 —— 打开页面默认值正确 + 金额框自动聚焦。

---

## Phase 5: Polish

- [X] T005 [P] 验证 Mobile-First: iPhone SE (375px) 表单无横向滚动 (SC-003)
- [X] T006 [P] 验证错误场景: 金额 0/负数/3 位小数 → 校验拦截 (FR-005/006)
- [X] T007 [P] 验证类型联动: 切收入↔支出,分类列表 ≤ 200ms 刷新 (SC-006)
- [X] T008 Run [quickstart.md](./quickstart.md) end-to-end browser validation; tick all 6 SC items

---

## Dependencies

- Phase 2 (T001) 阻塞 US1
- US1 (T002-T003) 依赖 Phase 2
- US2 (T004) 依赖 US1 (在 T002 基础上优化)
- Polish 依赖所有 US

## MVP 范围

US1 = 完整记账功能。US2 = 体验优化。一次交付。

## Notes

- 不新增后端/表/迁移
- 金额: 前端元 (string) → 提交时分 (integer, Math.round(parseFloat * 100))
- 类型联动: tRPC useQuery input 变化自动 refetch
- Dashboard 刷新: useUtils().dashboard.summary.invalidate()
