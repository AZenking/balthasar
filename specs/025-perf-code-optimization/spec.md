# Feature Specification: 性能与代码优化 (React Best Practices 对齐)

**Feature Branch**: `025-perf-code-optimization`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "性能和代码优化;使用 Vercel React Best Practices skill"

## Clarifications

### Session 2026-07-16

- Q: 本次"代码优化"覆盖哪些层面? → A: 仅 React/Next.js 范式(Server vs Client Component 边界、hooks 用法、Suspense 边界、code-splitting);不延伸到 TypeScript 类型/死代码/文件结构/重命名重构
- Q: 性能基线如何捕获与归档? → A: `next build` + `@next/bundle-analyzer`(devDep)+ 人工 Lighthouse;baseline 与 after 数字存入 `specs/025-perf-code-optimization/baseline.md`,不走 CI 自动化、不接 RUM
- Q: 优化过程中允许的视觉差异程度? → A: 视觉等价 + 允许改善 loading 反馈(空白→Skeleton);CLS=0、间距/颜色/交互模式不变
- Q: 审查范围是仅 3 个核心 feature,还是覆盖所有用户可见 feature? → A: 3 个核心 feature(Dashboard/流水/新增交易)严格审查、80% 达标阻塞 PR;其它 feature 仅"明显反模式"扫描、不达标不阻塞、记入 backlog
- Q: PR 切分粒度? → A: 按 feature 纵切(每个核心 feature 一个 PR 收拢所有 React/Next.js 范式修复)+ 跨 feature 反模式横切 PR(如全局 providers)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 移动端用户在低端设备上感受到顺滑的记账体验 (Priority: P1)

一位使用中低端 Android 手机(2-3 年前发布、内存有限)的家庭记账用户,
打开 Dashboard、查看流水、录入一笔账时,页面切换无明显卡顿、滚动
流畅、点击按钮到反馈之间没有可感知的延迟。整体交互感觉与原生应用
接近,不会因为 React 重渲染、客户端组件过多、未做 code-splitting
而出现"打开应用 → 卡顿 → 慢慢响应"的体验。

**Why this priority**: 宪章原则五("性能与极速录入")的产品假设是
"手机上 10 秒内完成一笔账"。前端性能是这条假设最直接的载体 ——
卡顿的渲染、过大的 JS bundle、未必要的客户端 hydration 都会侵蚀
"10 秒"的体感预算。本用户故事对应宪章五中 "Mobile-First / Server
Components 优先减少客户端 JS" 的硬性要求。

**Independent Test**: 在 Chrome DevTools 的 Mid-Tier Mobile 模式
(CPU 4× slowdown、Slow 3G)下,从首页进入 Dashboard 再到录入页,
观察:(1) 首屏可交互时间(2) 点击"新增交易"到表单可用的时间
(3) 列表滚动 FPS。三项均需达到下文 SC-001/SC-002/SC-003 标准。

**Acceptance Scenarios**:

1. **Given** 用户使用 3 年前的中端 Android 设备, **When** 在 4G 网络
   下打开 Dashboard, **Then** 首屏文字内容在 2 秒内可见、可交互元素
   在 3 秒内响应(参见 SC-001)。
2. **Given** 用户在流水列表页快速滚动, **When** 滚动 50+ 条交易记录,
   **Then** 不出现明显掉帧(滚动 FPS ≥ 50,肉眼无卡顿感)。
3. **Given** 用户点击底部导航切换 Tab, **When** 切换到设置页,
   **Then** 路由切换在 200ms 内完成视觉过渡,且无白屏闪烁。

---

### User Story 2 - 慢速网络用户在弱网下仍可完成关键操作 (Priority: P2)

在地铁、电梯、海外漫游等弱网环境下(RTT 300ms+、带宽 1Mbps 以下)
的用户,仍能完成"看本月支出总额"和"录一笔账"两个核心动作。
页面初次加载的 JS 体积被控制到合理范围,关键路径不依赖大型客户端
bundle 完成 hydration;关键交互(提交交易)在乐观更新策略下,
即使网络较慢也能立即给出"已保存"的反馈。

**Why this priority**: 宪章原则五明确"Server Components 优先减少客户端
JS"。弱网是移动场景的真实常态,大型 bundle 在弱网下放大首屏空白时间,
直接伤害"10 秒完成"的目标。

**Independent Test**: 用 Chrome DevTools 的 Offline → Slow 3G 切换
模式,测量首屏 LCP、TTI、JS bundle 体积指标。要求较优化前 baseline
有可测量的改善(参见 SC-004/SC-005)。

**Acceptance Scenarios**:

1. **Given** 用户处于 Slow 3G(400ms RTT、500Kbps), **When** 首次
   打开应用登录后进入 Dashboard, **Then** LCP 在 3.5 秒内达成。
