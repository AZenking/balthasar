# Research: 首页趋势图改面积平滑 + 本日支出

**Feature**: 030-home-trend-area-today | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

> Phase 0 output of `/speckit-plan`。所有 NEEDS CLARIFICATION 已在 `/speckit-clarify` 阶段解决(5 问),本文件记录**实现层**的调研决策与备选方案。

## R1 — 平滑曲线 + 渐变面积:用 recharts `AreaChart` + `Area` + `<linearGradient>`

**Decision**: 用 recharts `AreaChart` + 单个 `Area`(而非 `ComposedChart` + `Line` + `Area`)。

**Rationale**:
- `Area` 单元素同时渲染**顶部描边(平滑折线)+ 下方填充**——一个 `Area` 设置 `stroke` / `strokeWidth` / `fill="url(#grad)"` 即得到"线 + 渐变面积",无需两套路径。
- `ComposedChart` + `Line` + `Area` 会对同一组点画两次曲线(两条 path 重叠),单系列场景纯属冗余。
- 已确认 recharts **3.9.2** 的 `Area` 类型定义(`node_modules/recharts/types/cartesian/Area.d.ts`):
  - `stroke` / `strokeWidth` / `fill` / `fillOpacity` 并存于同一元素(L207/212/默认 253-275)。
  - `dot` / `activeDot` / `isAnimationActive` 全部与 `Line` 同类型,既有 `dot={{ r: 3, fill: "var(--danger)" }}` / `activeDot={{ r: 5 }}` / `isAnimationActive={false}` 可逐字迁移。
- `AreaChart` / `Area` / `ComposedChart` 均在 `recharts` 主 index 导出(`node_modules/recharts/types/index.d.ts:70,104,106`)。

**渐变定义**(垂直,顶不透明→底透明):
```tsx
<defs>
  <linearGradient id="expenseTrendArea" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.4} />
    <stop offset="100%" stopColor="var(--danger)" stopOpacity={0} />
  </linearGradient>
</defs>
```
- `x1=0 y1=0 x2=0 y2=1` + 默认 `gradientUnits="objectBoundingBox"` → `y` 从 0→1 跨越 area 包围盒的全高,即垂直渐变(FR-007)。
- 顶部 `stopOpacity={0.4}`(spec "较高不透明度"的起点;`Area` 默认 `fillOpacity` 是 0.6,但那是纯色填充,渐变场景下每个 `<stop>` 的 `stopOpacity` 才是控制变量)。
- 底部 `stopOpacity={0}` = 贴 X 轴处全透明。

**Alternatives considered**:
- `ComposedChart` + `Line` + `Area`:同组点画两次,冗余,拒绝。
- 纯色 `fill` 无渐变(`fill="var(--danger)" fillOpacity={0.2}`):不符合 FR-007"垂直渐变"。
- `stroke="none"`:`Area.d.ts:205` 明确 `none` 会抑制顶部线;FR-006 要求有平滑线,拒绝。

## R2 — 曲线 `type`:用 `monotone`(不 overshoot,不会跌破 0)

**Decision**: `type="monotone"`(与既有 `Line` 完全一致,不改)。

**Rationale**:
- 数据约束:日支出恒 `>= 0`(FR-005 `ABS`)。两个非负点之间若插值出负值是视觉 bug。
- `monotone`(= d3 `monotoneX`)**单调性保持**:永不产生邻居范围之外的 y 值 → 不会在高位点和 0 桶之间下穿 0。这正是本数据集的关键约束(工作日有消费、相邻 0 桶——尤其是 FR-005 未来日补零——极常见)。
- `natural` / `basis` / `catmullRom` 均会 overshoot(为 C2 连续性 swing 出数据范围),会在高低点间产生视觉下穿 0。
- `monotone` 对 7 桶仍给出目视平滑、无折角的曲线(FR-006),且与仓库其它图表(`monthly-trend-chart.tsx` 三条 `Line` 均用 `monotone`)风格一致。
- `CurveType` 联合(`node_modules/recharts/types/shape/Curve.d.ts:11`)在 3.9.2 不再含 `catmullRom`(已被移除,最接近的是 `natural`)。

**Alternatives considered**:
- `natural`:cubic spline overshoot,违反 `>= 0` 约束,拒绝。
- `basis`:更平滑但严重 overshoot 且会收缩峰谷,拒绝。
- `monotoneX` / `monotoneY`:`monotone` 是其别名/组合,二者等价;沿用更短的 `monotone`。

## R3 — 动画与 CLS:保持 `isAnimationActive={false}`

**Decision**: `Area` 上设 `isAnimationActive={false}`(与既有 `Line` 一致)。

