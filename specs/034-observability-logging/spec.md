# Feature Specification: 服务端可观测日志

**Feature Branch**: `034-observability-logging`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description:
> 添加可观测日志;参考市面方案例如可以接入 pinojs

## Background & Problem

当前仓库**生产环境没有任何结构化日志**:

- `src/app/api/trpc/[trpc]/route.ts:23` 的 `console.error` 仅在 `NODE_ENV === "development"`
  生效,生产分支 `onError` 为 `undefined`,即生产环境的 tRPC 错误**完全静默**。
- 全仓 `src/` 下 `console.*` 仅 2 处(1 处 dev-only tRPC 错误、1 处测试桩),业务层
  (transaction create / dashboard summary / auth)无任何运行时观测点。

宪章 §五(性能与极速录入)要求 `transaction.create` mutation p95 < 300ms、Dashboard
query p95 < 500ms,但当前**没有手段测量**这两个指标是否达成 —— 既无慢请求日志,也无
错误堆栈可追溯。033 离线队列引入 `clientRequestId` 幂等后,重复提交的诊断也需要可观测
信号支撑。

本 spec 解决"线上出问题两眼一抹黑"的基础设施空白,为后续性能调优、错误归因、安全审计
提供事实依据。

## Clarifications

### Session 2026-07-19

- **Q1 — 日志要覆盖哪些层?(范围决策)**
  → A:**服务端三层**(tRPC 边界 + 领域 procedure 关键路径 + 数据访问异常)。
  - **tRPC 边界**:每个请求记录 method/path/userId(脱敏)/duration/errorCode —— 用于
    p95 测量与错误归因。
  - **业务关键路径**:`transaction.create`(含幂等命中/未命中)、`auth.signIn/signUp`
    (含锁定/限流触发)、`dashboard.getMonthSummary` —— 这些是宪章 §五 p95 硬指标所在。
  - **数据访问异常**:Drizzle 查询抛错时记录 SQL 状态码(不记参数值,避免泄漏)。
  - **不覆盖前端**:前端错误用现有 `sonner` toast 呈现给用户,浏览器侧观测不在本 spec
    范围(留待后续 RUM/ Sentry 类 spec)。
  - **不引入请求追踪 / 分布式 tracing**:单仓单进程,tRPC request-scoped 日志足够,
    OpenTelemetry / trace propagation 违反宪章 §六 YAGNI(无真实分布式需求)。

- **Q2 — 日志输出格式与传输方式?(格式决策)**
  → A:**生产环境结构化 JSON 行**(每行一条,字段化,机器可解析);**开发环境人类可读
  着色输出**(便于本地调试)。
  - **输出目标**:`stdout`/`stderr`(容器十二要素原则,由 Docker 日志驱动收集)。
    **不**自建文件落盘、**不**内置 syslog/fluentd/loki 客户端 —— 由部署环境的日志
    收集层负责(现有 docker-compose 已有 Docker logging driver)。
  - **必含字段**:`time`(ISO8601)、`level`、`msg`、`requestId`(单请求内关联)、
    `userId`(已登录时,否为 null)、`path`(tRPC path 或 procedure 名)、`durationMs`
    (适用于请求/查询级)。
  - **敏感字段脱敏**:`amount`、`remark`、`password`、`email`、`BETTER_AUTH_SECRET`、
    `DATABASE_URL` **绝不入日志**;`userId` 用 uuid(不可逆推身份,但可聚合同用户行为)。

- **Q3 — 日志采样与级别策略?(成本与噪声决策)**
  → A:**按级别默认全量 + 慢请求自动升级**。
  - 级别:`error`(异常,必记)、`warn`(可恢复异常/业务降级,如幂等命中、限流触发、
    登录锁定)、`info`(正常请求完成 + 业务关键事件)、`debug`(默认关闭,`NODE_ENV=
    development` 时启用)。
  - **慢请求自动 warn**:tRPC 请求 duration 超过宪章 §五 p95 阈值(transaction 300ms /
    dashboard 500ms)的,无论成功失败**自动升一级记 warn**(便于性能回归追踪)。
  - **不做采样抽样**:MVP 流量低,全量保留;若未来 QPS 上升,再在 plan 阶段评估采样率
    (YAGNI,不为假想流量提前优化)。
  - **健康检查/静态资源噪声过滤**:`/_next/*`、`/api/trpc/health` 等非业务路径默认
    不记 info(避免刷屏),仅 error 记录。

