# Research: 性能与代码优化 (React Best Practices 对齐)

**Branch**: `025-perf-code-optimization` | **Date**: 2026-07-16
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

> Phase 0 输出。本文件解决 plan.md Technical Context 中的未知项,
> 给出 Vercel React Best Practices 审查清单、基线测量流程、反模式
> 修复技术选型的最终决策与理由。

## R1. Vercel React Best Practices skill 审查清单(SC-006 派生)

### Decision

调用 `vercel-react-best-practices` skill 派生 ≥ 15 项 React/Next.js
范式检查项,作为 SC-006 的"分母"。检查项分组:

**A. Server vs Client Component 边界(5 项)**
- A1: 文件无 `useState` / `useEffect` / `useRef` / 事件 handler / Browser API
  调用时,**不应**有 `"use client"` 指令
- A2: 使用 `useRouter().push(...)` 跳转内部路由且无其它客户端能力时,
  应改用 `<Link>`(Server-renderable)
- A3: 仅在导出 `metadata` / `generateMetadata` 的 page.tsx 内允许不标
  `"use client"`;layout.tsx 默认应为 Server Component
- A4: tRPC 客户端 hooks(`trpc.xxx.useQuery/useMutation`)是合法的
  Client Component 触发条件
- A5: `'use client'` 指令必须在文件第 1 行(不允许空行/注释在前)

**B. Hooks 用法(4 项)**
- B1: `useEffect` 不应用于派生 state(用 `useMemo` 或纯函数取代)
- B2: `useEffect` 不应用于同步外部 store(用 `useSyncExternalStore`)
- B3: `useMemo` / `useCallback` 不应无差别包装(仅在跨渲染相等性有用时)
- B4: `useState` 不应用于可计算值(用 `useMemo` 或 render 期常量)

**C. Suspense 与流式渲染(3 项)**
- C1: 异步数据展示组件**必须**有 Suspense 边界(本地或父级)
- C2: `loading.tsx` 必须存在,且为 Skeleton(非空白)
- C3: Suspense fallback 不能与目标布局差异过大(避免 CLS)

**D. Code-splitting 与 bundle(3 项)**
- D1: 大型第三方(如 `recharts`)必须 `dynamic()` 导入或限制在 Client 子树
- D2: 路由级 chunk 不能整组拉入(用 `next/dynamic` 拆模态/抽屉)
- D3: 重渲染密集的子树(列表项)必须用 `memo` + 稳定 props 引用

**E. Next.js App Router 范式(2 项)**
- E1: `next/navigation` 的 `useRouter` / `usePathname` / `useSearchParams`
  必须在 Client Component 内
- E2: Server Action(`"use server"`)优先于手写 API route 用于表单提交
  (本次 scope 仅观察,不强推迁移 —— 见 R5)

**合计 17 项**,≥ SC-006 的 15 项门槛。

### Rationale

Vercel React Best Practices skill 是 React 19 + Next.js App Router 时代的
官方建议缓存,与本仓库宪章 v3.2.1 冻结栈完全对齐。手工编写审查清单会
漏掉 React 19 / Next 16 新引入的规则(如 `'use client'` 在 compile time
的边界推断)。

### Alternatives Considered

- **自行编写审查清单**:被否,理由是凭陈旧训练记忆(React 17/18 + Page Router
  时代)易遗漏新规则,且与"AI 协作场景下凭印象编码"问题(宪章原则七的
  修订动机)同源。
- **eslint-plugin-react-compiler**:2026 年仍在 RC,启用等于引入新
  运行时依赖,违反宪章原则六 YAGNI;留待 React Compiler GA 后另起
  initiative。
- **react-scan / why-did-you-render**:作为开发期诊断可选 devDep
  (FR-007 不阻塞),不强制引入。

---

## R2. 基线测量与归档流程(SC-004 / SC-005 验证机制)

### Decision

**捕获工具栈**(FR-010 锁定):

1. **JS bundle 体积**:
   - `ANALYZE=true next build` 触发 `@next/bundle-analyzer`
   - 输出 `.next/analyze/` HTML 报告 + 控制台数字
   - 提取首次加载(Dashboard)的 gzipped JS 数值

2. **Lighthouse 指标**(LCP / TTI / FID / CLS):
   - Chrome DevTools → Lighthouse → Mobile preset
   - Throttling: CPU 4× slowdown + Slow 3G(Mid-Tier Mobile)
   - URL: 本地 `next start`(production build)的 `/` 路由(已认证态)
   - 每个数字取 3 次跑测的中位数

3. **滚动 FPS**(SC-002):
   - Chrome DevTools Performance 录制
   - 流水页加载后,鼠标滚轮快速滚动 5 秒
   - 读取 Frames tab 的平均 FPS

**归档格式**(`baseline.md`):

