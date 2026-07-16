<!--
=== 同步影响报告 (Sync Impact Report) ===
版本变更: 1.0.0 → 2.0.0 (MAJOR)
原则修改:
  - 一、MVP Scope                  → 保持 (措辞不变)
  - 二、Layered Architecture       → 重写为 "二、Feature-Sliced Architecture (tRPC + Next.js App Router)"
  - 三、Domain-Driven Design       → 保持 (Family 仍为聚合根,措辞略调以适配 tRPC server procedure)
  - 四、Test-First                 → 保持 (Vitest 仍是测试运行器)
  - 五、Performance & Fast Input   → 保持 (p95 目标略调,因 Next.js API route 冷启动)
  - 六、Simplicity (YAGNI)         → 保持
新增章节: 无
删除章节: 无
技术栈章节修改 (MAJOR):
  - 后端框架: NestJS → 移除 (合并入 Next.js)
  - 新增: Next.js (App Router, 全栈)
  - 新增: tRPC (端到端类型安全 RPC)
  - 新增: Better-Auth (认证库)
  - ORM: Drizzle 保持
  - 数据库: PostgreSQL 保持
  - 前端框架: Next.js 升格为全栈 (不再是独立 feature)
  - 样式: Tailwind CSS 保持
  - 组件: shadcn/ui 保持 [v3.0.0 已迁移至 HeroUI v3,v3.2.1 适配层全量移除]
  - 部署: Docker 保持
修订动机:
  原 v1.0.0 假设后端独立 NestJS 工程 + 前端独立 Next.js 工程。
  实际 MVP 场景下,前后端分离增加协调成本而无独立扩展需求。
  迁移至 T3 Stack (Next.js 全栈 + tRPC + Better-Auth + Drizzle):
  - 端到端 TS 类型安全,无需手写 REST 契约
  - 认证由 Better-Auth 接管 (但仍保留 spec 的 FR-009 锁定 / FR-016 审计 / FR-018 限流)
  - 单仓单进程部署,符合 MVP "Docker 一键启动" 验收标准
  - 宪章六 YAGNI: 减少一个工程边界 = 减少维护负担