- **Q4 — 日志注入防御(用户可控字符串破坏 JSON 行)**
  → A:**结构化字段 + 序列化器自动转义**。用户可控字符串(`remark`、`path`、`event`
  等)**一律作为结构化字段**传给 logger(如 `logger.info({ path, requestId }, "msg")`),
  由 logger 库的 JSON 序列化器统一转义换行符 / 控制字符 / 引号;**禁止把用户输入字符串
  拼接进 `msg` 字段**(如 `logger.info(\`path=${userInput}\`)` 这种写法在审计中视为
  违规)。这是 pino/winston 等主流库的事实默认行为,无需手写转义器(宪章 §六 YAGNI)。
  - **不**额外加输入长度上限或正则剥控制字符(选项 B/C) —— 序列化器已足够,额外校验
    属于过早防御。若 plan 阶段压测发现单条日志体量异常,再评估加长度上限。

- **Q5 — `requestId` 跨层传播机制(到 Drizzle)**
  → A:**混合方案(AsyncLocalStorage 边界注入 + 关键路径显式参数)**。tRPC 中间件 /
  fetch route 在请求开始时通过 Node `AsyncLocalStorage` 注入 `{ requestId }`;
  任意深层函数(Drizzle repository / 通用领域工具)可通过 `als.getStore()` 零侵入取
  出 `requestId`(避免改每个 procedure / repository 签名)。
  - **关键路径同时显式接收 `requestId` 参数**:`transaction.create`、`auth.signIn`/
    `signUp`、`dashboard.getMonthSummary` —— 这几条是宪章 §五 p95 硬指标所在,显式
    参数使其单测/集成测可对 `requestId` 直接断言日志关联(宪章 §四测试优先)。
  - **非关键路径**靠 AsyncLocalStorage 隐式传递即可,不为它们提前付签名侵入代价
    (宪章 §六 YAGNI)。
  - **测试隔离**:AsyncLocalStorage store 在 Vitest 跨用例不共享(每请求独立 enter/
    exit);集成测需注意并发请求场景下 store 不串(AsyncLocalStorage 本身按异步执行
    上下文隔离,符合需求)。

- **Q6 — Better-Auth 内部日志的归并**
  → A:**接管 Better-Auth logger 钩子 + 分级转发**。Better-Auth 暴露 `logger` 配置项,
  本 spec 注入自定义实现:`error` / `warn` 级(如登录失败、session 异常、插件错误、
  锁定触发)**转发到我们的 logger**,统一 JSON 行格式 + 关联 `requestId`(认证类异常
  是 US1 故障追溯 / US3 安全审计的高价值信号,必须进统一日志流)。
  - **降级处理**:`info` / `debug` 级(如每次 session 续期的 trace 级信息、生命周期
    心跳)**不转发**到我们的 logger,由 Better-Auth 内部默认处理(生产环境静默、dev
    环境 console 显示)。理由:认证库的高频 info 噪声大、对故障追溯价值低,全量转发
    会污染日志流并侵蚀 SC-001 的"按 requestId 检索"信噪比。
  - **库能力前置依赖**:若 plan/research 阶段发现 Better-Auth 当前版本未暴露足够的
    logger 自定义能力(只能换 console 不能换级别路由),则降级为方案 A(不接管,Better-
    Auth 自带 console + 我们在 procedure 调用前后补日志),并在 plan 风险表记录。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 生产故障可追溯(Priority: P1)

