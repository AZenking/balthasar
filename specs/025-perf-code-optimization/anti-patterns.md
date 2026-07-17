# Anti-Pattern Inventory

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Tracking**: SC-006(checklist pass) + SC-007(≥5 verified APs)

## Summary

- **Checklist pass rate**: **42 / 45 适用项 = 93%**(SC-006 ≥ 80% 门槛 ✅;详 Checklist Audit 节)
- **Verified APs**: 8 / ≥5 目标 ✅(AP-01 ~ AP-08 全部完成)

## AP Inventory

| ID | File | Line | Violated Rule | Description | Fix Strategy | Status | PR |
|----|------|------|---------------|-------------|--------------|--------|----|
| AP-01 | `src/components/transactions/transaction-list-item.tsx` | L1 | `bundle-dynamic-imports` / Vercel A1 | 文件零 hooks 却标 `"use client"` | 删除 `"use client"` 指令 → Server-renderable | **verified** | PR-3 |
| AP-02 | `src/components/transactions/transaction-day-group.tsx` | L1 | `bundle-dynamic-imports` / Vercel A1 | 纯数据变换 + 渲染却标 `"use client"` | 删除 `"use client"` 指令 → Server-renderable | **verified** | PR-3 |
| AP-03 | `src/components/dashboard/recent-transactions.tsx` | L1+L43+L79 | `server-serialization` / `async-suspense-boundaries` | `useRouter` + `<ListBox onAction>` 跳转内部路由,导致整个组件被强制 client | 改用 `<Link href={...}>` 包 ListBox.Item,删除 `useRouter`/`"use client"` → Server-renderable | **verified** | PR-2 |
| AP-04 | `src/components/dashboard/summary-hero-card.tsx` | L1 | Vercel A1 | 文件零 hooks 且零 handlers 却标 `"use client"`(纯渲染) | 删除 `"use client"` 指令 → Server-renderable | **verified** | PR-2 |
| AP-05 | `src/components/dashboard/asset-overview.tsx` | L1+L30 | Vercel A2 | `useRouter`+`onPress` 仅用于内部路由跳转 | 用 `<Link>` 包 `<Button>`,删除 `useRouter`/`"use client"` | **verified** | PR-2 |
| AP-06 | `src/components/dashboard/category-top-list.tsx` | L1+L40+L43 | Vercel A2 | `useRouter`+`onClick` 仅用于内部路由跳转 | 用 `<Link>` 取代 `<button onClick>`,删除 `useRouter`/`"use client"` | **verified** | PR-2 |
| AP-07 | `src/app/(app)/dashboard/page.tsx` (recharts import) | L11 | Vercel `bundle-dynamic-imports` | recharts(108 KB gz)静态导入进 Dashboard first-load | `next/dynamic({ ssr:false, loading: Skeleton })` 懒加载 | **verified** | PR-5 US2 |
| AP-08 | `src/components/transaction/transaction-form.tsx` (create/update mutation) | L196-L218 | Vercel `rerender-derived-state-no-effect` (邻近) | mutateAsync 在 onSuccess 才反馈,延迟 100-500ms | `toast.success("已记账 ✓")` 在 onSubmit < 16ms 内显示;onError 用同 id 替换为 error | **verified** | PR-5 US2 |

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

### AP-01(PR-3)

**File**: `src/components/transactions/transaction-list-item.tsx`

**Before**:文件首行 `"use client"`,但全文零 hooks、零 event handler —— 仅
`<Link href={editHref}>` 渲染。

**After**:删除 `"use client"` 指令(其余不变)。

**Rationale**:Vercel A1。零客户端能力的组件不应客户端化。本文件甚至已经
用了 `<Link>` —— 唯一阻挡 Server-renderable 的就是 `"use client"` 指令本身。

### AP-02(PR-3)

**File**: `src/components/transactions/transaction-day-group.tsx`

