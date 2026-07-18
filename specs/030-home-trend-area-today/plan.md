# Implementation Plan: 首页趋势图改面积平滑 + 本日支出

**Branch**: `030-home-trend-area-today` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-home-trend-area-today/spec.md`

## Summary

对 027-mobile-home-revamp 已落地的手机端首页 `/dashboard` 做三项增量调整:

1. **趋势图视觉强化**:`LineChart`+`Line` → `AreaChart`+`Area` + `<linearGradient>` 垂直渐变面积填充;曲线沿用 `monotone`(平滑且不跌破 0);动画保持关闭(CLS=0)。
2. **趋势图窗口**:本月每日 → **固定本周**(当前 UTC 周一..周日,7 桶),与 `year`/`month` 输入解耦;今日之后的本周未来日补零。新增 `getCurrentUtcWeekRange(now)` helper,复用 `getDailyTrend`。
3. **本日支出并入 hero 卡**:新增 `dayExpense: number | null` 字段(复用 `getDailyTrend` 1 天窗口 + `.catch(()=>null)` 降级),作为 `monthExpense` 右侧次级较小数字(主从层级),挂 `data-amount` 走既有隐私 CSS。
4. **顺带移除"较上月"环比徽标**(本周窗口下语义不再成立):删除客户端 `prevSummaryQuery` / `comparisonPercent` + 徽标 JSX,**净收益**是减少一次完整 `summary` tRPC 查询并修复一处 operator-precedence bug。

**不新增表、不修改 schema、不新增 migration、不新增依赖**(复用既有 recharts ^3.9.2 + date-ranges + getDailyTrend)。属 MVP 范围内(宪章原则一),无宪章前置依赖。

## Technical Context

**Language/Version**: TypeScript 5.7 + React 19 + Next.js 16(App Router)。

**Primary Dependencies**:
- `recharts ^3.9.2`(已安装,026 引入)——`AreaChart` / `Area` / `linearGradient` 全部既有导出。
- `@heroui/react ^3.2.2`——`Card` 组合式 API(hero 卡复用)。
- Tailwind CSS v4 + oklch token(`--danger` / `--success` / `--muted`)。
- tRPC v11(端到端类型,`dashboard.summary` 字段扩展自动派生)。
- Drizzle + PostgreSQL 16(`getDailyTrend` / `getMonthSummary` 复用,零新查询函数)。
- Better-Auth(`protectedProcedure` + `familyId` 隔离)。

**Storage**: PostgreSQL 16(无 schema 变更)。所有新派生值请求时计算,不持久化。

**Testing**: Vitest + Testing Library(单元/组件)+ testcontainers(集成,真实 PG)。`dashboard.summary` 用 `createCaller` 验证契约。

**Target Platform**: Mobile-First Web(Next.js App Router,SSR + 客户端 hydration);桌面端同页兼容。

**Project Type**: 全栈 Web 应用(T3 Stack:Next.js 全栈 + tRPC + Better-Auth + Drizzle)。

**Performance Goals**: `dashboard.summary` p95 < 500ms(宪章五,扩展后保持)。本 feature 净减少一次完整 summary 查询(R8),且 trend 扫描从整月收窄到 7 天,对 p95 有正向收益。

**Constraints**:
- 宪章五:Mobile-First,10 秒内完成一笔账;首页 p95 < 500ms。
- 宪章五:禁止 N+1;`getDailyTrend` 已是单次范围扫描。
- CLS = 0(027 FR-013 / 025 动态加载):`Area` `isAnimationActive={false}`,加载态 Skeleton 高度 = 稳态 200px。
- 隐私遮蔽不破:新 `dayExpense` 节点挂 `data-amount` 自动走 `.privacy-on [data-amount]`(`globals.css:43-55`),无需改 CSS。
- 宪章七:UI 调整前先查 HeroUI v3 原生 API——本 feature 复用既有 `Card`(027 已查过),无新 HeroUI 组件引入。

**Scale/Scope**: 单家庭单成员 MVP;趋势 7 桶 + 当日 1 桶,扫描行数极小。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

逐条核对 `.specify/memory/constitution.md` v3.2.1 七项原则:

| 原则 | 状态 | 说明 |
|---|---|---|
| 一、MVP 范围 | ✅ 通过 | 三项变更(本日支出 / 本周趋势 / 平滑面积)均为 027 已解锁的收支/趋势展示范围内,不引入 AI/OCR/导入导出/投资/多币种(仍禁止)。无新表、无新 tRPC 路由(`dashboard.summary` 字段扩展,非新 procedure)。 |
| 二、Feature-Sliced(tRPC + App Router) | ✅ 通过 | 趋势/本日支出作为 `dashboard.summary` 的字段扩展返回,不新建 procedure(符合"每路由=一 feature 全部后端入口");前端改 `dashboard` feature 内既有组件(`expense-trend-chart` / `summary-hero-card` / `page.tsx`)。类型由 tRPC 自动派生,无手写契约。 |
| 三、领域驱动 | ✅ 通过 | 不改 `Family` 聚合根、不改 `Transaction` schema、不新增实体。`dayExpense` / 本周趋势均为派生聚合(请求时计算),通过 `familyId` 引用,跨聚合用 ID。退款语义沿用 027 R9(`type='expense'` + 正 amount)。 |
| 四、测试优先 | ✅ 通过(待 tasks 落实) | 测试策略已定(research §测试策略 + contract test scenarios 12-17):`getCurrentUtcWeekRange` 单测、`dashboard.summary` createCaller 契约(本周恒 7 桶、dayExpense 含退款/降级)、组件渲染、testcontainers 集成(跨家庭隔离/未来日补零)。tasks 阶段先红后绿。 |
| 五、性能与极速录入 | ✅ 通过(净收益) | trend 扫描整月 → 7 天(行数减少);移除第二次 `summary` 查询(少一次完整聚合);`getCurrentUtcWeekRange` O(1) CPU。p95 保持 < 500ms 且有正向收益。无 N+1。Mobile-First 保留。 |
| 六、简单(YAGNI) | ✅ 通过 | 复用 `getDailyTrend`(本周 + 今日 1 天两用)、复用 `padDailyBuckets`、复用 `.privacy-on [data-amount]`、复用 HeroUI `Card`。不引入新图表库、新查询函数、新隐私机制、新动画/定时器(窗口拉取时刷新,不自动刷新)。`dayExpense` 不新增 SQL,只换 `getDailyTrend` 窗口参数。 |
| 七、UI 调整纪律(先查 HeroUI) | ✅ 通过 | 本 feature 的 UI 改动:(a) hero 卡加次级数字——复用既有 `Card.Content` + flex(027 已查过 HeroUI);(b) 趋势图改 AreaChart——recharts 非 HeroUI 组件,HeroUI v3 无 chart 组件(已确认),不触发原则七;(c) 趋势卡标题改文案 + 删徽标 `<span>`——纯文案 + 删 JSX,不引入新 HeroUI 组件。无新 token 命名(沿用 `--danger`/`--muted`/`text-muted`)。 |

**Gate 结果**:全部通过,无违反。**Complexity Tracking 表为空**(无需要正当化的违反)。

## Project Structure

### Documentation (this feature)

```text
specs/030-home-trend-area-today/
├── plan.md              # 本文件
├── spec.md              # /speckit-specify 输出(已 /speckit-clarify 增强)
├── research.md          # Phase 0 输出(R1-R10 实现决策)
├── data-model.md        # Phase 1 输出(派生聚合语义,无 schema 变更)
├── quickstart.md        # Phase 1 输出(端到端验证场景)
├── contracts/
│   └── dashboard-summary.md  # dashboard.summary 行为契约(030 扩展)
└── tasks.md             # 待 /speckit-tasks 生成
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── date-ranges.ts                 # [改] 新增 getCurrentUtcWeekRange(now)
├── server/
│   ├── api/routers/
│   │   └── dashboard.ts               # [改] summary:trend 用本周 + 新增 dayExpense 字段(降级)
│   └── db/queries/
│       └── dashboard.ts               # [无改] getDailyTrend / getMonthSummary 复用
├── components/
│   └── dashboard/
│       ├── expense-trend-chart.tsx    # [改] LineChart+Line → AreaChart+Area+<linearGradient>
│       └── summary-hero-card.tsx      # [改] 新增 dayExpense 次级数字(右侧,主从层级)
├── app/
│   └── (app)/dashboard/
│       └── page.tsx                   # [改] 删 prevYm/prevSummaryQuery/comparisonPercent + 徽标;传 dayExpense
└── app/globals.css                    # [无改] .privacy-on [data-amount] 自动覆盖新节点