作为**运维 / 开发者**,当用户在群里反馈"刚才记账失败 / Dashboard 白屏",我需要能在
服务器日志中**按时间窗口和用户**检索到对应请求,看到:

- 该请求是否到达 tRPC 边界(若无记录 → 网络层/前置代理问题)。
- 命中的 procedure 路径、耗时、最终状态(success / error code)。
- 若失败,错误类型与堆栈摘要(脱敏后)。
- 同一 `requestId` 串联起的上下游日志(如 tRPC 边界 → 领域层异常 → DB 错误状态码)。

**Why this priority**:这是从"线上盲飞"到"线上可观测"的最小闭环。无此能力,宪章 §五的
p95 验收、宪章 §三的聚合不变量审计、033 幂等去重的诊断都失去数据支撑。是其他故事的
**横切前置**(非终端用户直接感知,但所有终端用户体验都依赖它)。

**Independent Test**:在 staging 触发一次 `transaction.create` 失败(如故意传非法
categoryId)→ grep 当日日志,能找到一条 `level=error` 的 JSON 行,含 `requestId`、
`path=transaction.create`、`code=BAD_REQUEST`、`userId=<受害者>`、`durationMs`,且
该 `requestId` 下还有领域层的更详细错误记录。

**Acceptance Scenarios**:

1. **Given** 生产环境一次失败的 tRPC 请求,
   **When** 开发者按 `requestId` 在 `stdout` 中检索,
   **Then** 能拿到该请求从边界到领域的完整日志链,字段齐全且无敏感信息。
2. **Given** 生产环境一次成功但耗时 450ms 的 `transaction.create`,
   **When** 日志写入,
   **Then** 自动以 `warn` 级别记录(因超过 300ms p95 阈值),`msg` 标注"slow request"。
3. **Given** 一次请求中 `remark` 含敏感备注(如"工资 xxx"),
   **When** 日志输出,
   **Then** 该字段不出现在任何日志行中(字段级脱敏生效)。
4. **Given** 生产环境一次包含密码字段的登录失败请求,
   **When** 日志写入,
   **Then** 密码、邮箱、session token 均不入日志,仅记 `path=auth.signIn` +
   `code=UNAUTHORIZED` + `userId=null`。

---

### User Story 2 - 性能基线可度量(Priority: P2)

作为**开发者**,在宪章 §五要求的 p95 性能调优工作中,我需要能从一段时间窗口的日志中
**聚合计算** `transaction.create` 与 `dashboard.getMonthSummary` 的 p50/p95/p99 耗时
分布,以及**慢请求占比**,作为性能回归的客观依据。

**Why this priority**:p95 目标写在宪章里,但当前**无法度量** = 无法验证 = 形同虚设。
US1 解决"能不能看到",US2 解决"能不能聚合算"。延后到 P2 因为依赖 US1 的结构化字段先
就位。

**Independent Test**:对 staging 发 100 次 `transaction.create`(混合正常/异常)→ 用
`jq` 或等价工具对日志按 `path=transaction.create` 聚合 `durationMs`,能算出 p95 数值,
且 p95 与人工秒表抽测一致。

**Acceptance Scenarios**:

1. **Given** 日志中 100 条 `path=transaction.create` 且 `level != error` 的成功请求,
   **When** 用标准 JSON 行工具按 `durationMs` 排序取第 95 百分位,
   **Then** 得到的数值与前端实测延迟在同一数量级(误差 < 50ms,排除网络抖动)。
2. **Given** 一周累计的 dashboard 请求日志,
   **When** 统计 `level=warn`(慢请求)的占比,
   **Then** 比值可作为"宪章 §五是否被违反"的量化指标(用于后续优化决策)。

---

### User Story 3 - 安全与业务事件留痕(Priority: P3)

作为**家庭记账系统的拥有者**,我需要对几类**安全/业务关键事件**有日志留痕,以便事后
审计:

- 登录锁定触发(FR-009 错误次数达上限)。
- 注册限流触发(FR-018)。
- 注册开关 `ALLOW_REGISTRATION` 被首次用户绕过(首次注册时)。
- 幂等去重命中(同一 `clientRequestId` 重复提交)。
- 资源越权尝试(用户访问其他 family 的资源,tRPC 抛 NOT_FOUND)。

**Why this priority**:这些事件本身已有功能(033 幂等、FR-009 锁定等),但当前**无留痕**
意味着事后无法回答"上周有没有人尝试撞库 / 有没有重复记账被去重"。P3 因为不影响功能
正确性,仅影响可审计性。

**Independent Test**:在 staging 故意触发 5 次密码错误登录 → grep 日志能找到 5 条
`event=auth.lockout_triggered` 的 `warn` 记录,含 `userId`(被锁账户)与 `retryAfterSeconds`。

**Acceptance Scenarios**:

1. **Given** 同一账户连续登录失败至触发锁定(FR-009),
   **When** 锁定生效,
   **Then** 日志记一条 `warn` 级别、`event=auth.lockout_triggered`,含目标账户与
   重试窗口。
2. **Given** 同一 `clientRequestId` 第二次提交(033 幂等命中),
   **When** 服务器返回既有 transaction,
   **Then** 日志记一条 `info` 级别、`event=idempotency.hit`,含 `clientRequestId`
   (该 id 本身是客户端生成的 uuid,非敏感)。
3. **Given** 用户 A 试图访问 family B 的 transaction id,
   **When** tRPC procedure 抛 NOT_FOUND,
   **Then** 日志记 `warn`、`event=authz.cross_family_attempt`,含访问者 userId 与
   被访问资源 id(用于排查是否恶意)。

---

### Edge Cases

- **日志自身抛错怎么办?**(如 stdout 被关闭、磁盘满):日志写入失败**不得**导致业务
  请求失败 —— 日志层必须 fail-open(吞掉日志错误,业务继续)。
- **请求体超大**:批量导入场景(虽然 MVP 范围外,但 transaction 列表 query 可能返回大
  payload)日志**不记请求/响应 body**,仅记 metadata(避免单条日志 MB 级)。
- **日志注入(用户可控字符串)**:用户在 `remark` 等字段塞入 `\n`、`}`、控制字符,
  试图破坏 JSON 行结构或伪造下一条日志。**对策**(FR-013):用户输入一律作为结构化
  字段传 logger,序列化器自动转义;审计中禁止 `logger.info(\`...${userInput}\`)` 拼
  接写法。验证:输入含 `\n{"level":"info","msg":"fake"\n` 的 remark → 输出仍是单条
  合法 JSON 行,`remark` 字段值被转义为字符串字面量。
- **日志时区**:`time` 字段统一 ISO8601 UTC(带 `Z`),显示层(运维看日志)按本地时区
  转换;DB 已用 timestamptz UTC,宪章 §TZ 一致。
- **开发环境热重载**:Next.js dev server HMR 时 logger 实例不能泄漏(每次热载新建
  实例导致 fd 泄漏)—— plan 阶段需评估 logger 单例化策略。
- **测试运行时日志**:Vitest 跑测试时日志默认静默(`NODE_ENV=test` 不输出 info),仅
  在测试主动断言时才捕获(避免测试输出噪声)。
- **AsyncLocalStorage 跨请求串扰**:`requestId` 通过 ALS 传播时,需保证并发请求(同
  进程内多个 tRPC 调用)各自独立 enter/exit store,不互相覆盖。Node ALS 按异步执行
  上下文天然隔离,但 plan/实现阶段需集成测验证并发场景下日志 `requestId` 不串。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 在 tRPC 请求边界为**每个请求**生成唯一 `requestId`,并在该
  请求的所有日志行中携带同一 `requestId`,使日志可按请求聚合。传播机制采用**混合方案**:
  tRPC 中间件 / fetch route 在请求开始时通过 Node `AsyncLocalStorage` 注入 `requestId`;
  宪章 §五 p95 关键路径(`transaction.create` / `auth.*` / `dashboard.getMonthSummary`)
  的领域/数据访问函数**同时显式接收 `requestId` 参数**(便于单测/集成测断言);其余
  路径靠 AsyncLocalStorage 隐式传递。