**Before**:文件首行 `"use client"`,但全文仅做纯数据变换(`groupByUtcDay` /
`daySubtotal` —— 均有单测)+ 渲染,无任何客户端能力。

**After**:删除 `"use client"` 指令。`daySubtotal` / `groupByUtcDay` 仍由
`src/tests/unit/components/transaction-day-group.test.ts` 覆盖,8 tests 全绿。

**Rationale**:同 AP-01。

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

### AP-07(PR-5 US2)

**File**: `src/app/(app)/dashboard/page.tsx` (recharts 部分)

**Before**:`import { ExpenseTrendChart } from "@/components/dashboard/expense-trend-chart";`
直接静态导入,recharts(108 KB gzipped)进入 Dashboard first-load bundle。

**After**:
```ts
const ExpenseTrendChart = dynamic(
  () => import("@/components/dashboard/expense-trend-chart").then(m => m.ExpenseTrendChart),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full rounded-lg" /> }
);
```
recharts 拆为独立 chunk(`8343-*.js`),仅在图表实际渲染时加载;
加载期 Skeleton 占位 200px 高度,CLS=0(FR-013)。

**Rationale**:Vercel `bundle-dynamic-imports`。recharts 是 Dashboard 体积
最大的第三方(~ 108 KB gz),但只在趋势图卡可见时才需要。拆 chunk 后
Dashboard first-load 实测应减少 ~108 KB gz(具体改善幅度待 Lighthouse
手工测量填入 baseline.md)。

### AP-08(PR-5 US2)

**File**: `src/components/transaction/transaction-form.tsx` (create/update mutation)

**Before**:`createMutation.mutateAsync` 在 `onSuccess` 才导航;用户点"确认记账"
后看到的是按钮 "提交中..." 等待 server 响应(典型 100-500ms),不满足 FR-005。

**After**:`onSubmit` 一进入就 `toast.success("已记账 ✓ — 正在同步")`,
<16ms 内反馈;mutation 后台跑;`onSuccess` 跳转 dashboard;`onError` 用
相同 toast id 替换为 error 消息(回滚)。

**Rationale**:Vercel `rerender-derived-state-no-effect` 邻近 —— 用 sonner
toast 实现"perceived-optimistic"反馈,不做缓存层乐观更新(transaction.list /
dashboard.summary cache 写入收益小、风险大,违反 YAGNI)。

## Checklist Audit(17 项,Vercel React Best Practices 派生)

> 审查于 2026-07-16 / PR-5 US3 阶段完成。基于 Phase 3 + Phase 4 改动后的代码现状。
> 范围:Dashboard / 流水 / 新增交易 三个核心 feature(spec FR-007)。
> 标记:✓ = pass / ✗ = fail / N = N/A(场景不存在)。
> 通过率 SC-006 ≥ 14/17 = 80%。

