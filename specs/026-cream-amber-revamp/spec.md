# Feature Specification: 1.0.0 奶油琥珀全站改版(HeroUI v3 + IA 重构 + 报表页)

**Feature Branch**: `026-cream-amber-revamp`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "「轻记」奶油琥珀全站改版计划 —— 全站迁移到 HeroUI v3,采用单一浅色『奶油琥珀』主题。重做首页,增加历史月份、真实周期支出图、金额隐私模式和分类下钻。底部导航升级为:首页、账单、记一笔、报表、我的。新增报表页;『我的』整合现有账户、分类、API Key、昵称和退出登录。保留现有业务逻辑和数据库结构;昵称直接使用已有 `member.displayName`,无需数据库迁移。"

## Clarifications

### Session 2026-07-13

- Q: 迁移节奏 —— 一次性全量替换 vs 渐进式(per-component / per-page)迁移? → A: **一次性全量替换**(用户决策 2026-07-13)。理由:用户偏好彻底性 > 过渡期共存代价。**执行策略**:拆为两个有序 PR,各自 ≤ 7 天,规避 spec-015 FR-003 短分支冲突 —— (1)**Spike PR**:HeroUI 安装 + 奶油琥珀令牌 + 共享适配层落地,所有页面仍跑 shadcn;(2)**Switch PR**:全站一次性切换到 HeroUI + 删除 shadcn 依赖。Spike 期间两库共存但只有 shadcn 在用,Switch 期间完成切换并清理。无需启用 spec-015 FR-006 admin bypass 路径。
- Q: 本次改版对应的版本号? → A: **1.0.0 (major)**(用户决策 2026-07-13)。理由:宣告"MVP 迭代期结束 + UI 标准化 + 信息架构升级",作为项目首个正式 major release。**前置条件**:0.2.0 必须先发完(MVP 主体功能闭环:008/009/010 UI + 018 backend + 023 UI + 015 工程化)。026 是 1.0.0 的主体内容,0.2.0 → 1.0.0 之间不另发 0.3.x。
- Q: 宪章 v2.0.0 §技术栈明确写"组件: shadcn/ui 保持",本次是否同步升宪章到 v3.0.0? → A: **是** —— 宪章与代码同 PR 修订,不允许 spec 与宪章矛盾超过一个发布周期。同步修订 `.specify/memory/constitution.md` 技术栈 + 同步影响报告(MAJOR,理由:UI 视觉变更 + 公共组件 API 变更 + 依赖树变更 + IA 重构)。
- Q: 隐私模式是否覆盖"记一笔"页(`/transaction/new`)的金额输入? → A: **不覆盖**(用户决策 2026-07-13)。隐私模式仅作用于"展示页"(首页 / 账单 / 报表);"记一笔"页的金额输入与实时预览正常显示,避免用户输入时无法核对。公共场合防窥需求靠"临时关闭隐私"满足。
- Q: 历史月份选择器的 UI 形式? → A: **HeroUI `Select` 下拉枚举最近 24 个月**(用户决策 2026-07-13)。理由:HeroUI v3 原生 Select 移动端命中区域大;24 个月窗口对家庭记账复盘足够;避免自建月历组件的成本(违反宪章原则六 YAGNI)。超出 24 个月的需求暂不考虑(若未来出现,defer 到 V2)。
- Q: 报表页图表的点击交互范围? → A: **趋势月份 + 分类块都可点击**(用户决策 2026-07-13)。趋势月份点击切换分类分析到该月;分类块点击下钻到账单页(`/transactions?month=<Y-M>&type=expense&categoryId=<id>`),与首页 FR-C006 Top 2 分类卡的下钻交互保持一致,降低用户认知成本。
- Q: "记一笔"成功后的缓存失效范围? → A: **失效 `dashboard.*` 全部缓存**(用户决策 2026-07-13)。即 `dashboard.summary` 与 `dashboard.report` 都 invalidate,无论来源页是首页、账单还是报表,返回后均看到最新数据。`transactions` 相关查询 key 也同步失效。理由:用户记账后最在意"数字对不对",宁可多一次请求也不能显示滞后数据;invalidate 范围小(三个 key 族),成本低。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 用户看到奶油琥珀风格的全站统一 UI (Priority: P1)

