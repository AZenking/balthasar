# Implementation Plan: 记账表单

**Branch**: `008-transaction-ui` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

## Summary

实现 `/transaction/new` 前端记账表单 —— PRD "10 秒记账" 的前端闭环。用户选类型/账户/分类、输金额、提交,创建交易后跳转 Dashboard。纯前端,复用 002/003/004 后端 API。

## Technical Context

复用 001-007 栈,无新依赖。tRPC client hooks + react-hook-form + shadcn/ui。

**Performance**: 表单加载 ≤ 1s;提交 (含网络) ≤ 2s

## Constitution Check

| # | 原则 | 状态 |
|---|---|---|
| 一 MVP Scope | ✅ | 记账表单在 MVP 范围 |
| 二 Feature-Sliced | ✅ | 单页面 + 表单组件 |
| 三 DDD | ✅ | 纯前端,复用后端聚合 |
| 四 Test-First | ✅ | 浏览器手动验证 |
| 五 Performance | ✅ | 10s 目标,类型→分类联动 ≤ 200ms |
| 六 YAGNI | ✅ | 不做拍照/周期/批量;默认值优化最小化 |

**Gate Result**: ✅ ALL PASS。

## Project Structure

不新增后端。修改/新增前端文件:
- `src/app/(app)/transaction/new/page.tsx` — **替换** 007 占位页 → 完整记账表单
- `src/components/transaction/transaction-form.tsx` — **新增** 表单组件
- `src/lib/validators/transaction.ts` — **新增** zod schema

## Complexity Tracking

无。
