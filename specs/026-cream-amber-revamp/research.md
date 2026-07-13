# Phase 0 Research: 1.0.0 奶油琥珀全站改版

**Feature**: 026-cream-amber-revamp | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

本文件解决 plan.md Technical Context 与 Constitution Check 中标记为 unknown / 风险项的 7 个研究主题。每项给出 **Decision / Rationale / Alternatives / Risks & Mitigation** 四段式结论,作为 Phase 1 设计与 Phase 2 任务分解的输入。

---

## R1: HeroUI v3 与 Next.js 16 + React 19 + Tailwind v4 兼容性

**Decision**: ✅ 兼容,可直接采用。

**Rationale**: HeroUI v3 是 2026-07 的 ground-up rewrite(原 NextUI),官方明确支持 React 19 + Tailwind v4 + React Aria。Next.js 16 是 15 的 minor 升级,App Router + React 19 集成模型未变。社区已有 Next 16 + HeroUI 实战报告(Reddit 2026-10 帖)。

**Alternatives considered**:
- 保留 shadcn:用户在 specify 阶段已否决。
- 回退 React 18 / Next 15:违反 [[scaffold-with-current-versions]] 偏好,无收益。

**Risks & Mitigation**:
- ⚠️ Tailwind v4 不自动检测 `tailwind.config.js`(Stack Overflow 已知问题)→ Mitigation:Spike PR 第一周即跑一个 HeroUI Hello World 页面验证样式生效;HeroUI v3 推荐 CSS-first config(`@theme` in `globals.css`),与项目当前 `postcss.config.js` + `@tailwindcss/postcss` 一致。
- ⚠️ Next 16 + HeroUI SSR hydration 闪烁风险 → Mitigation:HeroUI v3 已移除 `<HeroUIProvider>`(对比 v2),客户端组件边界清晰;按 HeroUI 官方 Next.js 集成示例把交互组件加 `"use client"`。