家庭成员打开应用,看到全新的"奶油琥珀"视觉风格(`background #F8F4EA` / `surface #FFFDF8` / `accent #C79032` / `foreground #292721` 等),所有页面共享同一套设计令牌、相同的卡片圆角(20–24px)、相同的点击命中区域(≥ 44px)、一致的加载态/空态/错误态。原有 MVP 流程(登录、Dashboard、新增交易、流水、编辑/删除、账户管理、分类管理)在视觉刷新后功能 100% 等价完成,无回归。

**Why this priority**: 这是 1.0.0 的"视觉等价 + 风格统一"硬约束 —— 视觉变了但功能不能丢,且必须全站统一(不能出现 shadcn 残留 + HeroUI 新页混搭)。

**Independent Test**: 跑一遍 MVP 完整流程(登录 → 新增账户 → 新增分类 → 新增交易 → 查看流水 → 编辑 → 删除 → 修改设置),全部成功 + 视觉一致即可 P1 通过。

**Acceptance Scenarios**:

1. **Given** 应用已迁移完成且 CI 全绿, **When** 用户在 375px 视口完成"新增一笔支出"全流程, **Then** 所有交互(选账户、选分类、输金额、提交、看到列表更新)按原逻辑工作,无可见回归。
2. **Given** 迁移后的代码库, **When** 用户触发任意对话框/弹窗(分类管理、删除确认等), **Then** 对话框开关、焦点陷阱、Escape 关闭、点击遮罩关闭等无障碍行为与原 shadcn 实现等价。
3. **Given** 迁移后的代码库, **When** 用户提交非法表单(金额为空、分类未选), **Then** 错误提示出现且字段红框等可见反馈与原 UX 等价,不出现"静默失败"。
4. **Given** 迁移完成后, **When** 维护者执行 `grep -r "@radix-ui" src/ package.json`, **Then** 命中数 = 0(`pnpm-lock.yaml` 允许作为 HeroUI 子依赖间接出现)。
5. **Given** 迁移完成后, **When** 维护者查阅 `globals.css`, **Then** HeroUI 语义令牌(`--background`、`--surface`、`--accent`、`--accent-hover`、`--foreground`、`--muted`、`--dark-surface`、`--income`、`--expense`)已落地,值与设计稿一致。

---

### User Story 2 - 用户使用底部 5 入口导航 (Priority: P1)

家庭成员在应用任意页面底部看到固定的 5 入口导航:**首页**(`/dashboard`)、**账单**(`/transactions`)、**记一笔**(`/transaction/new`,凸起主按钮)、**报表**(`/reports`)、**我的**(`/settings`)。点击任一入口直接切换到对应页面,当前所在入口有活动态高亮。

**Why this priority**: IA 重构是 1.0.0 的"信息架构升级"宣告 —— 移动端底部导航是家庭记账场景的主交互模式(MVP 原则"Mobile First"),与 P1 视觉刷新同级。

**Independent Test**: 在应用任意非模态页面,确认底部导航可见、5 个入口正确、点击切换路由、当前页高亮。

**Acceptance Scenarios**:

1. **Given** 用户已登录并处于 `/dashboard`, **When** 用户点击底部"账单", **Then** 路由切换到 `/transactions`,底部"账单"入口呈活动态,其他入口呈默认态。
2. **Given** 用户在任意非模态页面, **When** 用户点击底部中间的"记一笔"凸起按钮, **Then** 路由切换到 `/transaction/new`,且该入口有清晰的视觉区分(凸起样式)。
3. **Given** 用户在 `/reports`, **When** 查看底部导航, **Then** "报表"入口呈活动态。
4. **Given** 用户进入对话框/全屏编辑态, **When** 模态层激活, **Then** 底部导航可以隐藏或保持可见,但不可与模态层重叠造成误触(具体行为由 plan 阶段决策)。
5. **Given** 用户刷新任意页面或直接访问深链接, **When** 页面加载完成, **Then** 底部导航正确显示当前路由的活动态。

---

### User Story 3 - 用户查看报表(近 6 个月趋势 + 分类占比) (Priority: P2)

家庭成员打开"报表"页面,看到截至当前月的近 6 个月收支趋势(每月收入、支出、结余),以及当前选中月的分类支出金额与占比。点击趋势上的某个月份,分类分析切换到该月。