```markdown
# Performance Baseline & After-Measurement

## 环境
- 测量日期: [YYYY-MM-DD]
- Node: v20.x.x
- Chrome: v[XX]
- 设备: [MacBook Pro M1 等]

## Baseline(优化前)
| 指标 | 数值 | 来源 |
|------|------|------|
| Dashboard LCP | [X.X]s | Lighthouse run #1-3 中位数 |
| Dashboard TTI | [X.X]s | Lighthouse |
| Dashboard FID | [X]ms | Lighthouse |
| CLS | [X.XX] | Lighthouse |
| JS gzipped(首次加载) | [X]KB | @next/bundle-analyzer |
| 流水滚动 FPS | [X] | DevTools Performance |

## After(PR #XXX 合并后)
| 指标 | 数值 | 较 baseline | SC 对照 |
|------|------|-------------|---------|
| ... | ... | -X% | SC-00X ✅/❌ |

## PR-by-PR 增量
| PR | 改动 | LCP Δ | Bundle Δ | p95 Δ |
|----|------|-------|----------|-------|
```

### Rationale

- Lighthouse + bundle-analyzer 是 Next.js 生态官方工具,与 App Router
  原生集成,无需新运行时依赖(宪章六)
- "3 次中位数"对抗单次测量抖动,但不到 CI 自动化的工程成本
- `.next/analyze/` 不入 git(已在 `.gitignore`),HTML 报告引用为
  attachment 而非 commit

### Alternatives Considered

- **Lighthouse CI / GitHub Actions 自动化**:被否 —— 单人维护项目的
  YAGNI(已在 clarify Q2 决策)
- **Web Vitals RUM(真实用户监控)**:被否 —— 需要 backend 接收上报
  + 第三方 SaaS 或自建,违反宪章六
- **WebPageTest**:被否 —— 外部 SaaS 引入网络变量,Chrome DevTools
  已是 spec 锁定的权威工具(spec Assumptions)

---

## R3. 反模式修复技术选型(SC-007)

### Decision

**已识别的反模式候选**(codegraph 扫描结果,详见 anti-patterns.md):

| ID | 文件 | 反模式 | 修复方案 | 影响 feature |
|----|------|--------|----------|--------------|
| AP-01 | `src/components/transactions/transaction-list-item.tsx` | `"use client"` 指令但零 hooks | 删除指令 → Server-compatible | 流水 |
| AP-02 | `src/components/transactions/transaction-day-group.tsx` | `"use client"` 但纯数据变换 | 删除指令 → Server-compatible | 流水 |
| AP-03 | `src/components/dashboard/recent-transactions.tsx` | `useRouter` + `onAction` 跳转 | 改 `<Link>` → Server Component | Dashboard |
| AP-04 | `src/components/transactions/transaction-filters.tsx` | 合法 Client(保留) | 仅检查 hooks 用法是否可优化 | 流水 |
| AP-05 | `src/app/(app)/page.tsx` 等 | 待 tasks 阶段扫描 | 可能 Suspense 缺失 / loading.tsx 缺失 | 三个 feature |

**修复原则**(对齐 Vercel skill):
1. **可移除的 `"use client"` 必须移除** —— 最大幅度减少客户端 JS
2. **可改 `<Link>` 的 router.push 必须改** —— Server-prerender + 中键新标签
3. **`useEffect` 派生 state 必须改 `useMemo` / 纯函数**
4. **Suspense 边界必须存在**(loading.tsx + 局部 Suspense)
5. **大型第三方(recharts)必须 `dynamic()`**

### Rationale

每个反模式修复都直接服务于 SC-004(JS 减少 20%)与 SC-001(LCP ≤ 3s):
"use client" 边界外的代码不进入客户端 bundle,直接缩小 first-load JS;
Server-prerender 的 `<Link>` 让浏览器在 hydration 完成前就可发起跳转
预加载。

### Alternatives Considered

- **批量重写为 Server Actions 形态**:被否 —— Server Actions 主要用于
  表单提交,本次重点是组件层(范围外的 State 衔接留待后续 initiative)
- **直接启用 React Compiler(自动 memo)**:被否 —— RC 2026 仍在 RC,
  生产使用风险高(违反宪章六的"缺失能力而非便利"原则)

---

## R4. 视觉等价验证方法(FR-013)

### Decision

**视觉 diff 验证流程**(每个 PR 必跑):

1. 在 PR 分支跑 `next build && next start`
2. Chrome DevTools → Lighthouse → Mobile preset(同基线环境)
3. **CLS 数字必须 = 0 或不上升**(Lighthouse 自动给出)
4. **人工截图对照**:
   - 加载态:允许空白 → Skeleton 的变化(已知改善方向)
   - 稳态:截图与 baseline 视觉相同(布局、间距、颜色、字体)
5. 在 PR 描述附 before/after 截图(主屏、流水、新增交易)