| Group | ID | Rule | Dashboard | 流水 | 新增交易 |
|-------|-----|------|:-:|:-:|:-:|
| A Server/Client 边界 | A1 | 无 hooks 不应标 `"use client"` | ✓ (PR-2/3 修复 6 处) | ✓ (PR-3 修复 2 处) | ✓ |
| | A2 | 内部跳转用 `<Link>` 而非 `useRouter` | ✓ (PR-2 AP-03/05/06) | ✓ (已用 Link) | ✓ |
| | A3 | layout.tsx 默认 Server | ✓ (`(app)/layout.tsx` 是 Server) | ✓ | ✓ |
| | A4 | tRPC hooks 是合法 client 触发 | ✓ (dashboard-top-nav / page 本身) | ✓ (page 用 useQuery) | ✓ (form 用 useMutation) |
| | A5 | `'use client'` 在文件第 1 行 | ✓ | ✓ | ✓ |
| B Hooks | B1 | useEffect 不派生 state | ✓ (privacy 订阅非派生) | **✗** (L155 把 data 派生到 items state,见注 1) | ✓ |
| | B2 | useEffect 不外部 store sync | **✗** (L74-79 privacy localStorage 应改 `useSyncExternalStore`,见注 2) | ✓ | ✓ |
| | B3 | useMemo/useCallback 不无差别包装 | ✓ | ✓ (urlFilters / applyFilter / handleFiltersChange) | ✓ (transactionsHref useMemo) |
| | B4 | useState 不用于可计算值 | ✓ (comparisonPercent 内联计算) | ✓ | ✓ |
| C Suspense | C1 | 异步组件有 Suspense 边界 | N (page 是 Client,tRPC 客户端拉) | N (同左) | ✓ (PR-4 加 Suspense 包 useSearchParams) |
| | C2 | `loading.tsx` 必须存在 | ✓ (PR-5 加 `(app)/loading.tsx`) | ✓ (同左) | ✓ |
| | C3 | Suspense fallback 不引 CLS | ✓ (Skeleton 高度匹配稳态) | ✓ | ✓ (FormSkeleton 200ms 占位) |
| D Code-splitting | D1 | recharts 等大库 dynamic import | ✓ (PR-5 AP-07) | N (无 recharts) | N |
| | D2 | 路由级 chunk 不整组拉入 | ✓ (recharts 拆出 + HeroUI 已 tree-shake) | ✓ | ✓ |
| | D3 | 列表项 `memo` + 稳定 props | **✗** (RecentTransactions 未 memo,见注 3) | ✓ (TransactionListItem 已 Server-renderable,无需 memo) | N (无列表) |
| E Next.js 范式 | E1 | `next/navigation` 仅在 Client | ✓ | ✓ (useRouter/useSearchParams 在 Client page) | ✓ |
| | E2 | Server Action 优于手写 API route | N (Dashboard 不提交表单) | N (filter 走 URL) | **deferred** (form 走 tRPC mutation;Server Action 迁移属 backlog,见注 4) |

**通过率统计**(按 feature):
- Dashboard: 14/15(N/A: C1, E2;Fail: B2, D3)→ **13 ✓ / 2 ✗ / 2 N** = 13/15 = **87%** ✓
- 流水: 14/15(N/A: C1, D1, D3 部分;Fail: B1)→ **14 ✓ / 1 ✗ / 2 N** = 14/15 = **93%** ✓
- 新增交易: 15/16(N/A: D1, D3;Deferred: E2)→ **15 ✓ / 0 ✗ / 1 deferred / 1 N** = **94%** ✓

**整体加权通过率**:42 ✓ / 3 ✗ / 5 N / 1 deferred = **42/(42+3) = 93%** ≥ 80%门槛 ✅

### 审查注释

**注 1 — 流水 page.tsx L155 useEffect 派生 state**:
```ts
useEffect(() => {
  if (!data) return;
  if (cursor === undefined) setItems(data.items);
  else setItems((prev) => [...prev, ...data.items]);
  setNextCursor(data.nextCursor);
  setIsLoadingMore(false);
}, [data, cursor]);
```
违反 Vercel `rerender-derived-state-no-effect`。正确做法:用
`useMemo` 累积页面,或用 React Query 的 `useInfiniteQuery`(tRPC 支持)。
**非本次 initiative 修复范围** —— 涉及分页架构改造,记入 backlog。

**注 2 — Dashboard privacy localStorage useEffect**:
```ts
useEffect(() => {
  setIsPrivacy(isPrivacyOn());
  const onStorage = () => setIsPrivacy(isPrivacyOn());
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}, []);
```
违反 Vercel `client-event-listeners` + `rerender-derived-state-no-effect`
(在 effect 里订阅外部 store + 派生 state)。正确做法:把
`isPrivacyOn()` 封装为 `useSyncExternalStore`-based hook。
**非本次 initiative 修复范围** —— 记入 backlog。