**Why this priority**: 报表是 1.0.0 的"新增功能" —— 不在 MVP 列表但属于"家庭记账必要复盘"能力。优先级低于视觉/IA 等价(P1),但高于昵称等维护性能力(P3)。

**Independent Test**: 进入 `/reports`,默认看到近 6 个月趋势 + 当前月分类占比;点击其它月份,分类分析随之更新。

**Acceptance Scenarios**:

1. **Given** 用户进入 `/reports`, **When** 页面加载完成, **Then** 看到近 6 个月的收入/支出/结余数据(图表 + 文本数值),数据来源 `dashboard.report`。
2. **Given** 报表页默认显示当前月分类分析, **When** 用户点击趋势上的"上月", **Then** 分类分析区域切换到上月,显示该月分类支出金额 + 占比。
3. **Given** 报表页跨年(例如 2025-12 → 2026-05), **When** 用户查看趋势, **Then** 月份顺序正确(不出现年份回退错乱)。
4. **Given** 某月无任何交易, **When** 该月出现在趋势中, **Then** 显示 0 而非空白,且不破坏图表渲染。
5. **Given** 用户无障碍辅助技术阅读报表, **When** 焦点落到图表, **Then** ARIA 标签提供文本数值(图表不是纯视觉,有可访问文本后备)。

---

### User Story 4 - 用户在首页选择历史月份 (Priority: P2)

家庭成员打开首页,顶部展示"轻记"品牌、按时间动态问候、当前用户昵称、当前选择的年月。可切换到历史任意年月,看到该月的收入、支出、结余、支出 Top 2 分类、按周汇总的支出趋势图(当月按周一至周日补零,历史月按该月自然周汇总)。最近流水固定显示最新 4 条,不受月份选择影响。

**Why this priority**: 历史月份回看是"轻记"场景的核心复盘能力 —— 比 MVP 当时的"只看当前月"提升了实际可用性。

**Independent Test**: 进入 `/dashboard`,切换月份,确认收支数字、Top 2 分类、周维度图随之变化;最近 4 条流水不变。

**Acceptance Scenarios**:

1. **Given** 用户在 `/dashboard`, **When** 切换月份到上月, **Then** 月度收入、支出、结余、Top 2 分类、支出周维度图全部更新为该月数据。
2. **Given** 用户在 `/dashboard`, **When** 处于当前月, **Then** 支出趋势显示当前自然周(周一至周日),每日缺失补零。
3. **Given** 用户在 `/dashboard`, **When** 切换到历史月, **Then** 支出趋势按该月自然周汇总(首尾不完整周仍计入该月范围)。
4. **Given** 用户在 `/dashboard`, **When** 查看"最近流水"区域, **Then** 始终显示最新 4 条(不受月份选择影响),点击单条进入编辑,"全部"进入账单页。
5. **Given** 主卡显示"本月结余", **When** 用户阅读, **Then** 文案明确为"本月结余"(收入 - 支出语义),不冒充账户总余额。

---

### User Story 5 - 用户开启金额隐私模式 (Priority: P2)

家庭成员在首页/报表页点击"隐私"按钮,所有金额立即变为占位符(如 `***`);状态保存在 `localStorage`,刷新或重新打开后保持。初次渲染避免金额闪现(服务端渲染或客户端 hydration 阶段不暴露真实数字)。

**Why this priority**: 隐私模式是"家庭记账在公共场合使用"的高频需求(地铁、办公室),MVP 原则"Mobile First"的直接产物。

**Independent Test**: 点击隐私按钮,确认所有金额隐藏;刷新页面,确认状态保持;在浏览器 DevTools 中 throttling 慢速网络,确认初次渲染无金额闪现。

**Acceptance Scenarios**:

1. **Given** 用户在首页, **When** 点击隐私按钮, **Then** 所有金额(主卡、周图、Top 分类、最近流水的金额)立即变为占位符。
2. **Given** 隐私已开启, **When** 用户刷新页面, **Then** 隐私状态保持,刷新后金额仍为占位符。
3. **Given** 隐私已开启, **When** 用户切换到报表页, **Then** 报表页金额同样隐藏。
4. **Given** 用户首次开启隐私后重新加载页面, **When** 在 hydration 完成前观察 DOM, **Then** 不出现"先显示真实金额再切占位符"的闪现(通过 SSR/CSR 协调或 inline script 注入 localStorage 状态实现)。
5. **Given** 用户关闭隐私, **When** 点击按钮再次切换, **Then** 所有金额立即恢复显示。
6. **Given** 用户在首页开启隐私模式, **When** 用户点击"记一笔"进入 `/transaction/new`, **Then** 该页的金额输入框与实时预览正常显示(不被隐私模式遮蔽),用户可正常核对输入。

