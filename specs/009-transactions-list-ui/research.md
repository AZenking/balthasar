# Phase 0 Research: 009-transactions-list-ui

**Date**: 2026-07-07

## Q1: 分页 — 无限滚动 vs "加载更多"按钮

### Decision
**"加载更多"按钮**。

### Rationale
- 无限滚动需要 IntersectionObserver + 虚拟列表,YAGNI (MVP < 1200 笔/年)。
- 按钮简单: `nextCursor` 存在 → 按钮可见;点击 → 追加到列表;null → 按钮隐藏。
- tRPC useQuery 不原生支持无限滚动 (需 useInfiniteQuery,配置复杂)。
- 按钮点击 = 新 query + merge items,简单可控。

---

## Q2: 筛选状态管理 — URL searchParams vs 客户端 state

### Decision
**客户端 useState** (不用 URL searchParams)。

### Rationale
- MVP 不需要 URL 分享/书签筛选状态 (V2 评估)。
- useState 更简单,无需 Next.js searchParams RSC 交互。
- 筛选变化时:重置 cursor + 刷新 query (tRPC useQuery input 变化自动 refetch)。

---

## Q3: 编辑模式 — 008 表单复用

### Decision
**008 TransactionForm 组件加 `editId` prop**,检测 `?id=` query param 时进入编辑模式。

### Rationale
- 复用 008 表单 UI (类型/账户/分类/金额/备注/日期),避免重复代码。
- 编辑模式: 初始 load 调 `transaction.get({ id })` 预填,提交调 `transaction.update` (而非 create)。
- 新建模式: 不变。
- `/transaction/new` 页面检测 `useSearchParams().get('id')`,传给 TransactionForm。

---

## Q4: 删除确认 — window.confirm vs shadcn Dialog

### Decision
**`window.confirm("确认删除?")`** (MVP 简化)。

### Rationale
- 一行代码,无需额外组件。
- V2 替换为 AlertDialog(更好的 UX + 动画)。1.0.0 已实现为 HeroUI AlertDialog(见 026-cream-amber-revamp)。
- 删除成功后:`utils.transaction.list.invalidate()` 刷新列表 + 小计。

---

## 总结

4 项决策: 加载更多按钮 + useState 筛选 + 008 表单 edit 模式 + window.confirm。
