# Anti-Pattern Inventory

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Tracking**: SC-006(checklist pass) + SC-007(≥5 verified APs)

## Summary

- **Checklist pass rate**: 待 Phase 3 完成后填写(`__ / 17`)
- **Verified APs**: 0 / ≥5 目标

## AP Inventory

| ID | File | Line | Violated Rule | Description | Fix Strategy | Status | PR |
|----|------|------|---------------|-------------|--------------|--------|----|
| AP-01 | `src/components/transactions/transaction-list-item.tsx` | L1 | `bundle-dynamic-imports` / Vercel A1 | 文件零 hooks 却标 `"use client"` | 删除 `"use client"` 指令 → Server-renderable | identified | — |
| AP-02 | `src/components/transactions/transaction-day-group.tsx` | L1 | `bundle-dynamic-imports` / Vercel A1 | 纯数据变换 + 渲染却标 `"use client"` | 删除 `"use client"` 指令 → Server-renderable | identified | — |
| AP-03 | `src/components/dashboard/recent-transactions.tsx` | L1+L43+L79 | `server-serialization` / `async-suspense-boundaries` | `useRouter` + `<ListBox onAction>` 跳转内部路由,导致整个组件被强制 client | 改用 `<Link href={...}>` 包 ListBox.Item,删除 `useRouter`/`"use client"` → Server-renderable | identified | — |

## AP Detail(before/after)

> 在对应 PR 合并时补 before/after 代码片段。

### AP-01

待 PR-3 填写。

### AP-02

待 PR-3 填写。

### AP-03

待 PR-2 填写。

## Checklist Audit(17 项,Vercel React Best Practices 派生)

> 在 Phase 5(US3)统一跑 `/vercel-react-best-practices` skill 审查三个核心 feature 后填写。
> 审查范围限 React/Next.js 范式(spec FR-007)。

| Group | ID | Rule | Dashboard | 流水 | 新增交易 |
|-------|-----|------|-----------|------|----------|
| A Server/Client 边界 | A1 | 无 hooks 不应标 `"use client"` | | | |
| | A2 | 内部跳转用 `<Link>` 而非 `useRouter` | | | |
| | A3 | layout.tsx 默认 Server | | | |
| | A4 | tRPC hooks 是合法 client 触发 | | | |
| | A5 | `'use client'` 在文件第 1 行 | | | |
| B Hooks | B1 | useEffect 不派生 state | | | |
| | B2 | useEffect 不外部 store sync | | | |
| | B3 | useMemo/useCallback 不无差别包装 | | | |
| | B4 | useState 不用于可计算值 | | | |
| C Suspense | C1 | 异步组件有 Suspense 边界 | | | |
| | C2 | `loading.tsx` 必须存在 | | | |
| | C3 | Suspense fallback 不引 CLS | | | |
| D Code-splitting | D1 | recharts 等大库 dynamic import | | | |
| | D2 | 路由级 chunk 不整组拉入 | | | |
| | D3 | 列表项 `memo` + 稳定 props | | | |
| E Next.js 范式 | E1 | `next/navigation` 仅在 Client | | | |
| | E2 | Server Action 优于手写 API route | | | |

## Backlog(非核心 feature 扫描)

> Phase 5 轻扫其它 feature(Settings / Categories / Onboarding / Reports),仅记录"明显反模式"。不阻塞 PR 合并。

待填。