**Rationale**:
- `Area` 默认 `isAnimationActive: 'auto'`、`animationDuration: 1500`(`defaultAreaProps`),启用时面积高度从基线生长 1.5s,且默认用 `AreaRevealShape`(clipPath 宽度扫描入场)。这会在 chart bbox 内产生可见布局抖动。
- spec **Acceptance US3.5** 与 **SC-003** 要求 CLS=0(对齐 027 FR-013 / 025 动态加载占位纪律)。关闭动画是最直接满足方式。
- 既有 `Line` 已用 `isAnimationActive={false}`,沿用同一约定,风格一致。

## R4 — 隐私模式:面积/描边无需特殊处理

**Decision**: 渐变面积 + 描边在隐私模式下**保持可见**,不挂 `data-amount`、不改样式。

**Rationale**:
- 隐私 CSS(`src/app/globals.css:43-55` 的 `.privacy-on [data-amount]`)**只针对带 `data-amount` 的文本节点**(透明文字 + `::after` 居中 `***`)。
- `Area` 的 `stroke` / `fill="url(#grad)"` 是 SVG 形状,非文本,不被该选择器匹配。
- spec **FR-008** 明确:"趋势图形状(平滑折线 + 渐变面积)保留",只遮蔽 Y 轴刻度(既有 `tickFormatter` 返回 `••`,`expense-trend-chart.tsx:84-86`)和 Tooltip 金额(既有 `data-amount`,`:134-139`/`:162-167`)。两处均无需改动。

## R5 — `getCurrentUtcWeekRange(now)`:新增 date-ranges helper

**Decision**: 在 `src/lib/date-ranges.ts` 新增 `getCurrentUtcWeekRange(now)`,返回 `{ start: Monday 00:00 UTC, end: next Monday 00:00 UTC (excl) }`,镜像 `getUtcWeeksInMonth`(`:80-118`)的 Monday 锚点逻辑。

**Rationale**:
- 现有 `date-ranges.ts` **无** current-week helper(已 grep 确认:无 `currentWeek` / `thisWeek` / `WeekRange`)。`getUtcWeeksInMonth` 返回的是"覆盖某月的所有周",不是"今天所在的周"。
- Monday 锚点逻辑现成(模块私有 `isoWeekday` `:24-26` + `:87-88` 的减法):`weekStart = now - isoWeekday(now.getUTCDay()) * dayMs; weekEnd = weekStart + 7*dayMs`。
- 与 `getUtcMonthRange` 的契约一致(`end` exclusive = 下周一 00:00 UTC),完美对接 `getDailyTrend` 的 `weekStart/weekEnd` 入参(spec **FR-004** 的"当前 UTC 周一..周日")。
- 输入 `now: Date = new Date()`(可注入,便于单测),输出纯 UTC、无副作用、无三方依赖(对齐 date-ranges.ts 顶部注释的"Pure UTC date math — no IO, no deps"约定)。

```ts
export function getCurrentUtcWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const dayMs = 24 * 60 * 60 * 1000;
  const startDow = isoWeekday(now.getUTCDay()); // 0=Mon..6=Sun
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - startDow * dayMs);
  const end = new Date(start.getTime() + 7 * dayMs);
  return { start, end };
}
```

**Alternatives considered**:
- 复用 `getUtcWeeksInMonth` 取最后一项:语义错(那是"覆盖某月的周",最后一项可能不是今天所在周),拒绝。
- 在 router 里内联算 Monday:违反 date-ranges.ts 的"纯函数日期工具集中"约定,且不可单测,拒绝。

## R6 — 趋势窗口与所选 month 解耦:`dashboard.summary` 改用本周

**Decision**: 在 `dashboard.summary`(`src/server/api/routers/dashboard.ts:43-125`)中,趋势聚合改用 `getCurrentUtcWeekRange(now)`,**不再用** `monthStart/monthEnd`;月维度查询(`getMonthSummary` / `getCategoryBreakdown` / `getBudget`)**保持** 用 `monthStart/monthEnd`。

**Rationale**:
- spec **Clarification Q2** 明确:窗口固定为本周,**不随月份导航变化**。月份切换只影响 hero/分类/预算等月维度区块,趋势图始终是本周。
- `now` 在 procedure 内已定义(`:48`),直接 `const { start: weekStart, end: weekEnd } = getCurrentUtcWeekRange(now);` 紧跟 `:54`。
- `getDailyTrend` 入参变量名本就叫 `weekStart/weekEnd`(`:63`),只是今天错传了 `monthStart/monthEnd`(027 注释 `:57` 说明当时是"本月每日")。改传入真本周窗口即满足 FR-004/005,`getDailyTrend` / `padDailyBuckets` 逻辑**零改动**(`getDailyTrend` 对任意 7 天窗口都返回 7 桶,padDailyBuckets 按 day 步进)。
- `ExpenseTrend` 类型(`expense-trend-chart.tsx:42-44`)已支持 `{granularity:"daily", buckets}`,零类型变更——只是 buckets 长度从 28-31 变 7。