2. **Given** 用户在弱网下点击"保存交易", **When** 提交动作触发,
   **Then** 界面立即给出"已保存"反馈(乐观更新),后台异步确认。
3. **Given** 用户连续切换 5 个页面, **When** 整体加载完成,
   **Then** 总传输 JS 体积不超过 baseline 的 80%(即至少减少 20%)。

---

### User Story 3 - 维护者在新功能开发中享受更清晰的代码结构 (Priority: P3)

未来接手维护(或本人三个月后回顾)代码的开发者,在阅读
`src/app/**` 与 `src/components/**` 时,能立刻识别出:哪些是 Server
Component、哪些是 Client Component、哪些是共享组件;hooks 与组件
职责分离明确;无重复实现、无未使用的导出、无显然的"复制粘贴"代码;
React 19 与 Next.js App Router 的最新模式(Server Actions、Suspense
边界、`use` hook)在合适位置被正确使用,而非陈旧模式(Page Router
惯性、不必要的 `useState` + `useEffect`)。

**Why this priority**: 宪章原则六("简单 YAGNI")与原则二
("Feature-Sliced")要求代码以最小复杂度组织。Vercel React Best
Practices skill 缓存了 React 19 + Next.js App Router 的最新实践,
作为"权威参照"对抗陈旧训练记忆导致的代码漂移。代码可读性虽不直接
对应宪章五的 p95 指标,但是宪章六 YAGNI 的载体 ——
越简单的代码越不容易引入性能回归。

**Independent Test**: 由维护者(或 AI 协作者)任意挑选 3 个 feature
目录(如 `dashboard`、`transactions`、`settings`),在不读具体实现
的前提下,仅通过文件命名与组件职责划分就能预测每个文件的边界与
依赖关系;存在一份"代码优化清单"列出本次识别到的反模式与对应修复
(参见 SC-006/SC-007)。

**Acceptance Scenarios**:

1. **Given** 维护者打开任意 feature 目录, **When** 浏览文件结构,
   **Then** 每个组件文件中 Server Component 与 Client Component
   的边界明确(`"use client"` 指令在文件顶部、组件命名反映其性质)。
2. **Given** 维护者执行 Vercel React Best Practices skill 给出的
   审查清单, **When** 对照 3 个核心 feature 的代码, **Then** 至少
   80% 的检查项通过(剩余项列入后续 backlog)。
3. **Given** AI 协作者在 3 个月后接手本仓库, **When** 不依赖任何
   人类口头说明、仅凭代码 + skill 输出, **Then** 能正确识别本仓库
   采用的 React/Next.js 范式(参见 SC-008)。

---

### Edge Cases

- 用户在低端 iOS 设备(Safari)上访问时,性能预算是否需要单独校准?
  (假设: 跟随主流量设备基线,iOS 在 SC-001 内统一测量)
- 用户启用了"减少动态效果"系统设置时,动画/过渡是否需要相应降级?
  (假设: 通过 CSS media query `prefers-reduced-motion` 自动响应)
- 性能基线测量时是否包含登录态(已认证)与未登录态(登录页)?
  (假设: 以已认证的 Dashboard/流水为基线,登录页不纳入 SC-001)
- 现有代码中已遵循 Vercel React Best Practices 的部分如何标记为
  "无需改动"以免过度重构? (假设: 保留 baseline 评分,仅修复反模式)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 在已认证的主流程页面(Dashboard、流水、
  新增交易)上,以 Mid-Tier Mobile(4× CPU slowdown、Slow 3G 模拟)
  为基线达成首屏可交互时间 ≤ 3 秒。

- **FR-002**: 系统 MUST 在快速滚动流水列表(50+ 条记录)时,
  保持肉眼无卡顿(滚动 FPS ≥ 50),且不因列表项重渲染导致 CPU
  占用飙升。

- **FR-003**: 系统 MUST 优先使用 Server Components 承载静态/数据
  展示内容,仅将真正需要交互(表单输入、模态框、客户端状态)的部分
  标记为 Client Component;客户端 JS 体积较优化前 baseline 至少
  减少 20%。

- **FR-004**: 系统 MUST 在路由切换时使用 Next.js App Router 的
  约定(loading.tsx、Suspense 边界、流式渲染)避免白屏闪烁,
  视觉过渡时间 ≤ 200ms。

- **FR-005**: 系统 MUST 对关键交互(提交交易、删除、修改)采用
  乐观更新策略,使界面在用户操作后 100ms 内反馈"已提交"状态,
  后台失败时回滚并提示。

- **FR-006**: 系统 MUST 不引入新的运行时依赖或 UI 库来达成上述
  性能目标(宪章原则六 YAGNI);优化必须基于现有技术栈
  (Next.js App Router + tRPC + HeroUI v3)的能力。