迁移影响:
  - spec.md 业务需求 (FR/SC/US) 框架无关,完全保留
  - 5 项 clarification 完全保留 (会话 TTL、密码策略、审计、锁定 UX、注册限流)
  - plan.md / research.md / data-model.md / contracts/ / tasks.md / quickstart.md 配套重写
  - contracts/*.md 删除 (tRPC 类型自动派生)
待更新模板:
  - .specify/templates/plan-template.md — ✅ 无需修改
  - .specify/templates/spec-template.md — ✅ 无需修改
  - .specify/templates/tasks-template.md — ✅ 无需修改
遗留 TODO: 无
=== 同步影响报告结束 ===


=== 同步影响报告 (Sync Impact Report) ===
版本变更: 2.0.0 → 3.0.0 (MAJOR)
原则修改: 无原则章节变更
新增章节: 无
删除章节: 无
技术栈章节修改 (MAJOR):
  - UI 组件: shadcn/ui (Radix + Tailwind) → HeroUI v3 (@heroui/react + @heroui/styles)
    (React Aria + Tailwind v4 + oklch 主题)
  - 样式层备注更新: Tailwind CSS → Tailwind CSS v4 (配合 HeroUI v3)
  - 其它栈保持 (Next.js / tRPC / Better-Auth / Drizzle / PostgreSQL / Docker / Vitest)
修订动机:
  026-cream-amber-revamp (1.0.0 release) 全站迁移 shadcn → HeroUI v3。理由:
  - HeroUI v3 基于 React Aria,无障碍支持更强 (宪章未明文要求但符合产品价值)
  - HeroUI v3 用 oklch 色彩空间 + CSS 变量主题,与 Tailwind v4 原生对齐
  - HeroUI v3 组合式 API (Card.Header / Modal.Content) 比 shadcn flat API 更清晰
  - 单人维护偏好: HeroUI 默认配色 + variant 系统降低主题决策负担
迁移影响:
  - 14 个 src/components/ui/*.tsx 改为 HeroUI 适配层 (shadcn API 兼容)
    [v3.2.1 注: 适配层已于后续全量移除,业务代码直接用 @heroui/react 原生]
  - 删除依赖: @radix-ui/* (8 件) / cmdk / class-variance-authority / tw-animate-css
  - 新增依赖: @heroui/react / @heroui/styles / tailwind-variants
  - 删除 components.json (shadcn CLI 配置)
  - 026 spec / plan / research / data-model / contracts / tasks / quickstart 已落地
待更新模板: 无
遗留 TODO: 无
=== 同步影响报告结束 ===


=== 同步影响报告 (Sync Impact Report) ===
版本变更: 3.0.0 → 3.1.0 (MINOR)
原则修改: 无原章节变更
新增章节: 七、UI 调整纪律 (HeroUI + /heroui-react skill)
删除章节: 无
技术栈章节修改: 无 (HeroUI v3 栈在 v3.0.0 已冻结)
修订动机:
  v3.0.0 完成栈迁移 shadcn/ui → HeroUI v3 后,缺乏工作流纪律约束。
  AI 协作场景下,Agent 易凭陈旧训练记忆 (shadcn / cva / Radix API)
  直接编码,导致:
  - HeroUI v3 组合式 API (Card.Header / Modal.Content) 被误用为 flat API
  - oklch token 命名错配 (--accent vs shadcn --primary)
  - variant 系统被绕过,退化为手写 className
  - a11y (React Aria) 能力被静默回退
  /heroui-react skill 缓存了 HeroUI v3 最新文档 (组件 API / props /
  variant / theming / dark mode),一次查询比 grep + 试错更省时,
  符合原则六 YAGNI ("复杂度是白交的税")。
  本原则把 "UI 调整前先查 skill" 从隐含期望升格为 MUST 级宪章约束。
迁移影响:
  - plan-template.md / spec-template.md / tasks-template.md 无需修改
    (plan-template Constitution Check 为动态门,自动继承新原则)
  - docs/AGENTS.md 第 22 行仍写 "shadcn/ui" (v3.0.0 遗留 staleness),
    属既有技术债,非本次修订引入;建议在下一 patch 跟进
  - docs/THEME.md 已与 HeroUI v3 对齐,无需修改
待更新模板:
  - .specify/templates/plan-template.md — ✅ 无需修改
  - .specify/templates/spec-template.md — ✅ 无需修改
  - .specify/templates/tasks-template.md — ✅ 无需修改
遗留 TODO:
  - docs/AGENTS.md:22 "shadcn/ui" → "HeroUI v3 (@heroui/react + @heroui/styles)"
    (v3.0.0 遗留,非本次修订范围;建议下次 docs patch 一并修正)
=== 同步影响报告结束 ===


=== 同步影响报告 (Sync Impact Report) ===
版本变更: 3.1.0 → 3.2.0 (MAJOR)
原则修改:
  - 一、MVP Scope → 重写禁止项清单 (移除"转账、预算",保留 AI/OCR/导入导出/投资/多币种)
  - 三、Domain-Driven Design → 重写"新表"段 (解锁 Budget;Asset/Debt 用 Account.type 推导不新增表;Investment 仍属范围外)
新增章节: 无
删除章节: 无
技术栈章节修改: 无 (HeroUI v3 栈在 v3.0.0 已冻结)
修订动机:
  手机端首页设计 (2026-07-14, spec 027-mobile-home-revamp) 把转账、预算、
  资产聚合、退款列为首页核心模块。v3.1.0 原则一/三的禁止项与已确认的
  产品方向冲突。宪章作为"仓库内最高权威文档"应反映已确认方向,而非用
  陈旧禁止项阻塞。本次 MAJOR 修订解除四项能力的范围限制:
    - 转账 (transfer 交易类型)
    - 预算 (Budget 表,月周期)
    - 资产聚合 (Account.type asset/debt 分组,不新增 Asset/Debt 表)
    - 退款 (反向支出,type='expense' + 正 amount)
  仍属范围外 (保留禁止): AI、OCR、导入导出、投资、多币种。
迁移影响 (FR-C002, 治理章节 MAJOR 修订硬要求):
  现有代码迁移清单见 specs/027-mobile-home-revamp/plan.md
  §"现有代码迁移清单 (FR-C002, US1 合规必备)"。要点:
    - transactionType 枚举加 transfer (schema/migration/domain/router 全链路)
    - getMonthSummary 聚合 SQL 从 sign-driven 改 type-driven (research R9)
    - WHERE type='expense' 查询无需改 (transfer 不归分类,自动正确)
    - accounts 加 type 列 (DEFAULT 'asset', 向后兼容)
    - budgets 新表 + UNIQUE(family_id, year, month)
    - 退款: expense 分支加 isRefund 标志, procedure 跳过 applySign 存 +abs
待更新模板:
  - .specify/templates/plan-template.md — ✅ 无需修改
  - .specify/templates/spec-template.md — ✅ 无需修改
  - .specify/templates/tasks-template.md — ✅ 无需修改
遗留 TODO:
  - docs/AGENTS.md:22 "shadcn/ui" → "HeroUI v3" 由 027 T006 同 PR 修正
    (本次 MAJOR 修订一并落地,关闭 v3.0.0/v3.1.0 两轮遗留 TODO)
=== 同步影响报告结束 ===


=== 同步影响报告 (Sync Impact Report) ===
版本变更: 3.2.0 → 3.2.1 (PATCH)
原则修改: 无原则章节变更;更新原则七的过时引用
新增章节: 无
删除章节: 无
技术栈章节修改: 无 (HeroUI v3 栈在 v3.0.0 已冻结)
修订动机:
  v3.2.0 时,src/components/ui/ 下仍存 13 个 shadcn→HeroUI 适配层,
  原则七与历史同步报告均引用 "适配层"。本次已完成全量移除适配层
  (13 个文件删除,业务代码直接用 @heroui/react 原生),宪章描述
  需反映代码事实。同时 token 从 shadcn legacy (text-muted-foreground)
  统一为 HeroUI 原生 (text-muted),补入原则七。
迁移影响:
  - src/components/ui/ 目录已删除,全项目直接用 @heroui/react
  - 原则七: 移除 "src/components/ui/*.tsx 适配层" 引用,
    改为 "新建/修改 UI 组件前先查 HeroUI 原生 API"
  - 原则七: 补 "用 HeroUI 原生 token (text-muted),不用 shadcn
    legacy (text-muted-foreground)" 约束
  - v3.0.0 同步报告第 62 行 "14 个适配层" 标注为历史记录(不删历史报告)
待更新模板: 无
遗留 TODO: 无
=== 同步影响报告结束 ===
-->

# BALTHASAR 家庭记账系统 宪章

家庭记账系统的全栈 Web 应用 (代号: BALTHASAR)。
本宪章是仓库内最高权威文档;任何其他文档与本宪章冲突时,以本宪章为准。

## 核心原则

### 一、MVP 范围 (不可妥协)

MVP 的定义见 `docs/MVP.md` 与 `docs/PRD.md`,是硬性契约。

- 必须实现 MVP 列出的功能 (登录、默认家庭、单成员、账户 Account、
  内置分类 Category、收入/支出 Transaction、Dashboard、流水、
  编辑/删除)。
- 未经 PRD 修订,禁止新增范围外功能 —— AI、OCR、
  导入导出、投资、多币种等。**转账、预算、资产聚合、退款**自 spec
  027-mobile-home-revamp 解锁,纳入 MVP 范围(见 v3.2.0 修订)。
- 任何新表、新 tRPC 路由、新 server action 必须能追溯至 MVP 中的某一项。
- "Less is More" 优先于投机性的灵活度。

**理由**: 产品假设是 "每天真在用、10 秒完成的家庭记账"。范围蔓延是
这一假设的主要失败模式。V2/V3/V4 的功能属于 `docs/ROADMAP.md`,
不属于代码。

### 二、Feature-Sliced Architecture (tRPC + Next.js App Router)

代码按 **业务 feature** 纵向切片,每片包含完整的"前端 UI + 后端逻辑 + 数据访问"。横向层级 (UI / API / Domain / Data) 在每片内部组织,但不跨片共享抽象。

- **前端** (`src/app/<feature>/page.tsx` 与 `src/components/<feature>/`):
  React Server Components 优先,客户端组件仅在需要交互时引入。
- **API 层** (`src/server/api/routers/<feature>.ts`): tRPC procedure,
  每个路由文件 = 一个 feature 的全部后端入口。类型由 TS 编译器自动
  派生,**禁止** 手写 OpenAPI / REST 契约文件。
- **Domain / Data** (`src/server/db/schema/<feature>.ts` 与
  `src/server/domain/<feature>/`): Drizzle schema + 纯函数领域规则。
- **跨 feature 调用** 走 tRPC procedure (前端 → 后端) 或函数导入
  (后端 → 后端);**禁止** 在后端之间引入消息队列、事件总线等中间件
  直到 V2 出现真实需求。

依赖方向: UI → tRPC client → tRPC server procedure → Domain → Drizzle → PostgreSQL。

**理由**: T3 Stack 的精髓是端到端类型安全 + 最小工程边界。横向分层
(Controller/Service/Repository) 在 NestJS 时代合理,但在 tRPC + RSC
语境下被"feature 纵切 + 函数导入"取代。强制分层只会制造无意义的
boilerplate (违反原则六 YAGNI)。

### 三、领域驱动设计

`Family` 聚合是唯一的聚合根。`Member`、`Account`、`Category`、
`Transaction` 均在其内部,且必须通过 `familyId` 引用。

- 聚合不变量必须在 tRPC procedure 的 server 端强制,
  不得依赖前端校验或数据库触发器。
- 跨聚合引用必须使用 ID,禁止使用对象指针。
- 一个 `Transaction` 必须携带 `accountId`、`categoryId`、`memberId`、
  `familyId`、`type`、`amount`、`remark`、`occurredAt` ——
  详见 `docs/DOMAIN.md`。
- 新表解锁状态 (v3.2.0 修订): `Budget` 自 027 解锁,作为 `Family`
  聚合内实体 (按月)。`Asset`/`Debt` 用现有 `Account` 表 + 新增 `type`
  字段推导,不新增表。`Investment` 仍属范围外。
- **Better-Auth 边界**: Better-Auth 拥有 `user` / `session` /
  `verification` / `account` 表 (认证身份),与业务聚合 `Family` 解耦。
  `Family.ownerUserId` 引用 Better-Auth `user.id`,但反向不持有指针。

**理由**: 家庭账本是一个具有自然聚合边界的限界上下文;显式建模可以
防止记账规则泄漏到每一个 router 中。Better-Auth 的认证身份与业务
聚合分离,避免把"用户登录态"与"家庭成员"混为一谈。

### 四、测试优先

先写测试、获批、观察失败、再实现转绿。红 → 绿 → 重构。

- 领域层 (纯函数): Vitest 单元测试,不依赖数据库,不 mock 领域本身。
- tRPC procedure: Vitest + `createCaller` 直接调用,验证输入/输出契约。
- Drizzle Repository 集成测试: 对真实 PostgreSQL 实例
  (testcontainers)。**禁止** mock 数据库 ——
  Drizzle 的 SQL 语义必须被真实执行。
- React 组件: Vitest + Testing Library,关键交互流程必测。
- 每个完成的功能必须随附覆盖正常路径与已记录边界情况的测试。

**理由**: 历史上多次出现 mock 持久层测试通过、生产迁移失败的事故,
代价远超测试套件本身。这一纪律不可妥协。

### 五、性能与极速录入

产品的成功指标是 "手机上 10 秒内完成一笔账"。每一层都必须保护这一
预算。

- 创建交易 tRPC procedure `mutation` p95 < 300ms;
  Dashboard `query` p95 < 500ms。
- 禁止 N+1 查询;Drizzle 必须使用显式 JOIN 或批量加载。
- 前端必须 Mobile-First;Server Components 优先减少客户端 JS。
- Next.js 冷启动 (Vercel/容器) 不计入 p95;基准从 warm 状态测起。

**理由**: 10 秒是一种感觉,不是一个数字。热路径上每 100ms 的延迟
都在侵蚀这种感觉。

### 六、简单 (YAGNI)

不要为假想的未来构建。三行相似代码胜过一个过早抽象。修 Bug 不需要
顺手清理。一次性脚本不需要框架。

- 除非今天确实需要,否则不引入功能开关、抽象层、插件系统。
- 不为尚无调用方的代码编写向后兼容垫片。
- 注释只解释非显然的 "为什么",绝不解释 "做什么"。
- tRPC 的端到端类型推断已经消除"手写契约"的需求,**禁止** 引入
  OpenAPI / Swagger / codegen 工具链 (违反 YAGNI)。

**理由**: 这是一个面向单一产品的小型全栈应用。复杂度在这里是白交的税。

### 七、UI 调整纪律 (优先 /heroui-react skill)

任何 UI 调整 —— 新建组件、修改现有组件、调整主题 token、改 className
或样式 —— **必须** 优先调用 `/heroui-react` skill 获取 HeroUI v3 的组件
API、props、variant、theming 与最佳实践;**禁止** 凭记忆或 shadcn 时代
经验直接编码。

- 触发范围: 任何触及 `src/components/**/*.tsx`、`src/app/**/*.tsx` 中
  JSX / className / 组件 props 的改动。纯文案 copy、纯 tRPC / SQL /
  领域函数调整不触发本规则。
- 新建 / 修改 UI 组件前,先 `/heroui-react` 查 HeroUI v3 原生组件 API
  与组合式子组件 (如 `Card.Header`、`Modal.Content`、`Tabs.List`),
  确认 variant 与 slot 结构后再落码。**业务代码直接导入 `@heroui/react`
  原生组件,不再经过任何适配层。**
- 主题 token 调整前,先 `/heroui-react` 查 oklch 变量与暗色模式约定;
  `docs/THEME.md` 是业务语义映射 (income→success / expense→danger)
  的真相源,HeroUI `variables.css` 是 token 真相源。**用 HeroUI 原生
  token 命名 (如 `text-muted`、`bg-default`、`text-danger`),禁止使用
  shadcn legacy 命名 (如 `text-muted-foreground`)。**
- **禁止** 在未查 skill 的情况下: 引入新 UI 库、手写 Radix-style
  primitives、重建 shadcn 适配层或回退到 shadcn / cva /
  `class-variance-authority` API 模式。
- 合规审查 (见治理章节) 必须包含 "本 UI 改动是否查过 /heroui-react"
  的核对;未查即落码视为违反本原则。

**理由**: v3.0.0 已从 shadcn/ui 迁移至 HeroUI v3 (React Aria + Tailwind v4
+ oklch)。HeroUI v3 的组合式 API、variant 系统、token 命名与 shadcn
差异显著;凭陈旧记忆编码会触发 API 误用、token 错配、a11y 静默回退。
`/heroui-react` skill 缓存了 HeroUI v3 最新文档,一次查询比 grep + 试错
更省时 (符合原则六 YAGNI)。把 "先查 skill" 从隐含期望升格为 MUST 级
约束,是为了对抗 AI 协作场景下 "凭印象编码" 的系统性漂移。

## 技术栈

由 `docs/AGENTS.md` 冻结。下表中任何一项的变更都是宪章修订,
而非重构。

| 层 | 选择 | 备注 |
|---|---|---|
| 全栈框架 | Next.js (App Router) | 单仓单进程,前后端共栈 |
| RPC | tRPC v11 | 端到端 TS 类型安全,无契约文件 |
| 认证 | Better-Auth | 邮箱密码 + session + 插件化 |
| ORM | Drizzle | 类型化查询、迁移 (保留) |
| 数据库 | PostgreSQL 16 | 唯一真相源 (保留) |
| 样式 | Tailwind CSS v4 | 配合 HeroUI v3 组件 |
| UI 组件 | HeroUI v3 (@heroui/react + @heroui/styles) | React Aria + Tailwind v4 + oklch 主题 |
| 部署 | Docker | 一键启动 (MVP 验收标准) |
| 测试 | Vitest + testcontainers | 单元 + 契约 + 集成 |

新增依赖必须有正当理由: 缺失能力,而非便利。

## 开发流程

每个功能的循环 (来自 `docs/AGENTS.md`)。每个完成的功能必须同步更新
以下四项:

1. **迁移** —— 新增并提交 Drizzle migration;验证 down 路径可回滚。
2. **接口 (tRPC)** —— procedure 类型由 TS 编译器推断;
   如修改了 router 输入/输出,**必须**在 `docs/DOMAIN.md` 或对应
   feature spec 中描述新的领域含义。
3. **文档** —— schema 或领域变更时,更新 `docs/DOMAIN.md`、
   `docs/DATABASE.md`。
4. **测试** —— 按原则四添加,先观察红色,再转绿。

四项中任何一项缺失,该功能即视为 "未完成"。代码审查需核对全部四项。

## 治理

当本宪章与 `docs/AGENTS.md`、`docs/PRD.md`、`docs/MVP.md`、
`docs/ROADMAP.md` 冲突时,以本宪章为准。冲突必须通过修订下位文档
解决,而非忽略本宪章。

**修订** 须满足:

1. 一份书面提案,说明变更内容,以及原则 X 为何不再适配现实。
2. 一份针对违反新规则已有代码的迁移计划。
3. 按 SemVer 进行版本号升级:
   - MAJOR: 删除或根本性重定义某条原则 (例: 本次 v2.0.0 替换
     了 v1.0.0 的 "分层架构" 原则,并重定义了技术栈)。
   - MINOR: 新增原则或实质性扩展指引。
   - PATCH: 澄清、错别字、措辞精炼。

**合规审查**: 每一次 `/speckit-plan` 与代码审查都必须包含一次
"宪章检查",逐条列出每条原则并标注是否违反。违反仅在以下情况允许
发生: 该违反已写入 plan 的 Complexity Tracking 表并附带正当理由。

**版本**: 3.2.1 | **批准日期**: 2026-07-06 | **最后修订**: 2026-07-16 (v3.2.1 PATCH: 原则七移除已删适配层引用 + token 命名约束)