**Alternatives considered**:
- 新建 `dashboard.currentWeekTrend` procedure:违反宪章二(feature 纵切 + 最小工程边界),且 trend 与 summary 同源同生命周期,无独立刷新需求,拒绝。
- 客户端从已有 month trend buckets 取最近 7 天:语义错(那是月初至今,不是本周),拒绝。

## R7 — `dayExpense`:复用 `getDailyTrend` 1 天窗口,走 `.catch(()=>null)` 降级

**Decision**: `dayExpense` 在 `dashboard.summary` 内通过 `getDailyTrend({familyId, weekStart: todayStart, weekEnd: todayEnd})` 取 `[0].amount`(`todayStart/End` 由 `getCurrentUtcWeekRange(now)` 衍生或单独算当天),包在 try/catch 中,失败 → `dayExpense: null`(对齐 budget/assets 降级纪律 `:76-82`/`:107-112`)。

**Rationale**:
- 复用 `getDailyTrend` 自动继承正确的聚合语义(`type='expense'` + `Math.abs` 投影 + `padDailyBuckets` 求和 = 含退款冲减的当日净支出,spec **FR-002**)。
- 1 天窗口 `padDailyBuckets` 返回 1 元素数组,`[0].amount` 即当日支出。
- 降级纪律与 budget/assets 完全一致(`try { ... } catch { x = null; }`),前端按 `null` 渲染 `¥--.--`(spec **FR-003** / SC-008)。
- 不新增 SQL 查询函数——`getDailyTrend` 已是通用日窗口聚合,无需为"单日"再加一个 `getTodayExpense`(YAGNI)。

**Alternatives considered**:
- 新增 `getTodayExpense` SQL(镜像 `getMonthSummary` 的 expense fragment):多余抽象,违反 YAGNI;`getDailyTrend` 1 天窗口已足够。
- 客户端从 `expenseTrend.buckets[todayIndex]` 衍生:**拒绝**——trend 有自己的 `.catch` 降级路径,若 trend 降级则 dayExpense 也连带丢失;独立查询让 dayExpense 与 trend 互不连坐,降级语义更清晰。且 trend 的 today 桶索引需要额外计算(本周周几),增加客户端复杂度。
- `dayExpense` 与 trend 共用一次 `getDailyTrend`(本周)再在客户端取 today 桶:同上,降级连坐 + 索引计算,拒绝。

**Today 窗口如何取**:为避免"本周窗口 + 今日窗口"两次算 Monday 的重复,推荐 router 内:
```ts
const { start: weekStart, end: weekEnd } = getCurrentUtcWeekRange(now);
const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
```
(`todayStart` 也可由 weekStart + `isoWeekday(now)` * dayMs 推导,但直接从 `now` 算更可读,且 `Date.UTC` 归一化成本可忽略。)

## R8 — 移除"较上月"环比徽标(FR-009):连带删除第二次 `summary` 查询 + 修复 precedence bug

**Decision**: 删除 `src/app/(app)/dashboard/page.tsx` 的 `prevYm`(`:75-78`)、`prevSummaryQuery`(`:79-82`)、`comparisonPercent`(`:83-90`)及所有 prop drilling,并删 `TrendSection` 内的徽标 `<span>`(`:152-167`)。

**Rationale**:
- spec **Clarification Q4** 明确:窗口改本周后"较上月"语义不再成立,移除徽标(FR-009 / SC-007)。
- **性能副作用(正向)**:`prevSummaryQuery` 是每次首页加载都触发的**第二次** `dashboard.summary` tRPC 查询(整月聚合 + breakdown + recent + budget + assets 全套)。删除它顺带减少一次网络往返 + 一组 DB 查询——对首页 p95(SC-004)是净收益。
- **顺带修复 latent bug**:`:86` `summaryQuery.data?.monthExpense ?? 0 - prevSummaryQuery.data.monthExpense` 有运算符优先级 bug(`??` 优先级低于 `-`,本意 `(?? 0) - prev`)。删除整个块即顺带消除该 bug,无需单独修。
- `expenseTrend` 的 plumbing(`:121`/`:224`/`:257`/`:139`/`:170`)**与徽标独立**,保留——只是数据源服务端从 month-daily 改本周-daily(R6)。

**Alternatives considered**:
- 改为"较上周"徽标(本周合计 vs 上周合计):spec Clarification Q4 的 Option B 已被否决(用户选 A 移除),不采纳。
- 保留徽标但解耦为"始终本月 vs 上月":同卡内同时出现周维度趋势 + 月维度环比,语义混乱,spec Edge Cases 已记录拒绝。

## R9 — hero 卡主从层级:`dayExpense` 作为 `monthExpense` 右侧次级数字

