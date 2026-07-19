# Research: 服务端可观测日志

**Feature**: 034-observability-logging
**Date**: 2026-07-19
**Status**: Phase 0 complete — 所有 NEEDS CLARIFICATION 已解析

本文件记录 plan 阶段对 8 项关键技术决策的研究结论。每项给出 **Decision / Rationale /
Alternatives**。spec.md 的 6 项 Clarifications(Q1-Q6)是产品级决策,本文件聚焦**实现级**决策。

---

## R1 — Logger 库选型:pino(选定)

**Decision**:采用 **[pino](https://github.com/pinojs/pino)** 作为生产 logger,搭配
**pino-pretty** 仅作 devDependency 提供开发环境着色。

**Rationale**:
- **性能**(SC-004 ≤5% p95 预算的硬约束):pino 在所有公开 benchmark 中比 winston 快 5-8x
  ([Dash0 2026](https://www.dash0.com/guides/nodejs-logging-libraries)、
  [PkgPulse 2026](https://www.pkgpulse.com/guides/best-nodejs-logging-libraries-2026)、
  [StackOverflow 技术拆解](https://stackoverflow.com/questions/74623140/how-pino-is-faster-than-other-library))。
  pino 用 worker thread 异步序列化 + 直接写 fd,避免 winston 的同步 transport 队列。
  在宪章 §五 300ms/500ms 预算下,5% = 15ms/25ms,winston 同步 transport 在高频小请求下逼近上限。
- **原生 JSON 行输出**(FR-002):pino 默认输出 JSON 行,无需 formatter;winston 需额外配
  `format.json()` 且默认带 colorize 在生产干扰。
- **结构化字段一等公民**(FR-013 注入防御):pino API `logger.info({ path, requestId }, "msg")`
  天然鼓励结构化字段;序列化器自动转义换行/控制字符,正好实现 spec Q4 的"用户输入不拼接 msg"。
- **Next.js / Node 20 兼容**:pino 是纯 JS,无 native addon,Vercel/容器皆可跑。
- **生态精简**:pino-pretty 是唯一辅助依赖(dev only),不引入 pino-http(见 R3 弃用)。

**Alternatives**:
- **winston**:更老、生态更丰富(多 transport),但同步 transport 与 SC-004 冲突;且其默认 API
  鼓励 `logger.info("msg " + var)` 字符串拼接(FR-013 反模式)。**弃用**。
- **自包装 console**:`process.stdout.write(JSON.stringify(...))` —— 看似零依赖,但要手写:
  序列化、转义、级别路由、dev 着色、异步写、redact。手写量约 200+ 行,违反宪章 §六 YAGNI
  的反面(这里是"重复造轮子",YAGNI 的真正含义是不为假想未来构建,**已存在**的需求不算)。
  关键失败点:**手写 JSON.stringify 不防原型链注入 / 不防 `toJSON()` 副作用**,生产风险高。**弃用**。
- **bunyan**:已停更(最后发布 2018),不支持 ESM。**弃用**。
- **melonade / roarr / dblab**:小众,生态不足以支撑长期维护。**弃用**。

**Risk**:pino 主仓库活跃(weekly release),但 v9 → v10 可能在未来引入 breaking。**Mitigation**:
锁主版本 `pino@^9`(npm caret),breaking 升级走宪章修订流程。

---

## R2 — requestId 跨层传播:AsyncLocalStorage + 关键路径显式参数(选定混合方案)

**Decision**:实现 spec Q5 决策(Option C 混合)。
- `src/lib/request-context.ts` 封装 `AsyncLocalStorage<{ requestId: string; userId: string | null }>`。
- tRPC `createContext`(或独立 middleware)在请求开始时 `requestContext.enterWith({ requestId: uuid(), userId: null })`,
  session 解析后更新 `userId`。
- 任意深层函数(Drizzle repository / 通用工具)通过 `getRequestContext()?.requestId` 取出。
- **关键路径同时显式参数**:`transaction.create` / `auth.signIn` / `auth.signUp` /
  `dashboard.getMonthSummary` —— procedure 签名内部把 `requestId` 显式传给 domain/repository 调用,
  使单测可直接断言(无需 mock ALS)。

**Rationale**:
- **零侵入基础设施**:非关键路径(如 `transaction.list` / `category.*`)无需改签名,ALS 自动传。
- **关键路径可测**:宪章 §四测试优先 —— 关键路径显式参数让单测/集成测可对 `requestId` 直接断言,
  不依赖 ALS mock(ALS mock 跨 async 边界易出错)。
- **Node 原生**:`async_hooks` 自 Node 14 起稳定,Node 20 是当前 LTS,无 polyfill 需求。
- **Vercel / Next.js 16 兼容**:ALS 在 Node runtime 完整工作。本仓 tRPC route 用 Node runtime
  (非 edge),无兼容性风险(若未来引入 edge runtime,ALS 在 edge 受限,届时评估)。

**Alternatives**:
- **全显式参数**(Q5 Option A):侵入性高,每个 procedure + repository 都要改签名,违反 §六 YAGNI
  (为非关键路径提前付代价)。**弃用**。
- **全 ALS**(Q5 Option B):关键路径测试需 mock ALS,易踩坑(request 间 store 串扰)。**弃用**。
- **cls-hooked**:已废弃(Node 8 时代),被内置 AsyncLocalStorage 取代。**弃用**。
- **请求头传递 requestId(客户端生成)**:把 `requestId` 生成责任推给客户端 —— 但客户端重试
  (033 Background Sync)会用同一 requestId,这正是幂等去重的语义,**不能复用**为日志 requestId。
  日志 requestId 必须**服务端每次请求新生成**,与 033 的 `clientRequestId`(业务幂等键)解耦。**弃用**。

**Implementation note**:`getRequestContext()` 返回 `null` 时(如启动脚本、migration、cron),
logger fallback 到 `requestId: null` —— 不抛错,保持 fail-open。

---

## R3 — tRPC 边界集成:middleware(选定) vs pino-http(弃用)

**Decision**:用 **tRPC middleware**(`src/server/api/trpc.ts` 中新增 `timingMiddleware`)记录
每个 procedure 的 start/end/error,而非 `pino-http`。

**Rationale**:
- tRPC 已有自己的中间件链(`t.middleware`),pino-http 是为 Express/Fastify 设计的 HTTP 中间件,
  在 tRPC fetch adapter 下需手动包装 `Request` 对象,反而绕路。
- tRPC middleware 能拿到 `path`(procedure 名)、`type`(query/mutation)、`ctx`、`input`(脱敏后)、
  `error.code`,字段比 pino-http 的 HTTP-level(`req.url` / `req.method`)更精准。
- pino-http 与 AsyncLocalStorage 集成需额外胶水,而 tRPC middleware 与 ALS 同在 `src/server/api/` 层,
  自然共享。

**Alternatives**:
- **pino-http**:重复造轮子(tRPC 已有中间件)。**弃用**。
- **fetchRequestHandler onError only**(现状,仅记错误):无法满足 FR-005(成功也记 info)和
  FR-006(slow warn 需 timing)。**弃用**。
- **Next.js middleware.ts**(edge runtime):跨 tRPC 不感知 procedure 边界,且 edge runtime 下 ALS
  受限(R2)。**弃用**。

**Implementation sketch**:
```ts
// src/server/api/trpc.ts (示意,非最终代码)
export const timingMiddleware = t.middleware(async ({ ctx, path, type, next }) => {
  const start = performance.now();
  const result = await next();
  const durationMs = performance.now() - start;
  const level = isSlow(path, durationMs) ? "warn" : "info";
  logger[level]({ path, type, durationMs, requestId: ctx.requestId, userId: ctx.session?.user.id ?? null },
    level === "warn" ? "slow request" : "request complete");
  return result;
});
```
`isSlow` 查表:`transaction.create → 300ms`、`dashboard.* → 500ms`、其余 `→ Infinity`(不触发)。

---

## R4 — Better-Auth logger 钩子能力验证(FR-014 风险项,已解决)

**Decision**:Better-Auth 1.2.7 **原生支持** `logger: { level, log/error/warn/info/debug }`
配置项,直接实现 spec Q6 Option C 分级转发。

**Evidence**(2026-07-19 联网验证):
- [Better-Auth Options 文档](https://better-auth.com/docs/reference/options):明确列出 `logger.disabled`
  / `logger.level` / `logger.log` / `logger.error` / `logger.warn` / `logger.info` / `logger.debug`。
- [Issue #3250](https://github.com/better-auth/better-auth/issues/3250):确认默认级别为 `error`,
  可通过 `level: "warn" | "info" | "debug"` 下调。

**Rationale**:
- 分级转发(error/warn 进 pino,info/debug 丢弃)直接映射为:
  ```ts
  // src/server/auth/config.ts (示意)
  betterAuth({
    logger: {
      level: "warn", // 仅 warn/error 触发 log 回调
      log: (level, msg) => logger[level]({ source: "better-auth", requestId: getRequestContext()?.requestId }, msg),
    },
    // ...
  })
  ```
- Better-Auth 的 `log(level, msg)` 回调签名让我们能按 `level` 路由到 pino 对应方法,无需在回调内做级别判断。

**Alternatives**:
- **不接管**(Q6 Option A):Better-Auth 自带 console 与 pino 双流,SC-001 按 requestId 检索时跨流
  无法关联。**弃用**。
- **全量转发**(Q6 Option B):session 续期等高频 info 会刷屏,侵蚀 SC-001 信噪比。**弃用**。

**Risk**:Better-Auth `log(level, msg)` 回调内若抛错,可能影响认证流程。**Mitigation**:
回调内 try/catch 吞错(fail-open,FR-010);单测覆盖回调抛错场景。

---

## R5 — Edge runtime 兼容性:本 spec 全程 Node runtime(N/A 风险)

**Decision**:本 spec 不涉及 edge runtime,无需特殊处理。

**Rationale**:
- 本仓 tRPC route(`/api/trpc/[trpc]/route.ts`)用 Node runtime(`fetchRequestHandler` 来自
  `@trpc/server/adapters/fetch`,Next.js 16 默认 Node runtime for API routes)。
- Better-Auth config 在 `src/server/auth/config.ts`,server-only,Node runtime。
- Drizzle 查询用 `pg` driver,Node-only。
- 唯一可能上 edge 的是 Next.js `middleware.ts`(本仓目前无),不属本 spec 范围。

**Alternative**:若未来引入 edge middleware 需日志,**届时**评估 `@vercel/functions` 的
`requestId` 或 edge-compatible logger;**现在不做**(YAGNI)。

---

## R6 — 配置:零新环境变量(选定)

**Decision**:**不引入** `LOG_LEVEL` / `LOG_FORMAT` / `LOG_DESTINATION` 等环境变量。
logger 行为完全由 `NODE_ENV` 推导:

| `NODE_ENV` | level | format | destination |
|---|---|---|---|
| `development` | `debug` | pino-pretty 着色 | `stdout` |
| `production` | `info` | JSON 行 | `stdout` |
| `test` | `silent`(info/debug 静默,error 仍可被测试捕获) | JSON 行(写入内存 stream) | 测试可控 |

**Rationale**:
- 宪章 §六 YAGNI:不为假想的"运维想临时调级别"场景提前加配置面。MVP 流量低,三级固定行为足够。
- T3 stack 已用 `@t3-oss/env-nextjs` 强类型 env(`src/lib/env.ts`),新增变量需改 schema + 文档,
  成本不值。
- 若 plan 后真实出现"prod 临时开 debug 排障"需求,**届时**加 `LOG_LEVEL`(单变量,渐进式)。

**Alternatives**:
- **加 `LOG_LEVEL` env**:看似灵活,实则 99% 时间不用,且增加部署文档负担。**弃用**。
- **加 `LOG_FORMAT=json|pretty` env**:已由 NODE_ENV 推导,冗余。**弃用**。

---

## R7 — 脱敏策略:pino redact paths(选定)

**Decision**:用 pino 内置 `redact: { paths, censor: "[REDACTED]", remove: false }` 配置
全局脱敏路径。

**Rationale**:
- pino 的 `redact` 用 **fast-redat** 库,基于 JSON path(如 `password`、`*.password`、
  `remark`、`amount`、`headers.authorization`),在序列化前移除/替换,O(1) per path。
- `censor: "[REDACTED]"` + `remove: false`:保留 key 占位,便于运维看出"这里被脱敏了"
  (调试友好),SC-003 扫描仍通过(值不泄漏)。

**Paths**(初始集合,见 contracts/log-record.md):
```
[
  "password", "*.password",
  "email", "*.email",
  "headers.authorization", "headers.cookie",
  "secret", "*.secret",
  "amount", "*.amount",
  "remark", "*.remark",
  "clientRequestId"  // 业务幂等键除外(spec FR-004 明确允许),但其它 client-supplied 字段需脱敏
]
```

**注意**:`clientRequestId` **不**进 redact(spec US3 `idempotency.hit` 事件需要它)。
spec FR-004 的"`clientRequestId` 之外的用户输入原文"指**其它**用户输入字段(`remark`、`name` 等),
这些进 redact。

**Alternatives**:
- **手写 redact 函数**:每次 `logger.info(sanitize(obj))` —— 易漏调用。**弃用**。
- **自包装 logger 代理拦截所有调用**:复杂度高,且 pino redact 已覆盖。**弃用**。
- **序列化后正则替换**:破坏 JSON 结构(替换后可能产生非法 JSON)。**弃用**。

**Test**:R8 测试矩阵中 `serializer.test.ts` 必须覆盖:含 `password`/`remark`/`amount` 的对象
→ 输出含 `[REDACTED]` 且原值不出现。

---

## R8 — 测试矩阵(选定)

**Decision**:按宪章 §四(测试优先)三层覆盖,先红后绿:

| 层 | 文件 | 覆盖 FR/SC | 关键断言 |
|---|---|---|---|
| unit | `src/tests/unit/server/logger/serializer.test.ts` | FR-004 / FR-013 / SC-003 | redact paths 生效;含 `\n`/`}` 的 remark 输出仍是单条合法 JSON 行 |
| unit | `src/tests/unit/server/logger/levels.test.ts` | FR-002 / FR-011 | NODE_ENV=test 时 info/debug 不写 destination;error 仍写 |
| unit | `src/tests/unit/server/logger/request-context.test.ts` | FR-001 / Q5 | ALS 跨 `await` 保持 requestId;并发请求 store 不串 |
| unit | `src/tests/unit/server/logger/slow-threshold.test.ts` | FR-006 | `transaction.create` 301ms → warn;299ms → info;`dashboard.x` 501ms → warn |
| procedure | `src/tests/procedure/transaction.test.ts`(扩展) | FR-001 / FR-005 / FR-008 | create 成功记 info 含 requestId;create 失败记 error 含 code;幂等命中记 `idempotency.hit` |
| procedure | `src/tests/procedure/auth.test.ts`(扩展) | FR-008 / FR-014 | signIn 锁定触发记 `auth.lockout_triggered` warn;Better-Auth log 回调被调用 |
| integration | `src/tests/integration/transaction/drizzle-error.test.ts`(新) | FR-007 / SC-005 | 真实 PG 断连/违规 → 日志含 `code`(SQL state) + requestId |
| integration | `src/tests/integration/authz/cross-family.test.ts`(新) | FR-008 / SC-005 | 用户 A 访问 family B 资源 → `authz.cross_family_attempt` warn |

**Rationale**:
- unit 测覆盖纯逻辑(序列化/级别/ALS),快、无 DB。
- procedure 测用 `createCaller`,断言日志 destination stream(注入内存 `Writable`),无需读 stdout。
- integration 测用 testcontainers 真实 PG(宪章 §四硬要求,禁 mock DB)。

**Test isolation**:
- 注入 pino 的 destination:测试用 `pino({ ..., stream: sink })` where `sink` 是 `Writable` 内存
  实现(可用 `pino/symbols` 或第三方 `split2` 解析行)。production/dev 用 `process.stdout`。
- ALS:test 间 `requestContext.enterWith(newStore)` 显式重置,或用 `AsyncLocalStorage` 自身的
  async scope 隔离(每 test 在独立 async 上下文)。

**Alternatives**:
- **读 stdout 断言**:跨平台行缓冲差异,flaky。**弃用**。
- **mock pino**:违反"测真实行为"原则,且 pino 的序列化/脱敏是核心被测对象。**弃用**。

---

## 同步影响报告(Sync Impact Report)

**版本变更**:无(spec/clarify 阶段未触发宪章修订;本 plan 也不需宪章修订)。
**原则修改**:无。
**新增章节**:无。
**删除章节**:无。
**技术栈章节修改**:无(pino 是工具库,非"栈"层级;宪章技术栈表是框架级,工具库选型属 plan 范畴)。
**修订动机**: N/A(无宪章变更)。
**迁移影响**:
- 新增依赖:`pino@^9`(dependencies)、`pino-pretty@^11`(devDependencies)。
- 改动文件:见 plan.md Project Structure 节(约 10 个文件,零 DB migration)。
- 兼容性:100% 向后兼容(日志是新增能力,不改任何 procedure 的输入/输出契约;关键路径显式
  `requestId` 是内部参数,客户端无感)。
**待更新模板**:无。
**遗留 TODO**:无。

## 参考来源

- [Pino GitHub](https://github.com/pinojs/pino)
- [Dash0 — Top 7 Node.js Logging Libraries](https://www.dash0.com/guides/nodejs-logging-libraries)
- [PkgPulse — Best Node.js Logging Libraries 2026](https://www.pkgpulse.com/guides/best-nodejs-logging-libraries-2026)
- [StackOverflow — How is Pino faster](https://stackoverflow.com/questions/74623140/how-pino-is-faster-than-other-library)
- [Better Stack — Pino vs Winston](https://betterstack.com/community/guides/scaling-nodejs/pino-vs-winston/)
- [Better-Auth Options 文档](https://better-auth.com/docs/reference/options)
- [Better-Auth Issue #3250 — Logger behavior](https://github.com/better-auth/better-auth/issues/3250)
- [Node.js AsyncLocalStorage 文档](https://nodejs.org/api/async_context.html)