**人工核对清单**(PR 模板):
- [ ] 主屏布局未变(卡片顺序、grid 列数)
- [ ] 流水列表项间距/颜色/字体未变
- [ ] 新增交易表单字段顺序未变
- [ ] 唯一允许的差异:loading Skeleton(已对照 baseline 截图)
- [ ] CLS 数字 ≤ baseline

### Rationale

宪章原则五的"Mobile-First"要求视觉稳定性;宪章原则七(HeroUI v3)要求
UI 改动不破坏 token 体系。把"视觉等价"转成可量化 CLS + 人工核对清单,
避免主观"我觉得差不多"判断。

### Alternatives Considered

- **Chromatic / Percy 等视觉回归 SaaS**:被否 —— 第三方 SaaS +
  付费,违反宪章六 YAGNI
- **Playwright 视觉对比**:可作为 devDep 引入但本次暂不做 —— 单人
  项目人工截图已足够;留待 backlog

---

## R5. Scope 边界与"不做"清单

### Decision

**明确不做**(本次 initiative 范围外):

1. **TypeScript 类型反模式**(`any`、未使用 import、类型放宽)—— 留待
   独立 ts-strict initiative
2. **文件结构 / 目录重组** —— 违反宪章二 Feature-Sliced 已定型
3. **重命名 / 组件 API 重构** —— 增加 PR review 负担,无性能收益
4. **Server Action 迁移** —— 表单提交路径已用 tRPC mutation,迁移到
   Server Action 是大改且无明确性能收益(违反 YAGNI)
5. **React Compiler 启用** —— RC 2026 仍在 RC,等 GA
6. **CI 自动化 Lighthouse / RUM** —— 单人维护 YAGNI
7. **后端 `src/server/**` 优化** —— 后端 p95 已达标,无瓶颈
8. **新依赖引入(运行时)** —— 宪章六硬约束

### Rationale

明确"不做"防止范围蔓延(spec Assumptions 已要求,本节细化)。每个"不做"
项都对应一个潜在 backlog initiative。

### Alternatives Considered

- **全栈性能优化(含 server)**:被否 —— server p95 已达 baseline 目标,
  本次 initiative 聚焦客户端 JS / 渲染,blast radius 更可控
- **顺手做 TypeScript 清理**:被否 —— 违反 spec Clarifications Q1 决策
  (仅 React/Next.js 范式);YAGNI 角度,顺手 = 范围蔓延

---

## R6. PR 切分策略(FR-014 落地)

### Decision

**5 个 PR 计划**:

| PR | 类型 | 范围 | 主要反模式 |
|----|------|------|-----------|
| PR-1 | 工具/基线 | 加 `@next/bundle-analyzer` devDep + `baseline.md` 模板 + 首次基线捕获 | — |
| PR-2 | feature 纵切 | `src/components/dashboard/**` + `src/app/(app)/page.tsx` | AP-03 |
| PR-3 | feature 纵切 | `src/components/transactions/**` + `src/app/(app)/transactions/page.tsx` | AP-01、AP-02 |
| PR-4 | feature 纵切 | `src/components/transaction/**` + `src/app/(app)/transaction/**` | (待 tasks 扫描) |
| PR-5 | 跨 feature 横切 | `src/app/layout.tsx`、`src/app/providers.tsx`、共享 `loading.tsx`、其它 feature 轻扫 | 跨 feature 反模式 |

**每个 PR 独立验收**:
- SC-009(p95 回归护栏):`vitest run --project integration` 跑 create-transaction + dashboard-query 20 次,取 p95
- SC-010(测试全绿):`vitest run` + E2E 手测
- SC-004 增量:在 PR 描述附 `@next/bundle-analyzer` 截图

### Rationale

按 feature 纵切让 reviewer 在熟悉的 feature 上下文内 review,blast radius
锁在单 feature 内;跨 feature 共享部分(全局 providers、layout 壳)单独
横切 PR,避免 feature PR 间相互依赖。

### Alternatives Considered

- **单个大 PR**:被否 —— review 难度高、回归风险大、回滚粒度粗
- **按反模式类型横切**:被否 —— 同一 feature 多次 PR 触及同一文件,
  review 上下文反复重建

---

## Open Questions Resolved

| 来源 | 问题 | 决策 |
|------|------|------|
| Plan Technical Context | Vercel skill 清单如何派生? | R1: 调 skill 取 17 项,5 大组 |
| Plan Technical Context | 基线如何归档可追溯? | R2: baseline.md 模板 + 3 次中位数 |
| Plan Technical Context | 反模式修复技术选型? | R3: 删 "use client" + 改 Link + Suspense + dynamic() |
| Plan Technical Context | 视觉等价如何验证? | R4: CLS=0 + 人工截图对照清单 |
| Spec Edge Case | 优化中已遵循的部分如何标记? | R5: "不做"清单 + backlog |
| Spec Clarifications Q5 | PR 切分粒度? | R6: 5 个 PR(3 纵切 + 1 横切 + 1 工具) |

无未解决项。可直接进入 Phase 1。