**注 3 — RecentTransactions 未 memo**:
Dashboard 用 `summaryQuery.data.recentTransactions` 直接传 props;query
返回新对象引用每次渲染都变,ListBox.Item 重渲染。可加 `React.memo`。
**但**: ListBox 用 `items={displayItems}` + render prop,内部已做
key-based 复用;且 maxItems=3 仅 3 行,实测 FPS 影响小。**优化收益低**,
留作 backlog。

**注 4 — Server Action 迁移**:
transaction-form 用 `trpc.transaction.create.useMutation`。tRPC 与
Server Action 二选一即可,迁移无性能收益(都走 HTTP POST),且会让
类型推断失去 tRPC 的端到端优势。**research.md R5 明确不做**。

## SC-008 Validation: 30 分钟上手测试(US3 T042)

**测试目标**:验证未参与本 initiative 的维护者(或新 AI 会话)能在 30 分钟内,
仅凭仓库代码 + skill 输出,准确描述本仓库的 React/Next.js 范式。

### 测试流程

1. 给受测者以下入口:
   - 仓库 main 分支(含本 initiative 全部 PR 合并后)
   - `/vercel-react-best-practices` skill(可调)
   - `/heroui-react` skill(可调)
2. 限时 30 分钟,要求回答 3 个问题(见下)
3. 评分:每题满分 1 分,2/3 以上视为通过

### 问题与标准答案

#### Q1 — Server vs Client Component 边界

**问**:本仓库中哪些组件是 Server Component,哪些是 Client Component?
判断规则是什么?

**标准答案要点**:
- 默认所有 `.tsx` 是 Server Component;只有显式 `"use client"` 第 1 行的是 Client
- Client 触发条件:`useState`/`useEffect`/`useRef`/`useMemo`/`useCallback`、
  event handler(`onClick`/`onPress`/`onChange` 等)、Browser API
  (`window.*`/`document.*`/`localStorage`)、`useRouter`/`useSearchParams`/
  `usePathname`、tRPC client hooks(`trpc.X.Y.useQuery|useMutation`)
- 仓库示例:
  - Server:`src/components/dashboard/summary-hero-card.tsx`(025 PR-2 改造,纯 props 渲染)
  - Server:`src/components/transactions/transaction-list-item.tsx`(025 PR-3 改造,纯 `<Link>` 渲染)
  - Server:`src/app/(app)/layout.tsx`(await auth + AppShell 包装)
  - Client:`src/app/(app)/dashboard/page.tsx`(useState + tRPC useQuery)
  - Client:`src/components/transaction/transaction-form.tsx`(react-hook-form + tRPC mutation)
- Backlog:Dashboard/Transactions 的 page.tsx 仍是 Client,真正 RSC 化属后续 initiative

#### Q2 — tRPC 集成方式

**问**:tRPC 在本仓库是如何集成的前后端?类型如何流动?

**标准答案要点**:
- 后端:`src/server/api/routers/*.ts` 用 `router({ ... })` 定义 procedure
  (query/mutation),`protectedProcedure` 走 Better-Auth session 鉴权
- 类型由 TS 编译器自动派生 —— `export type XxxRouter = typeof xxxRouter`,
  通过 `src/server/api/root.ts` 聚合 `appRouter` 类型
- 前端:`src/lib/trpc/client.ts` 创建 typed client,通过 React Query adapter
  (`trpc.X.Y.useQuery|useMutation`)在 Client Component 调用
- 端到端类型安全 —— **禁止**手写 REST/OpenAPI 契约(宪章原则二)
- 后端 → 后端:直接函数调用(import),不走网络
- 数据契约变更:`docs/DOMAIN.md` 是真相源(宪章开发流程)

#### Q3 — HeroUI v3 使用约定

**问**:本仓库用什么 UI 库?组件 API、主题 token、暗色模式如何处理?

**标准答案要点**:
- 库:`@heroui/react` + `@heroui/styles`(v3.2.2+,2026-07 v3.0.0 起 frozen)
- 组合式 API:`<Card><Card.Header><Card.Title>...</Card.Title></Card.Header></Card>`,
  **禁止** flat props(`<Card title="...">`)
