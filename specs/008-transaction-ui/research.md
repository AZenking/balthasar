# Phase 0 Research: 008-transaction-ui

**Date**: 2026-07-07

## Q1: 金额输入处理 — 元 vs 分

### Decision
**前端元 (decimal string),提交时 `Math.round(parseFloat(yuan) * 100)` 转分**。

### Rationale
- 用户输入"35.50"(元)更直觉,不是"3550"(分)。
- 后端 004 接受整数分 (`amount: number` in zod)。
- `Math.round(parseFloat("35.50") * 100)` = 3550,避免浮点精度问题。
- zod schema 校验元: `z.string().regex(/^\d+(\.\d{1,2})?$/)` 或用 `z.number().positive()`。

### Alternatives
- 直接输分: 拒绝。用户不直觉。
- 用第三方 currency input 库: 拒绝。YAGNI,原生 input + regex 够用。

---

## Q2: 类型切换时分类列表刷新 — cache vs refetch

### Decision
**tRPC `useQuery` 自动 cache**,类型变化时 query key 变化自动 refetch。

```typescript
const { data: categories } = trpc.category.list.useQuery({ type: selectedType });
// type=expense → cache key "category.list:{type:'expense'}"
// 切到 income → cache key 变化 → 自动 refetch
```

### Rationale
- tRPC + react-query 自动按 input 做 cache key,类型变化时 key 不同,自动重新请求。
- 首次加载 expense 分类 cache,切 income 时 refetch,切回 expense 时用 cache (instant)。
- 无需手动 refetch 或 invalidate。

---

## Q3: 提交成功后刷新 Dashboard

### Decision
**`utils.dashboard.invalidate()`** (tRPC client 的 `queryClient.invalidateQueries`)。

### Rationale
- 提交后 `router.push('/dashboard')`,但 Dashboard 页面的 `trpc.dashboard.summary.useQuery()` 可能用旧 cache。
- `trpc.useUtils().dashboard.summary.invalidate()` 强制下次 mount 时 refetch。
- 或简单方案: `router.push('/dashboard')` + `router.refresh()` (Next.js RSC refresh)。
- MVP 用 `router.push('/dashboard')` + `queryClient.invalidateQueries` 最简单。

---

## 总结

3 项决策: 元→分转换 + tRPC 自动 cache 类型联动 + invalidate 刷新 Dashboard。
