# Anti-Pattern Inventory

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Tracking**: SC-006(checklist pass) + SC-007(≥5 verified APs)

## Summary

- **Checklist pass rate**: 待 Phase 5 完成后填写(`__ / 17`)
- **Verified APs**: 4 / ≥5 目标(AP-03 / AP-04 / AP-05 / AP-06 在 PR-2 完成)

## AP Inventory

| ID | File | Line | Violated Rule | Description | Fix Strategy | Status | PR |
|----|------|------|---------------|-------------|--------------|--------|----|
| AP-01 | `src/components/transactions/transaction-list-item.tsx` | L1 | `bundle-dynamic-imports` / Vercel A1 | 文件零 hooks 却标 `"use client"` | 删除 `"use client"` 指令 → Server-renderable | identified | PR-3 |
| AP-02 | `src/components/transactions/transaction-day-group.tsx` | L1 | `bundle-dynamic-imports` / Vercel A1 | 纯数据变换 + 渲染却标 `"use client"` | 删除 `"use client"` 指令 → Server-renderable | identified | PR-3 |
| AP-03 | `src/components/dashboard/recent-transactions.tsx` | L1+L43+L79 | `server-serialization` / `async-suspense-boundaries` | `useRouter` + `<ListBox onAction>` 跳转内部路由,导致整个组件被强制 client | 改用 `<Link href={...}>` 包 ListBox.Item,删除 `useRouter`/`"use client"` → Server-renderable | **verified** | PR-2 |
| AP-04 | `src/components/dashboard/summary-hero-card.tsx` | L1 | Vercel A1 | 文件零 hooks 且零 handlers 却标 `"use client"`(纯渲染) | 删除 `"use client"` 指令 → Server-renderable | **verified** | PR-2 |
| AP-05 | `src/components/dashboard/asset-overview.tsx` | L1+L30 | Vercel A2 | `useRouter`+`onPress` 仅用于内部路由跳转 | 用 `<Link>` 包 `<Button>`,删除 `useRouter`/`"use client"` | **verified** | PR-2 |
| AP-06 | `src/components/dashboard/category-top-list.tsx` | L1+L40+L43 | Vercel A2 | `useRouter`+`onClick` 仅用于内部路由跳转 | 用 `<Link>` 取代 `<button onClick>`,删除 `useRouter`/`"use client"` | **verified** | PR-2 |

## Architecture Note(影响 SC-004 实际收益)

PR-2 把 4 个 Dashboard 子组件改为 Server-renderable(删除 `"use client"`),
**但** `src/app/(app)/dashboard/page.tsx` 仍是 Client Component(因为用了
`useState`/`useEffect`/`trpc.useQuery`)。

**影响**:Client parent 渲染的子组件会被强制客户端化,所以本次 PR-2 的
bundle 收益**有限** —— 主要价值是:

1. **可 a11y 改善**:`<Link>` 给出中键新标签、右键复制链接、键盘 focus 等
   原生行为(`<button onClick={router.push}>` 没有)
2. **未来 RSC 迁移门槛降低**:若后续把 dashboard/page.tsx 重构为 Server
   Component(配合 tRPC server-side caller + URL-search-params state),这些
   子组件无需再改
3. **代码意图清晰**:无 hooks 的组件不再误标 `"use client"`,reviewer 一眼
   看出哪些组件真的需要客户端能力

**真正的 bundle -20%(SC-004)** 需要把 `dashboard/page.tsx` 自身 RSC 化,
该工作属于 US2/Phase 4 或独立 initiative(spec research.md R5 明确"不做"清单
中的 "Server Action 迁移" 一项的邻近范围)。本 PR 不做,留待 backlog。

## AP Detail(before/after)

> 在对应 PR 合并时补 before/after 代码片段。

### AP-03(PR-2)

**File**: `src/components/dashboard/recent-transactions.tsx`

**Before**:
```tsx
"use client";
import { useRouter } from "next/navigation";
// ...
export function RecentTransactions(...) {
  const router = useRouter();
  return (
    <ListBox
      onAction={(key) => router.push(`/transactions?edit=${key}`)}
      ...
    >
      {(t) => (
        <ListBox.Item ...>
          <div>...</div>  {/* 非 link,无中键新标签 */}
        </ListBox.Item>
      )}
    </ListBox>
  );
}
```

**After**:
```tsx
import Link from "next/link";
// 无 "use client"
export function RecentTransactions(...) {
  return (
    <ListBox ...>
      {(t) => (
        <ListBox.Item ...>
          <Link href={`/transactions?edit=${t.id}`} aria-label="...">
            <div>...</div>
          </Link>
        </ListBox.Item>
      )}
    </ListBox>
  );
}
```

**Rationale**:Vercel `async-suspense-boundaries` + HeroUI v3 ListBox 支持
Server Component context。整行用 `<Link>` 比按钮 `onClick` 多出:中键新标签、
⌘+click 新标签、右键复制链接、原生 focus ring、prefetch on hover。零 hooks,
无理由客户端化。

### AP-04(PR-2)

**File**: `src/components/dashboard/summary-hero-card.tsx`

**Before**:文件首行 `"use client"`,但无任何 hooks、event handlers、browser
API。纯 `(props) => <Card>...</Card>` 渲染。

**After**:删除 `"use client"`。

**Rationale**:零客户端能力的组件不应标 `"use client"`(Vercel A1)。

### AP-05(PR-2)

**File**: `src/components/dashboard/asset-overview.tsx`

**Before**:`useRouter`+`onPress={() => router.push("/settings")}` × 2 处

**After**:`<Link href="/settings"><Button>...</Button></Link>` × 2 处,
删除 `useRouter`、`"use client"`。

**Rationale**:同 AP-03。

### AP-06(PR-2)

**File**: `src/components/dashboard/category-top-list.tsx`

**Before**:`useRouter`+`<button onClick={() => router.push(`...${categoryId}`)}>` × 每项

**After**:`<Link href={`/transactions?month=${monthKey}&type=expense&categoryId=${item.categoryId}`}>...` × 每项

**Rationale**:同 AP-03。Link 提供原生 a11y + 预加载。

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