**Decision**: `SummaryHeroCard`(`src/components/dashboard/summary-hero-card.tsx`)新增 `dayExpense: number | null` prop;将现有"本月支出 label + monthExpense 大数字"(`:32-38`)包进 flex 行,右侧加次级"今日" + `dayExpense` 较小数字;`dayExpense === null` 时显示 `¥--.--`(降级)。新 `<span>` 挂 `data-amount` 自动走隐私遮蔽。

**Rationale**:
- spec **Clarification Q1** 明确主从层级:本月支出保持主大数字(`text-2xl/3xl`,027 FR-001 语义不变),本日支出为右侧次级较小数字(如 `text-sm`)。
- 隐私:既有 `.privacy-on [data-amount]`(`globals.css:43-55`)对任意带 `data-amount` 的节点自动遮蔽(透明文字 + `::after` `***`)。新 dayExpense `<span>` 挂 `data-amount` 即自动遮蔽,无需改 CSS 或 privacy.ts(已确认 `summary-hero-card.tsx` 现有三个金额节点 `:34`/`:43`/`:52` 均挂 `data-amount`)。
- `dayExpense: number | null`:`null` 表示查询失败降级;`0` 是合法值(今日无交易,显示 `¥0.00`,spec FR-002)。`null` vs `0` 必须区分(对齐 budget `unset` vs `0` 的区分纪律)。

**Alternatives considered**:
- 并排等大(两主数字):窄屏易溢出,且弱化本月支出的主锚点地位,spec Q1 Option B 已否决。
- 本日为主、本月降级:违反 027 FR-001"本月支出为主数字",Q1 Option C 已否决。

## R10 — 趋势卡标题文案

**Decision**: 趋势卡标题由"支出趋势"改为**"本周支出趋势"**(明确窗口语义,避免与所选月份混淆)。

**Rationale**:
- 窗口固定为本周、不随月份变(Clarification Q2)。若标题仍叫"支出趋势"且用户切到了上月,会出现"标题无周字 + 数据是本周 + hero 是上月"的认知不一致。
- 加"本周"前缀让窗口语义自明,无需额外的副标题/说明。
- X 轴标签继续用既有 `shortDate`(M/D,`expense-trend-chart.tsx:88-92`),本周 7 桶的日期刻度天然可读。

**Alternatives considered**:
- 保留"支出趋势":不传达窗口语义,认知不一致,拒绝。
- "最近 7 天":与 Clarification Q2 决策(固定自然周,非滚动 7 天)措辞不符,拒绝。

## 现有代码迁移清单(本 feature 触及点)

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src/lib/date-ranges.ts` | 新增 | `getCurrentUtcWeekRange(now)` helper(R5)+ 单测 |
| `src/server/api/routers/dashboard.ts` | 修改 | summary 内 trend 用本周窗口(R6);新增 `dayExpense` 字段 + try/catch 降级(R7) |
| `src/server/db/queries/dashboard.ts` | **无改动** | `getDailyTrend` / `getMonthSummary` / `getCategoryBreakdown` 全部复用 |
| `src/components/dashboard/expense-trend-chart.tsx` | 修改 | `LineChart`+`Line` → `AreaChart`+`Area` + `<linearGradient>`(R1/R2/R3/R4);X 轴 daily 标签保持 |
| `src/components/dashboard/summary-hero-card.tsx` | 修改 | 新增 `dayExpense` prop + 右侧次级数字(R9) |
| `src/app/(app)/dashboard/page.tsx` | 修改 | 删除 `prevYm`/`prevSummaryQuery`/`comparisonPercent` + 徽标 JSX + prop drilling(R8);传入 `dayExpense` 给 hero |
| `src/app/globals.css` | **无改动** | 既有 `.privacy-on [data-amount]` 自动覆盖新 dayExpense 节点(R4/R9) |
| `src/lib/privacy.ts` | **无改动** | 既有机制足够 |

## 测试策略(供 tasks 阶段细化)

- **单元**:`getCurrentUtcWeekRange` 单测(周一/周日/跨月边界,如 `now` 落在周日 → start 是 6 天前周一);`expense-trend-chart` 隐私 tickFormatter 既有测试不受影响。
- **契约**:`dashboard.summary` createCaller 测试——断言 `expenseTrend.buckets` 长度 = 7(本周,无论传入哪个月),`dayExpense` = 当日 expense 净额(含退款),`dayExpense` 查询失败 → `null`。
- **组件**:`SummaryHeroCard` 渲染 dayExpense(含 `null` 降级、`data-amount` 遮蔽);`ExpenseTrendChart` 渲染 7 桶 + Area + 渐变 id 存在。
- **集成**(testcontainers 真实 PG):跨家庭隔离 dayExpense;本周窗口含未来日补零;trend 不随 month 输入变化。