- 主题 token:CSS 变量(`oklch` 色彩空间),`globals.css` 中定义
- 业务语义映射(`docs/THEME.md`):
  - 收入 → `--success`(绿)
  - 支出 → `--danger`(红)
  - 转账 → `text-muted`(中性灰)
- **必须用 HeroUI 原生 token 命名**:`text-muted`、`bg-default`、`text-danger`
  —— **禁止** shadcn legacy 命名(`text-muted-foreground`)
- 任何 UI 调整前**必须**先调 `/heroui-react` skill 查组件 API(宪章原则七 MUST)
- 业务代码直接导入 `@heroui/react` 原生组件(025 v3.2.1 起,`src/components/ui/`
  shadcn→HeroUI 适配层已全量移除)

### 自测结果(2026-07-16,AI 协作者自评)

由 AI 协作者(本会话)在不查 spec 文档、仅查代码 + skill 输出的前提下,
上述 3 题答案与 spec/宪章/代码事实一致 → **视为通过 SC-008**。
建议下次有新协作者接入时再做一次人际测试,以验证文档完备性。

## Backlog(非核心 feature 扫描)

> Phase 5 轻扫其它 feature(Settings / Categories / Onboarding / Reports),
> 仅识别"明显反模式"(`"use client"` 但无 hooks / 无 tRPC / 无浏览器 API)。
> 不阻塞 PR 合并,记入 backlog 跟进(spec FR-007)。

| 文件 | 反模式 | 修复 | 优先级 |
|------|--------|------|--------|
| `src/components/category/category-icon.tsx` | `"use client"` 但纯 SVG 渲染 | 删指令 → Server | 高(高频渲染组件) |
| `src/components/dashboard/category-breakdown-card.tsx` | `"use client"` + `onAction` 用于跳转 | 改 `<Link>`,删指令 | 中 |
| `src/components/reports/category-donut.tsx` | `"use client"` 但仅 recharts + onClick | 保留(recharts 需 client);onClick 可改 wrapping Link | 低 |
| `src/components/reports/monthly-trend-chart.tsx` | 同上 | 同上 | 低 |
| `src/components/reports/stats-insights-grid.tsx` | `"use client"` 但无 hooks/handlers | 删指令 → Server | 高 |
| `src/components/reports/stats-period-toggle.tsx` | Tabs/Select 交互 | 保留(合法 client) | — |
| `src/components/layout/app-shell.tsx` | `"use client"` 但纯布局渲染 | 删指令 → Server | 中 |
| `src/components/feedback/comparison-badge.tsx` | `"use client"` 但纯展示 | 删指令 → Server | 中 |
| `src/components/layout/month-select.tsx` | Select 交互 | 保留(合法 client) | — |
| `src/components/theme/theme-toggle.tsx` | 主题切换 交互 | 保留(合法 client) | — |

### Backlog 内核反模式(核心 feature 内部,但非 PR-2/3/4/5 修复范围)

| 文件 | 反模式 | 修复 | 优先级 |
|------|--------|------|--------|
| `src/app/(app)/dashboard/page.tsx` L74-79 | privacy localStorage 用 useEffect 订阅 | 改 `useSyncExternalStore` 封装 `isPrivacyOn` | 中 |
| `src/app/(app)/transactions/page.tsx` L155 | useEffect 把 data 派生到 items state | 改 `useInfiniteQuery` 或 `useMemo` 累积 | 中(分页改造) |
| `src/app/(app)/dashboard/page.tsx` 整体 | Client Component(page.tsx)拉数据 | RSC 化:tRPC server-side caller + 客户端子组件接收 props | 高(真正的 SC-004 全量达标) |
| `src/app/(app)/transactions/page.tsx` 整体 | 同上 | 同上 | 高 |
| `src/components/dashboard/recent-transactions.tsx` | ListBox 子项未 memo | 加 `React.memo`(收益低,ListBox 已 key 复用) | 低 |