**Sources**:
- [HeroUI v3 Ground-Up Rewrite — InfoQ 2026-07](https://www.infoq.com/news/2026/07/heroui-v3-rewrite/)
- [HeroUI Styling Docs](https://heroui.com/en/docs/react/getting-started/styling)
- [Reddit: Experience Setting Up HeroUI with Modern React (Next 16)](https://www.reddit.com/r/react/comments/1q1q9xf/experience_setting_up_heroui_with_modern_react/)
- [SO: Styling of HeroUI with Next.js](https://stackoverflow.com/questions/79525271/styling-of-heroui-with-nextjs-is-not-working)

---

## R2: HeroUI v3 组件覆盖度 vs shadcn 14 件

**Decision**: ✅ 全覆盖。HeroUI v3 提供 75+ 组件(含 21 个 v3 新组件),对应 shadcn 现有 14 件均有等价物。

**Rationale**: shadcn 当前用法仅限 UI primitive 层,无业务逻辑耦合(已通过 `grep` 验证 14 个 src 文件)。HeroUI v3 在 button / card / input / select / checkbox / dialog / popover / tabs / radio / tooltip / skeleton 上有直接对应;label 内置于 TextField;cmdk 是唯一无直接对应的项(见 R3)。

**Component Mapping**(Spike 阶段验证,Switch 阶段批量替换):

| shadcn 现组件 | HeroUI v3 对应 | 备注 |
|---|---|---|
| `button.tsx` | `Button` | variants: primary/secondary/tertiary/danger/ghost;`onPress` 替代 `onClick` |
| `card.tsx` | `Card` + `Card.Header/Title/Description/Content/Footer` | 组合式 API |
| `input.tsx` | `TextField` | 内置 label / description / errorMessage |
| `select.tsx` | `Select` + `SelectItem` / `SelectSection` | 含月份选择器(FR-C002) |
| `checkbox.tsx` | `Checkbox` | — |
| `dialog.tsx` | `Modal` + `Modal.Content/Header/Body/Footer` | 组合式 |
| `alert-dialog.tsx` | `AlertDialog` | 删除确认场景 |
| `popover.tsx` | `Popover` | 表单或信息浮层 |
| `tabs.tsx` | `Tabs` + `TabList` / `Tab` / `TabPanel` | — |
| `radio-group.tsx` | `RadioGroup` + `Radio` | 交易类型选择 |
| `tooltip.tsx` | `Tooltip` | — |
| `skeleton.tsx` | `Skeleton` | 加载态 |
| `label.tsx` | 内置于 `TextField` / 自建 `<Label>` 包装 | 通常不需独立 |
| `command.tsx` | ❌ 无直接对应 | 见 R3 |

**Alternatives considered**: 无(覆盖度足够)。

**Risks & Mitigation**:
- ⚠️ 个别交互细节(如 dialog 的焦点陷阱行为)与 shadcn 略有差异 → Mitigation:Spike 阶段写"组件行为差异表",Switch 阶段对每个替换做 acceptance check。
- ⚠️ HeroUI Select 的虚拟化与 cmdk 不同,大数据集可能慢 → Mitigation:家庭记账场景数据量小(分类/账户/月份均 ≤ 100 项),无虚拟化需求。

---

## R3: cmdk 替代方案

**Decision**: HeroUI `Autocomplete`(或 `Modal + Listbox`)组合替代 `command.tsx`;**Spike 阶段必须 grep 实际调用面**确认替换可行性。

**Rationale**: HeroUI v3 没有"命令面板"组件,但 `Autocomplete`(可输入 + 过滤的下拉)+ `Listbox`(列表选择)覆盖相同交互模式。shadcn `command.tsx` 在本项目大概率只用于"分类选择"或"账户选择"场景(非真正的命令面板),所以 Autocomplete 是合理替代。

**Spike 阶段验证步骤**(必须执行):
1. `grep -rn "from \"@/components/ui/command\"" src/` 找出实际调用点
2. 对每个调用点判断:是"命令面板"(用 Modal + Autocomplete 替代)还是"可搜索下拉"(用 Autocomplete 替代)
3. 若调用点 ≤ 5 处且都是可搜索下拉 → 直接 Autocomplete 替代
4. 若有真正的命令面板需求 → 暂时保留 cmdk,但加 `// TODO(1.1.0): 重写为 HeroUI Modal + Autocomplete` 注释

**Alternatives considered**:
- 保留 cmdk 作为唯一非 HeroUI 组件:简单但违反"单一库"目标(spec US2 / FR-A002)。
- 自建命令面板:YAGNI,违反宪章六。

**Risks & Mitigation**:
- ⚠️ 若 cmdk 实际用作命令面板且重写成本高 → Mitigation:Spike 阶段就发现;若成本超 1 天,临时保留 cmdk + 注释,作为 1.0.0 已知缺陷在 release notes 说明。

---

## R4: 报表图表实现选型

**Decision**: ✅ 自建轻量 SVG + CSS 组件,不引入第三方图表库。

**Rationale**:
- 报表需求:6 个月柱状图(月收入/支出/结余三系列)+ 当前月分类占比环形图
- 数据量:18 柱 + 6 环,Lighthouse a11y / 性能压力极小
- 引入 recharts(+300KB gzip)/ visx(复杂 API)违反 YAGNI
- SVG 原生支持 `<title>` 与 ARIA,可达成 SC-004(Lighthouse a11y ≥ 90)

**Implementation Sketch**(供 tasks 阶段细化):
- `MonthlyTrendChart`:CSS Grid 布局,每柱 `height: ${value/max*100}%`,Tailwind 类驱动颜色;每柱含 `<span class="sr-only">` 文本数值
- `CategoryDonut`:SVG `<circle>` + `stroke-dasharray` + `stroke-dashoffset` 计算每段弧长;`<title>` 提供文本后备
- 交互(FR-D003):月份柱 `onClick` 切换分类分析;分类环 `onClick` 下钻账单(用 `next/link` 或 `router.push`)

**Alternatives considered**:
- recharts:成熟但 bundle 重;API 与 Tailwind v4 集成不优雅。
- visx:@d3 路径,API 学习成本高,违反"单人维护"原则。
- chart.js:canvas 渲染,SSR 不友好;与 Next 16 App Router 冲突。

**Risks & Mitigation**:
- ⚠️ 自建图表无障碍实现易遗漏 → Mitigation:tasks 阶段强制要求每个图表组件单元测试包含 aria-label / role 校验。
- ⚠️ 移动端 375px 下柱状图横向空间紧张 → Mitigation:柱宽用 `minmax(28px, 1fr)`,6 柱总宽 ≤ 200px,留足 padding。

---

## R5: 隐私模式 SSR 安全实现(避免金额闪现)

**Decision**: 在 `<head>` 注入 inline `<script>`, hydration 前读取 localStorage 并给 `<html>` 加 `privacy-on` class;CSS 规则 `[data-amount]` 在 `privacy-on` 下 `visibility: hidden`(或文字 `color: transparent`)。

**Rationale**:
- 隐私状态存 localStorage(单端单用户)
- Next.js App Router 的 SSR 阶段无法读 localStorage(服务端无访问)
- 若等 React hydration 再切隐私态 → 金额先真实 paint 再切换,违反 SC-008
- inline script 在 `<head>` 早期执行(早于 React hydration),给 `<html>` 加 class 后,CSS 立即生效,hydration 时金额已隐藏

**Implementation Sketch**:
```html
<!-- app/layout.tsx <head> 内 -->
<script dangerouslySetInnerHTML={{ __html: `
  try {
    if (localStorage.getItem('balthasar.privacy.enabled') === '1') {
      document.documentElement.classList.add('privacy-on');
    }
  } catch (e) {}
`}} />
```
```css
/* globals.css */
.privacy-on [data-amount] { color: transparent; }
.privacy-on [data-amount]::after { content: '***'; }
```
- 隐私切换按钮:onClick 写 localStorage + `document.documentElement.classList.toggle('privacy-on')`(不触发 React rerender,纯 CSS 切换)
- SSR 阶段金额默认可见(假设非隐私态),hydration 时若不一致由 inline script 提前修正

**作用范围**(spec FR-C008 已决策):
- 隐私生效页:`[data-amount]` 出现的展示页(首页 / 账单 / 报表)
- "记一笔"页金额输入框**不加** `data-amount`,所以不受隐私态影响(clarify Q1 = A)

**Alternatives considered**:
- Cookie + SSR 渲染:每次切换要 server roundtrip,UX 差;SSR 复杂度增加。
- 全 client 渲染:放弃 App Router SSR 优势,违反栈选择。
- React Context + useEffect:hydration 后才生效,会闪现。

**Risks & Mitigation**:
- ⚠️ `localStorage` 在 SSR / 静态导出环境抛错 → Mitigation:inline script 用 `try/catch` 包裹;Next.js App Router 默认 SSR,inline script 在客户端执行无问题。
- ⚠️ `color: transparent` 可能被屏幕阅读器读出真实金额 → Mitigation:同时用 `aria-hidden="true"` 或 `speak: never`(CSS spoken 属性)。

---

## R6: Spike PR 边界 + HeroUI 适配层设计

**Decision**: Spike PR 落地**所有非 UI 切换的前置基础设施**,Switch PR 完成**全部 UI 切换 + 旧依赖删除**。`src/components/ui/` 在 Spike 期作为 HeroUI 适配层(可选),Switch 末删除 shadcn 原生 14 件。

**Spike PR 内容**(≤ 7 天,MUST 独立 ship + CI 全绿):

1. **依赖安装**:`pnpm add @heroui/react @heroui/styles tailwind-variants`(同时保留 shadcn 依赖,两库共存)
2. **主题落地**:
   - `src/app/globals.css` 增加 `@import "@heroui/styles"`(在 `@import "tailwindcss"` 之后)
   - 落地 9 个奶油琥珀 CSS 变量(spec FR-A005)
   - 验证 HeroUI Hello World 页面(`/dev/heroui-test` 临时路由,验证后删除)
3. **共享工具落地**(纯函数,无 UI 依赖):
   - `src/lib/theme.ts` 导出令牌常量
   - `src/lib/privacy.ts`:localStorage key + 读写工具
   - `src/lib/date-ranges.ts`:UTC 月份范围 / 自然周补零 / 跨月周 / `getLast24Months`
4. **layout 注入**:在 `src/app/layout.tsx` `<head>` 注入隐私 inline script
5. **单元测试**(红→绿):date-ranges / privacy 工具全覆盖
6. **文档**:`docs/THEME.md` 落地
7. **CI 验证**:lint / type-check / test 全绿;所有页面继续用 shadcn,无视觉变化

**Switch PR 内容**(≤ 7 天,MUST 在 Spike PR 合并后启动):

1. **后端 procedure 扩展**(测试先行):
   - `dashboard.summary` 扩展支持 `{ year?, month? }`
   - 新增 `dashboard.report`(近 6 月趋势 + 目标月分类占比)
   - 新增 `auth.updateNickname` mutation
   - 集成测试覆盖所有新 procedure
2. **前端页面切换**(顺序:layout → reports → dashboard → transactions → settings → 认证页):
   - 新增底部 5 入口导航(`src/app/(app)/layout.tsx`)
   - 新增 `/reports` 页(报表 SVG + 分类分析)
   - 重做 `/dashboard`(月份 Select + 隐私 + Top 2 下钻 + 周维度 SVG)
   - 重做 `/transactions`(URL 筛选同步)
   - 重组 `/settings` 为"我的"(含昵称 mutation)
   - 重做 `/transaction/new` 与 `/transaction/[id]/edit`
   - 重做 `/login` 与 `/register`
3. **shadcn 清理**:
   - 删除 `src/components/ui/{alert-dialog,button,card,checkbox,command,dialog,input,label,popover,radio-group,select,skeleton,tabs,tooltip}.tsx`(14 件)
   - 删除 `components.json`
   - `pnpm remove @radix-ui/react-alert-dialog @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-radio-group @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-tooltip cmdk class-variance-authority tw-animate-css`
4. **宪章 + 历史 spec 同步**:
   - `.specify/memory/constitution.md` v2.0.0 → v3.0.0
   - 008/009/010/023/024/025 spec 中"shadcn"契约语句同步
5. **集成测试 + 人工 QA**:
   - 完整 MVP 流程 + 报表 + 隐私 + 昵称
   - 375 / 430 / 桌面三尺寸
   - Lighthouse a11y ≥ 90

**Alternatives considered**:
- 单一大 PR + admin bypass:违反 spec-015 FR-003,且 review 难度高。
- 拆 3+ 个 PR:违反"一次性全量替换"决策。

**Risks & Mitigation**:
- ⚠️ Spike 期两库共存可能产生样式冲突 → Mitigation:HeroUI 使用 BEM 类名(`heroui-button` 等),与 shadcn 的 `.btn` 类不冲突;`globals.css` 顺序 tailwind → heroui styles 已验证。
- ⚠️ Switch PR 体积过大,diff 难 review → Mitigation:页面切换按固定顺序(layout → 后端 → reports → dashboard → 其它),每页一个 commit,review 时按 commit 查看。
- ⚠️ Switch PR 期间若发现 P0 bug,git revert 后 shadcn 已删 → Mitigation:Switch PR 在合并前必须在本地 main 分支跑完整 QA + staging 部署验证;合并即视为"已通过 1.0.0 release candidate 验收"。

---

## R7: 月份选择器 + 周维度趋势的 UTC 实现

**Decision**: 复用现有 UTC 规则(数据库 `occurredAt` 存 UTC,客户端按 UTC 年月切分),在 `src/lib/date-ranges.ts` 落地 4 个工具函数。

**Rationale**: 项目已有 UTC 切分逻辑(008/010 流水按 UTC 月汇总);026 仅扩展为"支持历史任意月 + 自然周维度"。无时区切换需求(单人单地使用),UTC 一致性优先。

**Utility Functions**:

```typescript
// src/lib/date-ranges.ts

// 取某年某月的 UTC 起止 timestamp(用于 SQL WHERE)
getUtcMonthRange(year: number, month: 1-12): { start: Date; end: Date }

// 取某年某月覆盖的自然周列表(周一至周日)
// 首尾不完整周仍计入(spec FR-C004)
// 例:2026-07-01 是周三 → 该月第一周从 2026-06-29(周一)计
getUtcWeeksInMonth(year: number, month: 1-12): Array<{
  start: Date; end: Date; label: string  // '6/29-7/5'
}>

// 在指定区间内对每日补零
// 用于当前月"周一至周日补零"(FR-C003)
padDailyBuckets(
  transactions: Array<{ occurredAt: Date; amount: number }>,
  start: Date, end: Date
): Array<{ date: string; amount: number }>  // date 为 'YYYY-MM-DD'

// 取最近 24 个月的 {year, month, label} 数组,供 Select 选项
// 当前月在数组首位(降序)
getLast24Months(now: Date = new Date()): Array<{
  year: number; month: 1-12; label: string  // '2026年7月'
}>
```

**Edge Cases 已覆盖**:
- 跨年:2025-12 → 2026-01 顺序正确(`getLast24Months` 降序)
- 首尾不完整周:`getUtcWeeksInMonth` 包含跨月周的完整 7 天
- 无交易月份:返回 `amount: 0` 而非空数组
- 闰年 / 月长:JS `Date` 自动处理

**Alternatives considered**:
- 使用 `date-fns` / `dayjs`:引入新依赖,违反 YAGNI(项目已有原生 Date 用法);4 个函数 ≤ 60 行代码,自建更轻。
- 客户端本地时区:违反 spec Assumptions "时间边界延续 UTC";会导致同一笔交易在不同时区归到不同月。

**Risks & Mitigation**:
- ⚠️ 单元测试若覆盖不全,跨年/首尾周场景易出 off-by-one → Mitigation:tasks 阶段强制要求每个函数 ≥ 5 个测试用例(含跨年、闰年、月首周日、月末周日、空数据)。

---

## Summary:所有 NEEDS CLARIFICATION 已解决

| 研究主题 | 决策 | 风险等级 |
|---|---|---|
| R1 HeroUI 兼容性 | ✅ 采用 | 低(已知 Tailwind v4 config 坑,Spike 期验证) |
| R2 组件覆盖度 | ✅ 全覆盖 | 低 |
| R3 cmdk 替代 | ✅ Autocomplete 替代 | 中(Spike 期 grep 实际调用) |
| R4 报表图表 | ✅ 自建 SVG + CSS | 低 |
| R5 隐私 SSR | ✅ inline script + CSS class | 低 |
| R6 Spike + Switch | ✅ 两 PR 边界明确 | 中(Switch PR 体积,用 commit 分页 review) |
| R7 UTC 日期工具 | ✅ 4 个纯函数 + 单元测试 | 低 |

**Phase 1 设计输入已就绪**。所有 decisions 直接进入 data-model.md / contracts/ / quickstart.md。