- **FR-007**: 代码 MUST 通过 Vercel React Best Practices skill
  输出的审查清单中至少 80% 的检查项(在 3 个核心 feature:
  Dashboard / 流水 / 新增交易上)。审查范围 **仅限 React/Next.js
  范式**:Server vs Client Component 边界、hooks(`useState` /
  `useEffect` / `useMemo` / `useCallback`)用法、Suspense 边界、
  code-splitting、`'use client'` 指令位置;**不**覆盖 TypeScript
  类型/死代码/文件结构/重命名重构(这些留待独立 initiative)。
  其它 feature(Settings / Categories / Onboarding / Reports 等)
  仅扫描"明显反模式"(如整页误打成 Client Component),**不达标
  不阻塞 PR 合并**,但 MUST 记入 backlog 跟进。

- **FR-008**: 系统 MUST 保持宪章原则五的硬性 p95 指标不回归:
  创建交易 mutation p95 < 300ms、Dashboard query p95 < 500ms
  (warm 状态,不含冷启动)。

- **FR-009**: 系统 MUST 在所有优化前后,通过现有的 Vitest 测试
  套件(单元 + 集成)+ E2E 流程测试,确保功能性 bug 数 = 0。

- **FR-010**: 系统 MUST 在 PR 描述或迁移说明中记录:(1) 优化前
  baseline 数值、(2) 优化后数值、(3) 测量方式(工具/配置),
  以便后续审计与回归对照。基线捕获机制固定为:
  `next build` + `@next/bundle-analyzer`(devDep,不入生产)+
  人工 Lighthouse(Mid-Tier Mobile / Slow 3G 配置);基线快照与
  优化后数字 MUST 存入 `specs/025-perf-code-optimization/baseline.md`
  作为可追溯证据。

- **FR-011**: 系统 MUST 在涉及 UI 改动(className / 组件结构 /
  variant 调整)时,遵守宪章原则七 —— 优先调用 `/heroui-react`
  skill 获取 HeroUI v3 原生 API;禁止凭 shadcn/Radix 时代记忆编码。

- **FR-012**: 系统 MUST 保持对低端设备的兼容性 —— 不依赖只有
  最新浏览器才支持的 API(除非有 polyfill 或 graceful degradation)。

- **FR-013**: 优化过程 MUST 保持视觉等价:布局/间距/颜色/字体/
  交互模式(点击/滚动/路由切换)与优化前一致;**唯一允许的视觉
  差异**是 loading 反馈改善(如把"空白→突变"改为 HeroUI v3
  Skeleton)。CLS(Cumulative Layout Shift)MUST 保持为 0 或较
  baseline 不上升。

- **FR-014**: 实施 MUST 按 feature 纵切 PR:每个核心 feature
  (Dashboard / 流水 / 新增交易)各自一个 PR,在该 PR 内收拢该
  feature 所有 React/Next.js 范式修复(Server/Client 边界、hooks、
  Suspense、code-splitting);跨 feature 共享的反模式(如全局
  `providers.tsx`、布局壳 `layout.tsx`、共享 utilities)以独立
  横切 PR 处理。每个 PR **必须**独立通过 SC-009(p95 回归护栏)
  与 SC-010(测试全绿)。

### Key Entities *(include if feature involves data)*

本 feature 不引入新数据实体,所有优化在现有 schema
(`Family` / `Member` / `Account` / `Category` / `Transaction` /
`Budget` / Better-Auth 表)上进行。新增的"非功能性"概念包括:

- **Performance Baseline**: 优化前各页面/Dashboard 的关键性能指标
  快照(LCP、TTI、JS bundle 体积、滚动 FPS),用于回归对照。
- **Code Review Checklist**: 从 Vercel React Best Practices skill
  派生的、针对本仓库 feature-sliced 结构的具体检查项清单。
- **Anti-Pattern Inventory**: 本次识别到的反模式列表(如:未必要的
  Client Component、`useEffect` 滥用、缺少 `memo`/`useMemo`、
  重复组件实现),每项附修复方案与优先级。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在 Chrome DevTools Mid-Tier Mobile(4× slowdown +
  Slow 3G)模式下,Dashboard 首屏 LCP ≤ 3 秒;首次输入延迟(FID)
  ≤ 200ms。

- **SC-002**: 在 Mid-Tier Mobile 模式下,流水列表页(50+ 条记录)
  快速滚动时,Chrome DevTools FPS 计数器稳定显示 ≥ 50 FPS。

- **SC-003**: 路由切换(Tab 之间)的视觉过渡时间 ≤ 200ms,无白屏
  闪烁(通过视频帧分析或 Lighthouse 路由过渡测量验证)。