- **FR-002**: 系统 MUST 在生产环境输出**结构化 JSON 行**日志(每行一条,字段固定),
  在开发环境输出**人类可读着色**日志;两者切换由 `NODE_ENV` 决定,无需额外配置。

- **FR-003**: 系统 MUST 记录以下请求级字段:`time`(ISO8601 UTC)、`level`、`msg`、
  `requestId`、`userId`(已登录则 uuid,否则 null)、`path`(tRPC path)、`durationMs`、
  `code`(tRPC error code,失败时)、`event`(业务事件名,见 FR-008)。

- **FR-004**: 系统 MUST 对以下字段做**脱敏**,绝不入日志:密码、邮箱、session token、
  `BETTER_AUTH_SECRET`、`DATABASE_URL`、交易 `amount`、交易 `remark`、`clientRequestId`
  之外的任何用户输入原文。`userId` 允许记录(用于聚合,uuid 不可逆推身份)。

- **FR-005**: 系统 MUST 在 tRPC 请求完成(成功或失败)时记一条请求级日志;成功记
  `info`(默认),失败记 `error`。

- **FR-006**: 系统 MUST 对超过宪章 §五 p95 阈值的请求(`transaction.create` > 300ms、
  `dashboard.*` > 500ms)自动升级为 `warn` 级别并标注 slow 标记,无论最终成功或失败。

- **FR-007**: 系统 MUST 在 Drizzle 查询抛错时记 `error` 日志,含 SQL state code(若
  可得)、procedure 名、`requestId`;**不**记 SQL 语句参数值(脱敏)。

- **FR-008**: 系统 MUST 对以下业务/安全事件记 `warn`(异常但可恢复)或 `info`(正常
  但需审计)级别的事件日志,字段 `event` 标注事件名:
  - `auth.lockout_triggered`(warn)
  - `auth.rate_limited`(warn,注册限流)
  - `auth.first_user_bypass`(info,首次用户绕过 `ALLOW_REGISTRATION`)
  - `authz.cross_family_attempt`(warn,跨 family 越权)
  - `idempotency.hit`(info,033 幂等去重命中)

- **FR-009**: 系统 MUST 过滤以下路径的 `info` 级日志(避免噪声),仅保留 `error`:
  `/_next/*`、静态资源、健康检查端点。

- **FR-010**: 系统 MUST 保证日志写入失败**不影响业务请求** —— 日志层 fail-open,日志
  抛错被捕获并丢弃(可降级为 best-effort stderr 写一行 fallback)。

- **FR-011**: 系统 MUST 在测试环境(`NODE_ENV=test`)默认**静默 info/debug 输出**,
  仅在测试主动调用日志断言时才捕获;测试不得因日志产生噪声。

- **FR-012**: 系统 MUST 提供单一的、可在服务端任意层(tRPC 边界、领域层、数据访问层)
  导入的 logger 入口;该入口在生产/开发/测试三种环境行为自动切换,调用方无需感知环境。

- **FR-013**: 系统 MUST 保证所有用户可控字符串(如 `remark`、客户端传入的 `path`
  段、错误消息中回显的输入)**以结构化字段形式**传入 logger(而非拼接到 `msg`),
  由 logger 的 JSON 序列化器自动转义换行符 / 控制字符 / 引号,**禁止**字符串拼接
  用户输入到 `msg` 字段。目标:任何用户输入都无法破坏单行 JSON 日志的结构完整性
  (防日志注入污染整条日志流)。

