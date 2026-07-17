# Implementation Plan: 性能与代码优化 (React Best Practices 对齐)

**Branch**: `025-perf-code-optimization` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-perf-code-optimization/spec.md`

## Summary

本次 initiative 对 `src/app/**` 与 `src/components/**` 做 React/Next.js 范式优化,
对齐 Vercel React Best Practices skill 输出的审查清单。聚焦宪章原则五
("性能与极速录入")的热路径 —— Dashboard / 流水 / 新增交易三个核心 feature,
识别并修复至少 5 处 React/Next.js 反模式(典型如:`"use client"` 指令被
无 hook 的纯渲染组件误用、`useRouter`+`onAction` 取代 `<Link>`、`useEffect`
派生可由 `useMemo` 或纯函数取代的状态)。基线与优化后数字存档于
`baseline.md`。PR 按 feature 纵切 + 跨 feature 横切,每个 PR 独立通过
p95 回归护栏与全量测试。

## Technical Context

**Language/Version**: TypeScript 5.7+(已冻结,见 `package.json`)

**Primary Dependencies**(运行时,均已在 `package.json` 锁定,本次不新增):
- Next.js 16(App Router)
- React 19
- tRPC v11(`@trpc/server`、`@trpc/client`、`@trpc/react-query`)
- Better-Auth 1.2+
- Drizzle ORM 0.39+
- HeroUI v3(`@heroui/react` + `@heroui/styles` 3.2+)
- Tailwind CSS v4 + tailwind-variants

**新增 devDependency**:
- `@next/bundle-analyzer`(唯一新增,仅用于基线捕获,不入生产 bundle)

**Storage**: PostgreSQL 16(本次不修改 schema,不动 migration)

**Testing**:
- Vitest 3(`unit` / `procedure` / `integration` projects)
- Testing Library 16(React 组件)
- testcontainers 10(真实 PostgreSQL 集成)

**Target Platform**: Mobile-First Web(PWA),Chrome DevTools Mid-Tier Mobile
(4× CPU slowdown + Slow 3G)为性能基线环境。

**Project Type**: Full-stack Web service(Next.js 单仓单进程)

**Performance Goals**(直接落地宪章原则五):
- Dashboard LCP ≤ 3s,FID ≤ 200ms(SC-001)
- 流水列表滚动 FPS ≥ 50(SC-002)
- 路由切换视觉过渡 ≤ 200ms(SC-003)
- 首次加载 JS(gzipped) 较 baseline 减少 ≥ 20%(SC-004)
- Slow 3G 下 Dashboard TTI ≤ 3.5s,较 baseline 改善 ≥ 25%(SC-005)
- 创建交易 mutation p95 < 300ms,Dashboard query p95 < 500ms(回归护栏 SC-009)

**Constraints**(硬约束):
- 不引入新的运行时依赖达成性能目标(宪章原则六)
- 视觉等价:布局/间距/颜色/字体/交互模式不变,CLS=0;唯一允许的差异是
  loading 反馈从空白→HeroUI v3 Skeleton(FR-013)
- UI 组件层改动(含 Skeleton 引入)必须先查 `/heroui-react` skill(宪章原则七)
- 后端 `src/server/**` 不在本次 scope;后端 p95 由 SC-009 独立护栏

**Scale/Scope**:
- 单人维护 + 单家庭记账场景(宪章原则一)
- 现有 ~25 个 feature spec,本次严格审查 3 个核心 feature、轻扫其它
- 现有代码量:`src/app/**` + `src/components/**` 约 80 个 `.tsx` 文件
- 预期 PR 数:3 个核心 feature PR + 1 个跨 feature 横切 PR + 1 个基线/工具
  PR = 5 个 PR(详 tasks.md)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

宪章 v3.2.1 全部 7 条原则逐条核对:

| 原则 | 状态 | 说明 |
|------|------|------|
| 一、MVP 范围 | ✅ Pass | 本次为性能优化 initiative,不新增 MVP 范围外功能;不动 schema、不引入 AI/OCR/投资/多币种等禁止项 |
| 二、Feature-Sliced(tRPC + App Router) | ✅ Pass | 优化在每个 feature slice 内部进行,不跨 slice 引入抽象;依赖方向 UI → tRPC client → server procedure → Domain → Drizzle 不变 |
| 三、领域驱动设计 | ✅ Pass | `Family` 仍唯一聚合根;不动 domain 纯函数,不动 `src/server/domain/**`;tRPC procedure 输入/输出契约不变(类型由 TS 派生) |
| 四、测试优先 | ✅ Pass | FR-009 + SC-010 强制要求 Vitest 单元/集成 + E2E 全绿;修复反模式必须先观察现有测试转绿、再重构 |
| 五、性能与极速录入 | ✅ Pass | 本 initiative 直接落地;SC-001 ~ SC-005 + SC-009 全部承接宪章五硬指标;Mobile-First + Server Components 优先是核心手段 |
| 六、简单(YAGNI) | ✅ Pass | FR-006 禁止新运行时依赖;仅引入 `@next/bundle-analyzer` devDep;不走 CI 自动化 Lighthouse / RUM;不做投机性框架抽象 |
| 七、UI 调整纪律(/heroui-react skill) | ✅ Pass | FR-011 强制 UI 改动前查 `/heroui-react` skill;Skeleton 引入、className 调整、variant 选择全部触发本约束;token 用 HeroUI 原生(`text-muted` 等) |

**Gate 结果**: 0 violation。无 Complexity Tracking 表项需要填写。

## Project Structure

### Documentation (this feature)

```text
specs/025-perf-code-optimization/
├── spec.md              # ✅ Feature spec(已完成,/speckit-specify)
├── plan.md              # ✅ 本文件(/speckit-plan)
├── research.md          # Phase 0 输出(/speckit-plan,见下文)
├── data-model.md        # Phase 1 输出(本次极简 —— 无新实体)
├── quickstart.md        # Phase 1 输出(基线测量与验证 runbook)
├── contracts/           # Phase 1 输出(UI 视觉等价契约)
│   └── visual-equivalence.md
├── baseline.md          # 任务阶段产出 —— 优化前/后数字归档
├── anti-patterns.md     # 任务阶段产出 —— 反模式清单(before/after)
├── checklists/
│   └── requirements.md  # ✅ Spec quality checklist
└── tasks.md             # Phase 2 输出(/speckit-tasks,本命令不创建)
```

### Source Code (repository root)

```text
src/
├── app/                       # App Router 入口(本次优化重点区域)
│   ├── (app)/                 # 已认证路由组
│   │   ├── page.tsx           # Dashboard 入口
│   │   ├── transactions/page.tsx      # 流水列表
│   │   ├── transaction/new/page.tsx   # 新增交易
│   │   ├── transaction/[id]/edit/page.tsx
│   │   ├── loading.tsx        # Suspense fallback(若缺则补)
│   │   └── ...
│   ├── (auth)/                # 不在本次 scope(登录页)
│   ├── layout.tsx
│   └── providers.tsx          # 全局 providers(可能横切 PR)
├── components/                # 组件层(本次优化重点区域)
│   ├── dashboard/             # 核心 feature 1
│   │   ├── recent-transactions.tsx     # 反模式候选:可改 Server Component
│   │   └── ...
│   ├── transactions/          # 核心 feature 2
│   │   ├── transaction-list-item.tsx   # 反模式:无 hook 却标 "use client"
│   │   ├── transaction-day-group.tsx   # 反模式:纯数据变换却标 "use client"
│   │   ├── transaction-filters.tsx     # 合法 Client Component(保留)
│   │   ├── transaction-summary.tsx     # 已是 Server-compatible
│   │   └── ...
│   ├── transaction/           # 核心 feature 3
│   │   ├── transaction-form.tsx        # 合法 Client(表单交互)
│   │   ├── transaction-drawer.tsx      # 合法 Client
│   │   └── ...
│   └── ...
├── server/                    # ❌ 不在本次 scope
│   ├── api/                   # tRPC router
│   ├── domain/                # 领域纯函数
│   └── db/                    # Drizzle schema + repository
└── lib/                       # 工具(可能横切)

# 测试目录(本次必须保持全绿)
src/tests/
├── unit/                      # Vitest unit
├── procedure/                 # tRPC procedure 契约
└── integration/               # testcontainers + 真实 PG
```

**Structure Decision**: 沿用现有 Feature-Sliced 结构(宪章原则二),不调整目录组织、
不引入新分层。优化严格限定在 `src/app/**` 与 `src/components/**` 内,后端
`src/server/**` 保持不变。

## Complexity Tracking

> 无 Constitution Check violations,本表为空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