---

### User Story 6 - 用户点击首页分类卡下钻到账单 (Priority: P3)

家庭成员在首页点击"Top 2 分类"中的某张卡,路由跳转到 `/transactions`,URL 自动携带 `month`、`type=expense`、`categoryId=<id>` 三个参数。账单页读取 URL 参数,显示该月该分类的支出流水。

**Why this priority**: 下钻是首页 → 账单的"信息连接",提升复盘效率。优先级 P3 因为它是"锦上添花",不是核心闭环。

**Independent Test**: 在首页点 Top 分类卡,确认 URL 含三个参数,确认账单页正确筛选。

**Acceptance Scenarios**:

1. **Given** 用户在首页看 Top 2 分类, **When** 点击"餐饮 ¥320", **Then** 跳转到 `/transactions?month=2026-07&type=expense&categoryId=<餐饮id>`。
2. **Given** 账单页收到 URL 参数, **When** 页面加载, **Then** 显示 2026-07 餐饮分类的所有支出流水,筛选器同步显示当前状态。
3. **Given** 账单页收到无效或无权限的 `categoryId`(如其他家庭的分类), **When** 页面加载, **Then** 安全忽略该参数(显示该月全部流水或空结果),不报错不泄露。
4. **Given** 用户从带筛选的账单页编辑某条交易, **When** 编辑完成返回, **Then** 账单页保留原 URL 筛选参数,不重置为默认。

---

### User Story 7 - 用户在"我的"修改昵称 (Priority: P3)

家庭成员进入"我的"页面(路由仍为 `/settings`),看到自己的当前昵称,可以修改并保存。昵称去首尾空格后长度 1–30 字符,保存后立即反映在首页问候语与"我的"页面。后端通过新的 `auth` 受保护 mutation 更新当前会话用户对应的 `member.displayName`,**无数据库迁移**(复用现有列)。

**Why this priority**: 昵称是"轻记"个性化的最低门槛 —— MVP 阶段可能用默认值,1.0.0 让用户真正"拥有"自己的身份。P3 因为不影响核心闭环。

**Independent Test**: 在"我的"修改昵称,保存后首页问候语同步显示新昵称;刷新后保持。

**Acceptance Scenarios**:

1. **Given** 用户进入 `/settings`(我的), **When** 查看个人信息区域, **Then** 看到当前昵称(`member.displayName`)。
2. **Given** 用户在"我的"修改昵称, **When** 输入 "  小明  "(含首尾空格)并保存, **Then** 后端 trim 为 "小明",长度符合 1–30,保存成功,UI 反馈新昵称。
3. **Given** 用户输入空字符串或长度 >30, **When** 提交, **Then** 表单显示校验错误,不发送请求。
4. **Given** 用户保存昵称后回到首页, **When** 查看顶部问候, **Then** 显示新昵称。
5. **Given** 用户 A 修改自己的昵称, **When** 同家庭其他成员的昵称不受影响, **Then** 后端只更新当前会话用户对应的 member(通过 familyId + memberId 隔离)。

---

### User Story 8 - 维护者获得单一组件库与单一主题 (Priority: P3)

维护者(单人开发)在迁移完成后,仓库内只有一个 UI 组件库(HeroUI v3)和一套主题(奶油琥珀浅色)。`@radix-ui/*`、`cmdk`、`class-variance-authority`、旧动画相关依赖全部从 `package.json` 移除。宪章 v2.0.0 → v3.0.0 同 PR 修订。

**Why this priority**: 这是改版的"维护性收益" —— 没有它,1.0.0 就只是平移成本。但 P3 因为用户视角看不见。

**Independent Test**: `grep -r "@radix-ui\|cmdk\|class-variance-authority" src/ package.json` 命中数 = 0;宪章 v3.0.0 落地;主题文档可读。

**Acceptance Scenarios**:

1. **Given** 迁移完成, **When** 维护者执行 `cat package.json | jq '.dependencies'`, **Then** 列表中不再有 `@radix-ui/*`、`cmdk`、`class-variance-authority`、`framer-motion`(若 HeroUI v3 不需要);新增 `@heroui/react`、`@heroui/styles`、`tailwind-variants`。
2. **Given** 迁移完成, **When** 维护者执行 `git ls-files src/components/ui/`, **Then** 不再含 shadcn 原生 14 件;若保留目录仅含 HeroUI 适配层或为空。
3. **Given** 迁移完成, **When** 维护者查阅 `.specify/memory/constitution.md`, **Then** 宪章为 v3.0.0,§技术栈"组件: HeroUI v3",同步影响报告标记 MAJOR。
4. **Given** 主题文档已落地, **When** 维护者修改 `--accent` 变量, **Then** 全站强调色同步变化,无需改组件代码。

---

### Edge Cases

- **HeroUI v3 缺少 cmdk 等价**:`command.tsx`(cmdk 命令面板)在 HeroUI v3 中无直接对应。处理:用 HeroUI `Modal + Menu` 组合替代,或保留 cmdk 包(但移除 shadcn 的 `command.tsx` 封装)。决策 defer 到 plan 阶段。
- **暗色模式**:本期明确**不做**(用户决策,Assumptions 已写)。HeroUI v3 默认支持,但本期不启用,主题文件中可保留暗色 token 但 UI 不暴露切换。
- **报表图表**:用轻量 SVG/CSS 实现,**不增加**大型图表库(如 Recharts/Chart.js)。若复杂度超预期,defer 到 plan 阶段决策。
- **时间边界**:延续现有 UTC 规则(数据库 `occurredAt` 存 UTC,客户端按 UTC 年月切分),不改变既有汇总语义。
- **金额单位**:数据库继续以"分"为单位,只在展示层除以 100。本 spec 不引入货币/单位变更。
- **金额隐私闪现**:SSR/CSR 协调或 inline script 注入 localStorage 状态,具体实现方案 defer 到 plan 阶段。
- **历史 spec 引用 shadcn**:008/009/010/023/024/025 中"shadcn"作为契约的语句同步更新,标题保留作为历史记录。
- **dnd-kit 拖拽**:023 自定义分类管理用了 `@dnd-kit/*`,不在迁移范围,继续保留。
- **回滚预案**:1.0.0 是 major,若发现关键 bug,通过 1.0.1 patch 修复而非回退 1.0.0(回退会破坏已升级的宪章)。
- **过渡期 shadcn + HeroUI 共存**:用户决策一次性全量替换,理论无长期共存;但开发过程(单 PR 内)会存在中间状态,需在 PR 合并前确保完全清理。

## Requirements *(mandatory)*

### Functional Requirements

#### A. 视觉与组件库

- **FR-A001**: 全站 UI MUST 迁移到 HeroUI v3(`@heroui/react` + `@heroui/styles`),采用组合式 API(`Card.Header` 等),交互事件改用 `onPress`。
- **FR-A002**: 仓库 MUST 不再包含 `@radix-ui/*`、`cmdk`、`class-variance-authority`、`framer-motion`(若 HeroUI v3 不需要)等旧依赖;`pnpm install --frozen-lockfile` 在 CI 通过。
- **FR-A003**: `src/components/ui/` 中 shadcn 原生 14 件(`button.tsx`、`dialog.tsx` 等)MUST 被移除或重构为 HeroUI re-export。
- **FR-A004**: `components.json` MUST 被删除。
- **FR-A005**: `globals.css` MUST 落地奶油琥珀语义令牌:`--background #F8F4EA` / `--surface #FFFDF8` / `--accent #C79032` / `--accent-hover #A97420` / `--foreground #292721` / `--muted #817B6D` / `--dark-surface #22211E` / `--income #3B9B74` / `--expense #D76555`。
- **FR-A006**: `@import` 顺序 MUST 为 `tailwindcss` 之后 `@heroui/styles`(顺序错误会样式失效)。
- **FR-A007**: 全站卡片圆角统一为 20–24px,所有可点击元素最小命中区域 ≥ 44×44px(移动端友好)。
- **FR-A008**: 全站 MUST 提供一致的加载态、空态、错误态(具体视觉 defer 到 plan 阶段),且焦点可见性符合 WCAG AA。

