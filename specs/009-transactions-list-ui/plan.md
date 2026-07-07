# Implementation Plan: 流水列表页

**Branch**: `009-transactions-list-ui` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

## Summary

实现 `/transactions` 流水列表页 —— 替换 007 占位页。用户查看交易列表 (cursor 分页),筛选 (类型/账户/分类),查看小计 (income/expense/net),编辑 (跳转 008 表单),删除 (确认 + 硬删除)。纯前端,复用 004/005 后端 API。

## Technical Context

复用 001-008 栈,无新依赖。tRPC client hooks + shadcn/ui。

## Constitution Check

| # | 原则 | 状态 |
|---|---|---|
| 一 MVP Scope | ✅ | 流水列表在 MVP 范围 |
| 二 Feature-Sliced | ✅ | 单页面 + 列表/筛选/编辑/删除组件 |
| 三 DDD | ✅ | 纯前端 |
| 四 Test-First | ✅ | 浏览器手动验证 |
| 五 Performance | ✅ | 首次加载 ≤ 2s,cursor 分页 |
| 六 YAGNI | ✅ | window.confirm 替代 dialog;不实现日期范围/关键词搜索 |

**Gate Result**: ✅ ALL PASS。

## Project Structure

不新增后端。修改/新增:
- `src/app/(app)/transactions/page.tsx` — **替换** 007 占位 → 完整流水列表页
- `src/components/transactions/transaction-list-item.tsx` — **新增** 单笔交易行
- `src/components/transactions/transaction-filters.tsx` — **新增** 可折叠筛选区
- `src/components/transactions/transaction-summary.tsx` — **新增** 收支小计条
- `src/app/(app)/transaction/new/page.tsx` — **修改** 008 表单加 edit 模式 (?id=)

## Complexity Tracking

无。
