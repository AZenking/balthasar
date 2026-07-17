# Data Model: 029 移动端键盘弹起布局稳定性

**Branch**: `029-mobile-keyboard-layout` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

## 概要

本 feature **不涉及新的领域实体、数据库表、tRPC procedure 或服务端 schema 变更**。改动范围限定在:
- 前端 React hooks(`useVisualViewport`、`useScrollIntoViewOnFocus`)
- 前端组件 inline style / className(TransactionDrawer、TransactionForm、其它 P3 表单)
- 全局 CSS transitions(`globals.css` 加键盘相关过渡)

详细schema 与聚合关系见 `docs/DOMAIN.md` 与 `docs/DATABASE.md`(本 feature 不修改)。

## 涉及的现有 UI 状态(无服务端持久化)

| 状态名 | 范围 | 来源 | 用途 |
|---|---|---|---|
| `keyboardHeight` | 客户端运行时 | `useVisualViewport` hook 从 `window.visualViewport.height` 计算 | 决定 Drawer.Footer / 全屏页 sticky bottom 的 `paddingBottom` |
| `isKeyboardOpen` | 客户端运行时 | 同上,`keyboardHeight > 150` 阈值判断 | 决定是否启用聚焦字段 `scrollIntoView` 与 transition |
| `viewportOffsetTop` | 客户端运行时 | `visualViewport.offsetTop` | iOS Safari 上 toolbar 滚动时的偏移补偿 |

## 与 025-perf-code-optimization 的关系

025 已完成 Server Component 迁移与 Suspense 边界。本 feature 触及的组件(`TransactionDrawer`、`TransactionForm`、`/transaction/new`、`/transaction/[id]/edit`)均已是 `"use client"`(合理:含 `useForm` + `trpc.useMutation`),**不**改变它们的 Server/Client 边界。

## 与 96d470f(已合并到 029 base)的关系

| 已落地内容 | 是否在本 feature 修改 |
|---|---|
| `layout.tsx` `viewportFit: "cover"` | 否 — 复用 |
| `bottom-navigation.tsx` `paddingBottom: max(env(safe-area-inset-bottom), 0px)` | 否 — 复用 |

本 feature 在 96d470f 之上叠加:**键盘高度感知** + **聚焦字段自动滚入** + **保存按钮键盘上方黏附**。

## 不涉及

- 数据库迁移(Drizzle migration):无
- tRPC router 变更:无
- 领域函数变更:无
- 新增依赖:无(仅用浏览器原生 `window.visualViewport` API)
- 服务端代码:无