- **FR-014**: 系统 MUST 接管 Better-Auth 的 logger 配置,将其 `error` / `warn` 级
  事件**转发至本 spec 的统一 logger**(JSON 行 + `requestId` 关联),使其进入与
  tRPC 边界日志同一检索流;`info` / `debug` 级**不转发**,由 Better-Auth 默认行为
  处理(生产静默、dev console)。前置依赖:Better-Auth 当前版本须暴露足够的 logger
  自定义能力;若 research 阶段证伪,降级为"不接管 + procedure 层补日志",并在 plan
  风险表登记。

### Key Entities *(include if feature involves data)*

- **LogRecord**(逻辑实体,不入库,仅 stdout 传输):一条日志记录。字段见 FR-003。
  无持久化 —— 本 spec 不引入日志存储层(由部署环境的日志收集层负责)。
- **RequestId**:UUID v4 或等价唯一字符串,在 tRPC context 创建时生成,随请求生命周期
  传递(不入库,仅用于日志关联)。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 生产环境任意一次失败的 tRPC 请求,运维能在日志中按 `requestId` 检索到
  **至少 1 条 `error` 记录**,且该记录含 `path`、`code`、`userId`、`durationMs` 字段。

- **SC-002**: 对 `transaction.create` 与 `dashboard.getMonthSummary` 两类 procedure,
  能从 24 小时窗口的日志中聚合出 p50 / p95 / p99 耗时,作为宪章 §五 p95 达标/未达标
  的客观依据。

- **SC-003**: 1000 条生产日志行中,**任意一行**经自动敏感字段扫描,均不含密码、邮箱、
  session token、`DATABASE_URL`、交易金额、交易备注原文(零泄漏)。

- **SC-004**: 生产日志的额外开销不超过请求 p95 的 **5%**(即日志本身不显著拖慢宪章
  §五的 300ms/500ms 预算)。

- **SC-005**: 触发一次 Drizzle 查询异常(如连接断开),日志中出现对应 `error` 记录且
  含 SQL state code;触发一次跨 family 越权,日志中出现 `authz.cross_family_attempt`
  warn 记录。

- **SC-006**: 切换 `NODE_ENV=development` / `production` / `test` 三种环境,日志输出
  格式与级别行为**无需改代码**即自动切换(开发着色人类可读 / 生产 JSON / 测试静默)。

## Assumptions

- **日志收集由部署层负责**:本 spec 仅产出 `stdout`/`stderr` 结构化行,不自建文件
  落盘、不内置 syslog/loki/fluentd 客户端。现有 docker-compose 的 Docker logging
  driver 视为默认收集层(宪章 §六 YAGNI:不为假想的 ELK 栈提前引入依赖)。
- **库选型延后到 plan 阶段**:用户提到的 `pinojs` 是 plan/research 阶段的候选评估
  对象,与 winston / console-包装 等方案一起对比(性能、生态、与 Next.js / tRPC 集成
  成本)。本 spec 只定义"需要可观测日志"的 WHAT 与 WHY,不冻结 HOW。
- **Better-Auth logger 钩子能力是 plan 阶段待验证假设**(FR-014):本 spec 假设
  Better-Auth 当前版本(1.2.7)暴露足够的 logger 自定义能力以支持分级转发。若
  research 阶段证伪,降级为"不接管 + procedure 层补日志"。属可控降级路径,不阻塞
  spec 本身。
- **前端观测不在范围**:浏览器侧错误用现有 `sonner` toast 呈现;RUM / Sentry 类前端
  可观测留待后续独立 spec。
- **不引入分布式 tracing**:单仓单进程,tRPC request-scoped `requestId` 足够关联;
  OpenTelemetry / trace propagation 违反宪章 §六 YAGNI。
- **不记请求/响应 body**:仅记 metadata,避免单条日志 MB 级;批量导入(范围外)同样
  策略。
- **日志保留策略由部署层决定**:本 spec 不规定保留天数(部署层日志轮转策略负责)。
- **依赖现有 `clientRequestId`**:US3 的 `idempotency.hit` 事件依赖 033 的幂等基石已
  落地;若 033 未合并,本 spec 的 US3 该事件项推迟(不影响 US1/US2 交付)。