#### B. 信息架构与导航

- **FR-B001**: 应用 MUST 提供底部 5 入口导航:**首页** `/dashboard`、**账单** `/transactions`、**记一笔** `/transaction/new`(凸起主按钮)、**报表** `/reports`、**我的** `/settings`(文案改为"我的",路由保留)。
- **FR-B002**: 底部导航 MUST 在所有非模态页面可见;当前路由对应入口呈活动态。
- **FR-B003**: 新增/编辑交易成功后 MUST 返回来源页,并**主动失效** `dashboard.summary`、`dashboard.report`、`transactions`(列表/明细)三类 React Query 缓存 key;返回后页面拉取最新数据,不依赖 staleTime 过期。
- **FR-B004**: 从带筛选的账单页编辑交易,返回时 MUST 保留原 URL 筛选参数。

#### C. 首页

- **FR-C001**: 首页顶部 MUST 显示"轻记"品牌、按时间动态问候(早/午/晚)、当前用户 `member.displayName`、当前选择年月;移除通知按钮。
- **FR-C002**: 首页 MUST 支持历史月份选择,UI 形式为 HeroUI `Select` 下拉枚举最近 24 个月(当前月默认高亮);切换月份后,月度收支结余、Top 2 分类、周维度支出趋势随之更新。
- **FR-C003**: 当前月支出趋势 MUST 按自然周(周一至周日)展示,每日缺失补零。
- **FR-C004**: 历史月支出趋势 MUST 按该月自然周汇总,首尾不完整周仍计入该月范围。
- **FR-C005**: 首页主卡 MUST 标注"本月结余"(收入 - 支出语义),不冒充账户总余额。
- **FR-C006**: 首页 MUST 展示支出 Top 2 分类卡,点击跳转 `/transactions?month=<Y-M>&type=expense&categoryId=<id>`。
- **FR-C007**: 首页"最近流水"MUST 固定显示最新 4 条,不受月份选择影响;点击单条进入编辑,"全部"进入账单页。
- **FR-C008**: 首页 MUST 提供隐私按钮,点击后所有金额立即隐藏;状态保存在 `localStorage`,刷新保持。**作用范围仅限展示页**(首页 / 账单 / 报表),"记一笔"页金额输入与预览不受影响。
- **FR-C009**: 隐私模式 MUST 避免"先显示真实金额再切占位符"的闪现(通过 SSR/CSR 协调或 inline script 注入)。闪现检测仅针对展示页金额,"记一笔"页不检测(其金额本就不隐藏)。

#### D. 报表页(新增)

- **FR-D001**: 新增 `/reports` 路由,展示近 6 个月(截至目标月)的收支趋势。
- **FR-D002**: 报表 MUST 显示每月收入、支出、结余(图表 + 文本数值)。
- **FR-D003**: 报表 MUST 显示目标月的分类支出金额与占比;**点击交互范围**:(a)点击趋势某月,分类分析切换到该月;(b)点击分类块,下钻到 `/transactions?month=<Y-M>&type=expense&categoryId=<id>`(与首页 FR-C006 一致)。
- **FR-D004**: 报表图表 MUST 使用轻量 SVG/CSS 实现,不引入大型图表库;MUST 提供文本数值与 ARIA 标签作为可访问后备。
- **FR-D005**: 报表 MUST 受隐私模式影响(隐私开启时金额隐藏)。

#### E. "我的"页面(原设置重组)

- **FR-E001**: `/settings` 路由保留,文案改为"我的";整合:个人信息(昵称)、账户管理、分类管理、API Key、退出登录。
- **FR-E002**: "我的" MUST 提供昵称编辑入口;输入去首尾空格后长度 1–30 字符,通过新的受保护 mutation 保存到当前 member。
- **FR-E003**: 昵称 mutation MUST 只更新当前会话用户对应的 `member`(familyId + memberId 隔离),不影响其他成员。

#### F. API 扩展