tests/  (Vitest + testcontainers)
├── unit/lib/date-ranges.test.ts       # [改] 新增 getCurrentUtcWeekRange 用例(周一/周日/跨月)
├── contract/routers/dashboard.test.ts # [改] 新增本周恒 7 桶 + dayExpense 用例(scenarios 12-17)
└── unit/components/
    ├── summary-hero-card.test.tsx     # [改] dayExpense 渲染 + null 降级 + data-amount 遮蔽
    └── expense-trend-chart.test.tsx   # [改] 7 桶 + Area + 渐变 id 存在(既有隐私测试不受影响)
```

**Structure Decision**: 沿用 027 既有 feature-sliced 结构(`dashboard` feature 纵切:router + queries + components + page 同属一个 feature 边界)。本 feature 全部改动落在 `dashboard` feature 切片内 + `lib/date-ranges.ts`(共享纯函数工具)。无新目录、无跨 feature 引入。

## Complexity Tracking

> 无 Constitution Check 违反,本表为空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(无)_ | _(无)_ | _(无)_ |

---

## Phase 0/1 产出索引

- **[research.md](./research.md)** — R1(AreaChart+Area+渐变)/ R2(monotone 曲线)/ R3(动画 CLS)/ R4(隐私)/ R5(getCurrentUtcWeekRange)/ R6(窗口与 month 解耦)/ R7(dayExpense 复用 getDailyTrend 1 天窗口 + 降级)/ R8(删环比徽标 + 修 precedence bug + 净性能收益)/ R9(hero 主从层级)/ R10(标题文案)。
- **[data-model.md](./data-model.md)** — 派生聚合语义(dayExpense / CurrentWeekTrend),无 schema 变更。
- **[contracts/dashboard-summary.md](./contracts/dashboard-summary.md)** — `dashboard.summary` 030 扩展契约(新增 dayExpense、expenseTrend 改本周)+ test scenarios 12-17。
- **[quickstart.md](./quickstart.md)** — 5 个端到端验证场景。

## 下一步

运行 **`/speckit-tasks`** 生成 `tasks.md`(把上述改动拆为可执行的红绿测试 + 实现任务,按 US1 → US2 → US3 优先级排序)。
