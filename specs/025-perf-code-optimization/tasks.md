---

description: "Task list for 025-perf-code-optimization — React/Next.js 性能与代码优化"
---

# Tasks: 性能与代码优化 (React Best Practices 对齐)

**Input**: Design documents from `/specs/025-perf-code-optimization/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/visual-equivalence.md](./contracts/visual-equivalence.md), [quickstart.md](./quickstart.md)

**Tests**: 宪章原则四(测试优先)适用于改动现有代码的 PR;每个 PR 必须通过现有 Vitest 套件 + 新增反模式相关单测(若改动涉及纯函数,如 groupByUtcDay)。

**Organization**: 按 user story 组织(P1=US1 移动端顺滑、P2=US2 弱网、P3=US3 维护者审查)。三个核心 feature 各自纵切 PR(FR-014)。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3(对应 spec.md 三个 user story)
- 包含具体 file path

## Path Conventions

- 单仓单进程(Next.js App Router 全栈)
- `src/app/**` — App Router 入口
- `src/components/**` — 组件层
- `src/server/**` — ❌ 不在本次 scope
- `specs/025-perf-code-optimization/**` — 本 feature 文档与基线归档

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 加 `@next/bundle-analyzer` devDep、缓存 skill 输出。

- [ ] T001 添加 `@next/bundle-analyzer` 到 `package.json` devDependencies(用 pnpm v10 安装)
- [ ] T002 [P] 在 `next.config.ts`(或 `next.config.mjs`)中接入 `withBundleAnalyzer`,通过 `ANALYZE=true` 环境变量触发(参考官方文档,不入默认 build)
- [ ] T003 [P] 调用 `/vercel-react-best-practices` skill 获取 React 19 + Next.js App Router 审查清单(缓存到会话上下文,后续 T036 用)
- [ ] T004 [P] 调用 `/heroui-react` skill 获取 HeroUI v3 `Skeleton`、`Tabs`、`Select` API(props、slot 结构、variant)—— 用于 Phase 3/4 引入 loading Skeleton(FR-011 强制)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 捕获优化前 baseline,作为后续所有 PR 的对照基准(SC-004/SC-005/SC-009 的分母)。

**⚠️ CRITICAL**: Phase 3+ 全部依赖 Phase 2 完成 —— 没有 baseline 就无法证明 SC-004(-20%)与 SC-005(改善 25%)达标。

- [ ] T005 创建 `specs/025-perf-code-optimization/baseline.md`,按 research.md R2 模板填写环境元信息(Node/Chrome/设备/日期)
- [ ] T006 [P] 跑 `ANALYZE=true pnpm build`,从 `.next/analyze/client.html` 提取 `/`、`/transactions`、`/transaction/new` 三个路由的 first-load gzipped JS,写入 `baseline.md` Baseline 区块
- [ ] T007 [P] 启动 `pnpm build && pnpm start`,在 Chrome DevTools Lighthouse(Mobile + CPU 4× slowdown + Slow 3G preset)下,对 `/`、`/transactions`、`/transaction/new` 各跑 3 次,取 LCP/TTI/FID/CLS 中位数写入 `baseline.md`
- [ ] T008 [P] 在已认证 + 流水页有 ≥50 条 transaction 数据的状态下,Chrome DevTools Performance 录制 5 秒快速滚动,读取 Frames tab 平均 FPS,写入 `baseline.md`
- [ ] T009 [P] 跑 `pnpm test:integration` 中 create-transaction + dashboard-query 基准(若无 bench 文件,在 `src/tests/integration/perf/` 临时新建),各跑 20 次,取 p95 写入 `baseline.md`(SC-009 分母)
- [ ] T010 跑 `pnpm test && pnpm type-check && pnpm lint` 确认 baseline 全绿,在 `baseline.md` 末尾记录测试通过数
- [ ] T011 把 Phase 1+2 产出(`@next/bundle-analyzer` 接入 + `baseline.md` + perf bench 文件)作为 **PR-1** 提交(`chore(perf): setup bundle-analyzer + capture baseline`)

**Checkpoint**: baseline 已归档;后续 PR 可对照计算改善百分比。

---

## Phase 3: User Story 1 — 移动端顺滑体验 (Priority: P1) 🎯 MVP

**Goal**: Mid-Tier Mobile 下 Dashboard LCP ≤ 3s + 流水 FPS ≥ 50 + Tab 切换 ≤ 200ms(SC-001/SC-002/SC-003)

**Independent Test**: Chrome DevTools Mid-Tier Mobile 模式下,从 `/` 进入 → 切到 `/transactions` 滚动 → 点新增 → 表单可用,三项指标全部达标。

### US1.A: Dashboard feature slice(PR-2)

- [ ] T012 [P] [US1] 用 codegraph 扫描 `src/components/dashboard/**` 全部 `.tsx`,产出 AP 候选清单(无 hooks 却标 `"use client"` 的文件),记入 `anti-patterns.md`
- [ ] T013 [US1] 修复 **AP-03**:`src/components/dashboard/recent-transactions.tsx` 删除 `"use client"` 指令,把 `<ListBox onAction={(key) => router.push(...)}>` 改为 `<ListBox.Item className="..."><Link href={`/transactions?edit=${t.id}`}>...</Link></ListBox.Item>`,移除 `useRouter` 导入(改 Server-renderable)
- [ ] T014 [P] [US1] 审查 `src/app/(app)/page.tsx`(Dashboard 入口):确认默认 Server Component;若调 `trpc.dashboard.X.useQuery` 在 Client 子树,确保 Suspense 边界 + HeroUI `Skeleton` fallback
- [ ] T015 [US1] 按 `contracts/visual-equivalence.md` §4 跑 Lighthouse 验证 CLS 不上升 + 截图对照;更新 `baseline.md` 的 "After" 区块新增 PR-2 行
- [ ] T016 [US1] 跑 `pnpm test && pnpm type-check && pnpm lint`,提交 **PR-2**(`perf(dashboard): server-component migration for recent-transactions`)

### US1.B: 流水 feature slice(PR-3)

- [ ] T017 [P] [US1] 用 codegraph 扫描 `src/components/transactions/**` 全部 `.tsx`,产出 AP 候选清单,记入 `anti-patterns.md`
- [ ] T018 [US1] 修复 **AP-01**:`src/components/transactions/transaction-list-item.tsx` 删除文件首行 `"use client"`(该文件零 hooks,纯 `<Link>` 渲染),验证 `Link` 仍可中键新标签
- [ ] T019 [US1] 修复 **AP-02**:`src/components/transactions/transaction-day-group.tsx` 删除文件首行 `"use client"`(纯数据变换 `groupByUtcDay` + 渲染,无客户端能力);保留 `daySubtotal`、`groupByUtcDay` 导出供单测
- [ ] T020 [US1] 验证 `src/components/transactions/transaction-filters.tsx` 保持 `"use client"`(合法:`useState` + `trpc.account.list.useQuery` + `trpc.category.list.useQuery`),仅在审查表标注 B1/B3 是否合规
- [ ] T021 [US1] 在 `src/app/(app)/transactions/page.tsx` 中,若 list query 异步加载,包裹 `<Suspense fallback={<Skeleton className="h-14 w-full" /> × 5}>`(Skeleton 行数与典型数据一致,Firebase FR-013 CLS=0)
- [ ] T022 [US1] DevTools Performance 录制流水 5s 快速滚动,确认 FPS ≥ 50(SC-002);Lighthouse CLS 不上升;更新 `baseline.md` after 区块
- [ ] T023 [US1] 跑 `pnpm test && pnpm type-check && pnpm lint`,提交 **PR-3**(`perf(transactions): server-component migration + skeleton loading`)

### US1.C: 新增交易 feature slice(PR-4)

- [ ] T024 [P] [US1] 用 codegraph 扫描 `src/components/transaction/**` 全部 `.tsx`,产出 AP 候选清单,记入 `anti-patterns.md`
- [ ] T025 [US1] 审查 `src/components/transaction/transaction-form.tsx`:确认 `"use client"` 合法(react-hook-form + zod resolver);扫 `useEffect` 是否有派生 state 可改 `useMemo`(B1);若无可改项,在 `anti-patterns.md` 标注 N/A
- [ ] T026 [US1] 审查 `src/components/transaction/transaction-drawer.tsx`:确认 `"use client"` 合法(Modal 状态);检查是否需 `next/dynamic` 拆 chunk(若 gzipped < 5KB 可不拆)
- [ ] T027 [US1] 在 `src/app/(app)/transaction/new/page.tsx` 与 `src/app/(app)/transaction/[id]/edit/page.tsx` 中,若有异步 fetch,包裹 `<Suspense fallback={<表单 Skeleton 占位>}>`;Skeleton 必须占稳态位置(FR-013 CLS=0)
- [ ] T028 [US1] 跑 `pnpm test && pnpm type-check && pnpm lint`,提交 **PR-4**(`perf(transaction): audit form/drawer + add suspense fallbacks`)

**Checkpoint**: 三个核心 feature 完成 Server Component 迁移 + Suspense + Skeleton;Mid-Tier Mobile 三项指标达标。

---

## Phase 4: User Story 2 — 弱网优化 (Priority: P2)

**Goal**: SC-004(JS -20%) + SC-005(TTI 改善 25%) + FR-005(乐观更新 100ms 反馈)

**Independent Test**: Slow 3G 模式下进入 Dashboard → LCP ≤ 3.5s;首屏 JS 较 baseline -20%;点保存交易 < 100ms 出现"已保存"反馈。

### US2 Implementation

- [ ] T029 [P] [US2] 在 Phase 3 合并后跑 `ANALYZE=true pnpm build`,从 `.next/analyze/client.html` 找出 Dashboard 首屏仍包含的最大客户端 chunk(候选:`recharts`、`@dnd-kit/*`、`lucide-react` 整包)
- [ ] T030 [US2] 若 `recharts` 出现在 Dashboard first-load:在 `src/app/(app)/page.tsx`(或 dashboard 组件)用 `next/dynamic(() => import("recharts"), { ssr: false })` 拆 chunk,仅在图表区可见时加载
- [ ] T031 [US2] 若 `lucide-react` 整包被引入(检查 `lucide-react` 命名导入 vs 默认导入),确认所有 import 是命名导入(如 `import { ReceiptText } from "lucide-react"`),tree-shake 友好
- [ ] T032 [US2] 审查 `src/components/transaction/transaction-form.tsx` 的 `trpc.transaction.create.useMutation`:确认 `onMutate` 实现乐观更新(缓存写入 + 回滚),用 DevTools Slow 3G 验证提交后 < 100ms 出现"已保存"反馈(FR-005)
- [ ] T033 [US2] 审查 `trpc.transaction.delete.useMutation` 与 `trpc.transaction.update.useMutation` 同样有 `onMutate` 乐观更新;若缺失,补齐
- [ ] T034 [US2] 验证 `src/app/(app)/loading.tsx` 存在;若缺失,创建(用 HeroUI `Skeleton` 占主屏结构,避免白屏闪烁);若 `(app)/` 子路由有各自 `loading.tsx` 也一并核对
- [ ] T035 [US2] 重跑 `ANALYZE=true pnpm build` + Lighthouse 3 次:验证 SC-004(Dashboard first-load JS 较 baseline -20%)+ SC-005(TTI 改善 ≥ 25%);不达标则回 T030/T031 继续 dynamic-import
- [ ] T036 [US2] 跑 `pnpm test && pnpm type-check && pnpm lint`,提交 **PR-5** 的 US2 部分(`perf(bundle): dynamic-import recharts + optimistic mutations`)

**Checkpoint**: bundle -20% + TTI 改善 25% + 乐观更新生效;弱网用户体验达标。

---

## Phase 5: User Story 3 — 维护者代码审查 (Priority: P3)

**Goal**: SC-006(≥80% checklist pass) + SC-007(≥5 verified APs) + SC-008(30 分钟上手)

**Independent Test**: 调 `/vercel-react-best-practices` skill 17 项 checklist 对照三个核心 feature,≥14 项通过;`anti-patterns.md` 中 ≥5 个 AP 状态 = `verified`;30 分钟内陌生维护者能描述本仓库 React/Next.js 范式。

### US3 Implementation

- [ ] T037 [P] [US2] 在 `anti-patterns.md` 中给 AP-01、AP-02、AP-03 补 `before_code` + `after_code` + 关联 PR-2/3 + 改状态 `identified → verified`
- [ ] T038 [US3] 调 `/vercel-react-best-practices` skill 获取 17 项 checklist;逐项审查 Dashboard / 流水 / 新增交易 三个 feature,把 pass/fill/n/a 结果填入 `anti-patterns.md` 审查表
- [ ] T039 [P] [US3] 用 codegraph 轻扫 `src/components/settings/**`、`src/components/category/**`、`src/components/reports/**`、`src/app/(app)/onboarding/**`,仅识别"明显反模式"(整页 `"use client"` 而无客户端能力);记入 `anti-patterns.md` backlog 区,不阻塞合并
- [ ] T040 [US3] 验证 SC-006 达标:在 `anti-patterns.md` 顶部 summary 行写出"通过 X/17 项"且 X ≥ 14;若不达标回 Phase 3/4 补修复
- [ ] T041 [US3] 验证 SC-007 达标:确认 `anti-patterns.md` 中 `status: verified` 的 AP ≥ 5(AP-01/02/03 + 至少 2 个 US2 横切发现的)
- [ ] T042 [US3] SC-008 自测:让一位未参与本 initiative 的协作者(或新 AI 会话)在不读 spec 的前提下,30 分钟内描述 Server/Client 边界 + tRPC 集成方式 + HeroUI token 体系;三项答对即达标
- [ ] T043 [US3] 提交 **PR-5** 的 US3 部分(`docs(perf): anti-patterns inventory + checklist verification`)

**Checkpoint**: 三项 SC 全部达标,initiative 可文档化收尾。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 跨 feature 一致性 + 最终验收。

- [ ] T044 [P] 验证 FR-011:全 `src/components/**` + `src/app/**` 内 grep `text-muted-foreground`(shadcn legacy)与 `text-muted`(HeroUI 原生),确认前者 0 命中
- [ ] T045 [P] 验证 FR-006:`package.json` 中 `dependencies` 块较 baseline 无新增运行时依赖(仅 `devDependencies` 加了 `@next/bundle-analyzer`)
- [ ] T046 [P] 验证 FR-012:用 TypeScript 编译器 / `eslint-plugin-compat` 检查未使用 ES2024+ 未被广泛 polyfill 的 API;若有,改用替代或加 fallback
- [ ] T047 跑全量 `pnpm test && pnpm test:integration && pnpm type-check && pnpm lint`;SC-010 要求 100% 通过、0 新增 bug
- [ ] T048 跑 p95 bench ×20(create-transaction + dashboard-query);SC-009 要求 p95 < 300ms / 500ms,warm 状态
- [ ] T049 最终视觉 diff:截 `/`、`/transactions`、`/transaction/new`、`/settings` 四张稳态截图,与 `baseline.md` 中的 baseline 对照(只允许 Skeleton 差异)
- [ ] T050 [P] 更新 `docs/AGENTS.md` React/Next.js 范式段落(若本次 initiative 厘清了 Server/Client 边界约定)
- [ ] T051 完整跑一遍 `quickstart.md` §1 ~ §10 作为最终 acceptance gate;在 `baseline.md` 末尾记 "All SC passed" 与日期
- [ ] T052 提交 **PR-5** 的 polish 部分 + 关闭 initiative(`chore(perf): final validation + sc acceptance`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,可立即开始
- **Foundational (Phase 2)**: 依赖 Phase 1 完成(T001+T002 接好 bundle-analyzer 才能跑 T006);**BLOCKS 所有 user story**
- **US1 (Phase 3)**: 依赖 Phase 2;三个 feature slice(A/B/C)内部按 PR-2/3/4 顺序或可并行(不同文件)
- **US2 (Phase 4)**: 依赖 **Phase 3 完成**(因为 SC-004 的 -20% 主要来自 US1 的 Server Component 迁移;Phase 4 测量才有意义)
- **US3 (Phase 5)**: 依赖 **Phase 3 + Phase 4 完成**(审查的代码已合并,AP 才能标 verified)
- **Polish (Phase 6)**: 依赖所有 US 阶段完成

### User Story Dependencies

- **US1 (P1)**: 依赖 Foundational;**无其它 story 依赖**;独立 MVP 增量
- **US2 (P2)**: 依赖 US1(共用代码改动,但验证维度不同 —— bundle/TTI vs FPS/FID)
- **US3 (P3)**: 依赖 US1 + US2(audit 已落地的代码)

### Within Each User Story

- 每个 PR 必须独立通过 `pnpm test` + SC-009 p95 护栏(FR-014)
- 每个 AP 修复 = 单一职责(避免一个 PR 改多个 AP 类型)
- Server Component 迁移前先确认目标文件**真的**无 hooks(用 codegraph 验证)
- 引入 Skeleton 前先调 `/heroui-react` skill 确认 Skeleton slot API

### Parallel Opportunities

- Phase 1: T002/T003/T004 可并行(独立查询 skill、独立改 next.config)
- Phase 2: T006/T007/T008/T009 可并行(独立跑基线测量)
- Phase 3 US1.A/B/C 三个 feature slice 在不同文件树,可由不同 PR 并行推进(若团队 capacity 允许);单人按 PR-2→PR-3→PR-4 顺序更安全
- Phase 4: T029 测量后决定 T030/T031/T032/T033/T034 哪些需要执行(非全部)
- Phase 5: T037/T039 可并行(独立文件 audit)

---

## Parallel Example: User Story 1

```bash
# 假设三人团队 / 三开工作树,US1 三个 feature slice 可并行:
# Worker A — PR-2 Dashboard:
Task T012: codegraph scan src/components/dashboard/**
Task T013: fix AP-03 in src/components/dashboard/recent-transactions.tsx
Task T014: audit src/app/(app)/page.tsx Suspense
Task T015: verify CLS + screenshots
Task T016: commit PR-2

# Worker B — PR-3 流水:
Task T017: codegraph scan src/components/transactions/**
Task T018: fix AP-01 in transaction-list-item.tsx
Task T019: fix AP-02 in transaction-day-group.tsx
Task T021: wrap Suspense + Skeleton in /transactions/page.tsx
Task T022: verify FPS + CLS
Task T023: commit PR-3

# Worker C — PR-4 新增交易:
Task T024: codegraph scan src/components/transaction/**
Task T025: audit transaction-form.tsx useEffect → useMemo opportunities
Task T026: audit transaction-drawer.tsx
Task T027: add Suspense fallbacks to /transaction/new/page.tsx
Task T028: commit PR-4
```

单人顺序执行:Worker A → B → C,合并冲突最小。

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup(`@next/bundle-analyzer` + skill 缓存)
2. 完成 Phase 2: Foundational(baseline 归档)—— **CRITICAL,阻塞所有 US**
3. 完成 Phase 3: User Story 1(三个核心 feature 的 Server Component 迁移 + Suspense + Skeleton)
4. **STOP and VALIDATE**:
   - SC-001(LCP ≤ 3s)
   - SC-002(FPS ≥ 50)
   - SC-003(路由 ≤ 200ms)
   - SC-009(p95 不回归)
   - SC-010(测试全绿)
5. 若产品需要,即可发布 MVP —— 移动端顺滑体验已达标

### Incremental Delivery

1. Phase 1 + 2 → baseline 锁定,可证明改善
2. + Phase 3 (US1) → **MVP**:移动端顺滑;Dashboard/流水/新增交易 已优化
3. + Phase 4 (US2) → 弱网用户也达标;bundle -20%
4. + Phase 5 (US3) → 可维护性达标;代码审查清单归档
5. + Phase 6 (Polish) → 最终验收 + 文档更新

### Parallel Team Strategy

- 单人维护(本仓库实际情况):按 PR-1 → PR-2 → PR-3 → PR-4 → PR-5(US2) → PR-5(US3) → PR-5(polish) 顺序执行
- 若有协作者:Phase 3 三个 feature slice 可三人并行(独立文件树,合并冲突几乎为零)

---

## Notes

- 每个任务必须保留 file path 与 AP/SC/FR 引用,便于 PR review 与 `anti-patterns.md` 追溯
- AP 修复任务(T013/T018/T019/...)在 PR 描述必须附 before/after code 片段
- 任何 UI 改动(Skeleton 引入、className 调整)前必须调 `/heroui-react` skill(FR-011)
- 后端 `src/server/**` **不动**;若意外触发(如 procedure 输入/输出),回退 + 评估是否需要回 spec 阶段
- 不引入新运行时依赖;仅 `@next/bundle-analyzer` devDep
- 每完成一个 PR 更新 `baseline.md` after 区块,保持可追溯