- **FR-F001**: `dashboard.summary` MUST 接受可选 `{ year, month }`,缺省为当前 UTC 年月;返回 `monthIncome`、`monthExpense`、`monthNet`、`topExpenseCategories`(前 2)、`recentTransactions`(最新 4 条,不受月份影响)、`expenseTrend`(区分 `daily` 当前月 / `weekly` 历史月,每桶含 start/end/label/amount)、实际查询年月(供客户端校正)。
- **FR-F002**: 新增 `dashboard.report` procedure,输入 `{ endYear?, endMonth? }`(缺省当前),固定返回近 6 个月;每月含收入、支出、结余;目标月额外含分类支出金额 + 占比。
- **FR-F003**: 新增 `auth.updateNickname`(或同等 mutation),受保护(要求登录),输入 `{ displayName }`,trim 后长度 1–30,更新当前 member。
- **FR-F004**: 所有新 procedure MUST 在 server 端校验 `familyId` 隔离,不依赖前端校验。
- **FR-F005**: 数据库 schema MUST 不变更 —— 复用现有 `member.displayName` 列。
- **FR-F006**: 金额单位继续以"分"存储,API 返回/前端展示按需转换(具体接口契约 defer 到 plan 阶段)。

#### G. 工程化与质量门禁

- **FR-G001**: 改版过程中所有 PR MUST 通过 spec-015 CI 门禁(`type-check` + `test` MUST,`lint` 非阻塞)。
- **FR-G002**: 改版完成 MUST 通过人工 QA:375px、430px、桌面端三种尺寸下跑 MVP 完整流程 + 报表流程 + 隐私切换 + 昵称修改。
- **FR-G003**: 改版 MUST 通过键盘导航、焦点样式、ARIA 标签、颜色对比度、44px 点击区域的可访问性检查。
- **FR-G004**: 改版 MUST 提供单元测试覆盖:月份范围计算、周补零、跨月周、跨年顺序、隐私 trim/长度边界、昵称 mutation 权限隔离。
- **FR-G005**: 改版 MUST 提供集成测试覆盖:`dashboard.summary`(默认月/指定月/家庭隔离/无数据)、`dashboard.report`(6 月趋势/目标月分类/跨年)、昵称 mutation 跨家庭隔离、分类下钻参数越权防御。

#### H. 宪章与文档

- **FR-H001**: 宪章 `.specify/memory/constitution.md` MUST 同步修订 v2.0.0 → v3.0.0,§技术栈"组件: shadcn/ui 保持" → "组件: HeroUI v3 (@heroui/react + @heroui/styles)"。
- **FR-H002**: 宪章修订 MUST 在同步影响报告标记 MAJOR,理由:UI 视觉变更 + 公共组件 API 变更 + 依赖树变更 + IA 重构 + 新增报表页。
- **FR-H003**: 主题文档(`docs/THEME.md` 或扩展 `docs/configuration.md`)MUST 落地,列出所有语义令牌、修改示例、(可选)暗色模式保留说明。
- **FR-H004**: 历史 spec(008/009/010/023/024/025)中"今后使用 shadcn"的指示语句 MUST 同步改为 HeroUI;标题保留作为历史记录。
- **FR-H005**: 1.0.0 GitHub Release notes MUST 通过 `--generate-notes` 自动生成,不维护独立 CHANGELOG.md(spec-015 FR-014)。

### Key Entities *(include if feature involves data)*

本 spec 不引入数据库实体(不修改 Drizzle/PostgreSQL schema)。引入以下"工作流层抽象实体":