- **SC-004**: 首次加载(已认证进入 Dashboard)传输的 JS 体积
  (gzipped)较优化前 baseline 至少减少 20%。

- **SC-005**: 在 Slow 3G 模式下,Dashboard 的 TTI(Time to
  Interactive)≤ 3.5 秒,较优化前 baseline 至少改善 25%。

- **SC-006**: 由 Vercel React Best Practices skill 派生的代码审查
  清单(≥ 15 项),在 Dashboard / 流水 / 新增交易三个核心 feature 上,
  通过率 ≥ 80%。审查范围限 React/Next.js 范式(见 FR-007)。

- **SC-007**: 至少识别并修复 5 处显著的 **React/Next.js 反模式**
  (典型如:可改为 Server Component 的 Client Component、可移除的
  `useEffect`、缺少 `memo`/`useMemo` 导致的重渲染、未做 code-splitting
  的大组件),每处附 before/after 对照与理由说明。TypeScript 类型
  反模式不在本 SC 计数范围。

- **SC-008**: 维护者(或 AI 协作者)在不依赖人类口头说明的前提下,
  仅凭仓库代码 + Vercel React Best Practices skill 输出,
  能在 30 分钟内准确描述本仓库的 React/Next.js 范式
  (Server Component 边界、tRPC 集成方式、HeroUI v3 使用约定)。

- **SC-009**: 宪章原则五的 p95 性能指标无回归 —— 创建交易 mutation
  p95 < 300ms、Dashboard query p95 < 500ms,warm 状态下连续测量
  20 次取 p95。

- **SC-010**: 现有 Vitest 测试套件 + E2E 流程测试 100% 通过,
  因本次优化引入的功能性 bug 数 = 0。

## Assumptions

- 性能基线测量以 Chrome DevTools 的 Mid-Tier Mobile(CPU 4×
  slowdown + Slow 3G)为准;不以实验室级设备(Desktop / 千兆网)
  的数据作为 SC 达标依据。

- "已认证状态"是测量基线 —— 用户已登录并进入主应用;登录页本身
  的性能不纳入 SC-001 ~ SC-005 的硬性指标。

- 本次优化的代码反模式识别范围限于 `src/app/**` 与
  `src/components/**`;后端 `src/server/**`(tRPC router、
  domain、db)不纳入 FR-007 的代码审查清单 scope(后端性能由
  宪章原则五的 p95 指标独立约束)。
- 代码审查 scope 进一步限定为 **React/Next.js 范式**:
  Server vs Client Component、hooks 用法、Suspense、code-splitting;
  TypeScript 类型/死代码/文件结构/重命名重构 **不**在本次 initiative
  范围内(若识别到可作为 backlog 跟进,但不算入 SC-006/SC-007 计数)。
- **审查 feature 分级**:Dashboard / 流水 / 新增交易(宪章原则五
  "10 秒完成" 热路径)为**严格达标区**,80% 通过率阻塞 PR;其它
  feature(Settings / Categories / Onboarding / Reports 等)为
  **扫描区**,仅识别明显反模式、不阻塞合并、记入 backlog。

- 不引入新的运行时依赖达成性能目标;若 Vercel React Best
  Practices skill 推荐某个工具(如 `react-scan`、`why-did-you-render`)
  作为开发期诊断,可作为 devDependency 但不打包进生产。
  本次明确引入的 devDep 为 `@next/bundle-analyzer`,仅用于基线捕获。

- 性能基线**不走 CI 自动化**(不接 Lighthouse CI、不接 Web Vitals
  RUM),作为单人维护项目的 YAGNI 选择;baseline 与 after 数据以
  人工运行结果存档于 `specs/025-perf-code-optimization/baseline.md`。

- 用户系统设置中的"减少动态效果"(prefers-reduced-motion)被
  现有 HeroUI v3 组件库原生支持;本次优化不单独处理动画降级,
  依赖组件库默认行为。

- 现有 HeroUI v3 栈(v3.0.0 冻结)不因本次优化变更 —— UI 组件
  层改动严格遵循宪章原则七(先查 `/heroui-react` skill)。

- 现有的 p95 性能指标(创建交易 < 300ms、Dashboard < 500ms)在
  优化过程中持续作为回归门槛;若优化导致 p95 上升,该优化不达标。

- 本 feature 不修改既有数据库 schema;所有数据访问路径保持现状。

- 测量工具以 Chrome DevTools Performance / Lighthouse 为权威;
  不引入 WebPageTest 等外部 SaaS(避免依赖网络环境外的变量)。

- 优化过程中**视觉等价**是硬约束:布局/间距/颜色/字体/交互模式
  不变;唯一允许的视觉差异是 loading 反馈改善(空白→HeroUI v3
  Skeleton),且 CLS 不上升。该项作为 PR review 的视觉 diff 准则。