- **UI Component Library(组件库)**: 仓库活跃使用的 React UI 组件来源。约束:1.0.0 后 MUST 只有 HeroUI v3。
- **Theme Token Map(主题令牌映射)**: 奶油琥珀色板与 HeroUI CSS 变量的映射。属性:9 个语义令牌(background / surface / accent / accent-hover / foreground / muted / dark-surface / income / expense)+ 数值。
- **Bottom Navigation(底部导航)**: 5 入口 IA 实体。属性:5 个 entry(route / 文案 / 图标 / 是否凸起 / 活动判断函数)。
- **Dashboard Summary(首页汇总)**: 带 month 维度的查询结果。属性:monthIncome / monthExpense / monthNet / topExpenseCategories(2)/ recentTransactions(4) / expenseTrend(daily|weekly)。
- **Dashboard Report(报表)**: 6 个月趋势 + 目标月分类分析。
- **Privacy Mode(隐私模式)**: localStorage 持久化的布尔状态。属性:enabled、持久化 key、SSR 安全渲染规则。
- **Nickname(昵称)**: 复用 `member.displayName`,无 schema 变更;新增 mutation `auth.updateNickname` 受 familyId + memberId 隔离。
- **Migration Slice(迁移切片)**: 一次 PR 替换的组件/页面集合。属性:涉及的 shadcn 组件、涉及的页面/路由、是否含 UI 行为变更、回滚 commit。约束:每个切片 MUST 独立通过 CI + 人工 QA。1.0.0 固定为两个有序切片:**Spike**(库 + 令牌 + 适配层,UI 不切换)+ **Switch**(全站切换 + 删 shadcn)。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 1.0.0 发布后,人工 QA 在 375px / 430px / 桌面端三种尺寸下跑完整 MVP 流程 + 报表 + 隐私 + 昵称,成功率 = 100%,P0/P1 bug 数 = 0。
- **SC-002**: 1.0.0 发布后,`grep -r "@radix-ui\|cmdk\|class-variance-authority" src/ package.json` 命中数 = 0(`pnpm-lock.yaml` 允许间接出现)。
- **SC-003**: 1.0.0 发布后,CI(`type-check` + `test`)在 main 分支连续 7 天 100% 绿;`lint` 不出现新的 error。
- **SC-004**: 1.0.0 发布后,Lighthouse accessibility 审计在 375px 视口的关键页面(首页、账单、报表、我的)得分 ≥ 90。
- **SC-005**: 1.0.0 发布后 30 天内,UI 相关回归 bug ≤ 2 个(P2 及以下),无 P0/P1。
- **SC-006**: 新贡献者(或三个月后的自己)在 ≤ 30 分钟内凭 `docs/THEME.md` 修改主色并看到效果。
- **SC-007**: 1.0.0 发布后,首页切换月份到历史任意月,响应时间 < 500ms(网络 + 渲染),感知流畅无卡顿。
- **SC-008**: 隐私模式开启后,在慢速 3G 网络 + 节流 CPU 下刷新页面,DevTools Performance 面板无"真实金额 paint"帧(隐私闪现 = 0 次)。

## Assumptions

- **版本号 = 1.0.0 (major)**(用户决策)。**前置条件**:0.2.0 必须先发完(MVP 主体功能闭环)。026 是 1.0.0 主体,0.2.0 → 1.0.0 不另发 0.3.x。
- **迁移节奏 = 一次性全量替换**(用户决策)。与 spec-015 FR-003 短分支 ≤ 7 天冲突 —— 通过"两个有序 PR 各 ≤ 7 天"策略规避:Spike(库/令牌/适配层,UI 不切换)→ Switch(全站切换 + 删 shadcn)。无需启用 admin bypass(详见 Clarifications Q1)。
- **单一浅色主题**:奶油琥珀;**不做暗色模式**(用户明确"深色不在本期")。HeroUI v3 默认支持,但本期不暴露切换。
- **数据库零变更**:昵称复用 `member.displayName`,不新增列、不新增表。
- **路由保留**:`/settings` 改名为"我的",不迁移到 `/profile` 或 `/me`(避免无必要迁移)。
- **报表默认近 6 个月**:不提供任意日期范围选择。
- **不建设**:通知中心、预算、净资产、账户趋势(V2/V3 范围,见 `docs/ROADMAP.md`)。
- **不引入大型图表库**:报表用轻量 SVG/CSS;若复杂度超预期 defer 到 plan。
- **时间边界延续 UTC**:不改变既有汇总语义;数据库金额继续以"分"为单位。
- **dnd-kit 不迁移**:它是拖拽库,不是 UI 组件库;继续保留。
- **Better-Auth、tRPC、Drizzle 等 non-UI 栈不受影响**:本 spec 只动 UI 层 + 新增 procedure,不动数据库/认证/ORM。
- **宪章修订 v2.0.0 → v3.0.0 与代码同 PR 完成**:不允许 spec 与宪章矛盾超过一个发布周期。
- **迁移过程不保留 shadcn 作为可切换选项**:YAGNI(双组件库同时支持违反宪章原则六)。
- **Next.js 16 + React 19 + Tailwind v4 与 HeroUI v3 兼容**:HeroUI v3 文档明确支持;若发现兼容性问题,plan 阶段决策回退(违反 [[scaffold-with-current-versions]] 偏好,需明确讨论)。
- **单人维护**:无外部 UI 设计师参与,设计令牌映射 + IA 细节由维护者决策。
