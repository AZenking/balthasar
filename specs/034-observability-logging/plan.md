# Implementation Plan: 服务端可观测日志

**Branch**: `034-observability-logging` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/034-observability-logging/spec.md`

## Summary

为生产环境补齐**结构化日志基础设施**:在 tRPC 请求边界生成 `requestId` 并通过 `AsyncLocalStorage`
跨层传播(关键路径同时显式参数),用 **pino** 输出 JSON 行(生产)/ 着色(开发)/ 静默(测试),
对慢请求自动升 warn、对 Drizzle 异常记 SQL state、对 Better-Auth `error/warn` 分级转发,并对
密码/邮箱/token/金额/备注做字段脱敏 + 用户输入强制结构化(防日志注入)。日志走 `stdout`,
由 Docker 日志层收集(不自建落盘)。宪章 §五 p95(300ms/500ms)首次获得可度量手段。

## Technical Context

**Language/Version**: TypeScript 5.7 + Node.js ≥ 20(见 `package.json` engines;Next.js 16 App Router)。

**Primary Dependencies**:
- 新增:**pino**(生产 logger 主选,见 research.md R1)+ **pino-pretty**(仅 dev 依赖,着色输出)。
- 新增:**pino-http** *(评估后弃用,见 R3 — tRPC 已有自身中间件链,引入 pino-http 会重复)*。
- 既有(沿用):`@trpc/server`(onError / middleware 钩子)、`better-auth`(1.2.7,暴露 `logger.log/error/warn/info/debug` 钩子 — R4 已验证)、`drizzle-orm`(查询异常捕获点)、`next`(App Router `fetchRequestHandler` 边界)。
- 既有(内置,无需新增依赖):Node `async_hooks.AsyncLocalStorage`(requestId 跨层传播,R2)。

**Storage**: **N/A**(不入库)。日志仅写 `stdout`/`stderr`,由 Docker logging driver 收集(见 Assumptions)。
DB schema **零变更** —— 本 spec 不引入 `log_events` 表(宪章 §六 YAGNI;审计已有 `auth_events` 表
承担持久化审计需求,见 `src/server/auth/hooks/audit.ts`)。

**Testing**: Vitest(已有三 project:unit / procedure / integration,见 `vitest.config.ts`)。
- **unit**:`src/tests/unit/server/logger/*.test.ts` —— 序列化、脱敏、级别路由、AsyncLocalStorage 隔离。
- **procedure**:`src/tests/procedure/*.test.ts` 扩展 —— 关键路径(transaction.create / auth)断言日志输出含 `requestId`。
- **integration**:`src/tests/integration/transaction/*.test.ts` 扩展 —— 真实 PG 触发 Drizzle 异常,断言 SQL state 入日志。
- 测试通过捕获 `pino` destination(内存 stream)而非读 stdout —— 可断言且不污染控制台。

**Target Platform**: Node.js ≥ 20 / Linux 容器(Docker,见 `docker-compose.yml`)+ Vercel 兼容(Next.js 16
edge 注意点见 R5:AsyncLocalStorage 在 Node runtime 工作,本 spec 全程用 Node runtime,无 edge 风险)。

**Project Type**: web-service(Next.js 全栈 + tRPC,宪章 §二 Feature-Sliced)。

**Performance Goals**:
- 宪章 §五:`transaction.create` p95 < 300ms、Dashboard query p95 < 500ms —— 本 spec 的**可度量性**目标(SC-002)。
- SC-004:日志本身额外开销 ≤ **5%** p95 预算(即 ≤ 15ms / ≤ 25ms)—— 直接驱动 pino 异步序列化选型(R1)。

**Constraints**:
- 零 DB schema 变更(无 migration)。
- 零新环境变量(logger 行为由 `NODE_ENV` 推导;不引入 `LOG_LEVEL` 等 — YAGNI,见 R6)。
- fail-open(FR-010):日志写入失败不得拖垮业务请求。
- 字段脱敏零泄漏(SC-003):1000 条样本扫描通过。

**Scale/Scope**:
- 单家庭单进程 MVP,无并发压力测试目标。
- 接入点:tRPC 边界(1 处 `route.ts` + `trpc.ts` middleware)+ Better-Auth(1 处 config)+ 关键路径
  procedure(约 5 个:`transaction.create` / `auth.signIn` / `auth.signUp` / `dashboard.getMonthSummary` /
  Drizzle 全局错误包装)。
- 不接入:前端、静态资源、健康检查、分布式 tracing(见 spec Assumptions)。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

逐条核对 `.specify/memory/constitution.md` v3.2.1:

| 原则 | 状态 | 说明 |
|---|---|---|
| §一 MVP 范围 | ✅ 通过 | 可观测日志是既有 MVP 功能(记账/认证/审计,FR-016/FR-009)的横切支撑,非范围外能力。无新表、无新 RPC 业务功能。 |
| §二 Feature-Sliced (tRPC + Next.js) | ✅ 通过 | logger 作为 `src/lib/logger.ts` 共享工具(与 `src/lib/env.ts` / `src/lib/utils.ts` 同层),非 cross-feature 抽象。AsyncLocalStorage 注入点在 `src/server/api/trpc.ts` createContext/middleware(基础设施层,与现有 session 注入同级)。 |
| §三 领域驱动(Family 聚合) | ✅ 通过 | 不触碰聚合边界。`requestId` 是请求级临时态(不入库,不跨聚合)。 |
| §四 测试优先 | ✅ 通过 | R8 给出测试矩阵:unit(序列化/脱敏/级别)+ procedure(requestId 关联)+ integration(Drizzle 异常 SQL state)。先红后绿。 |
| §五 性能与极速录入 | ✅ 通过(直接受益) | 本 spec **首次**为 §五 p95 提供可度量手段(SC-002)。日志本身开销被 SC-004(≤5% p95)约束,pino 异步序列化(R1)保证不违反。慢请求自动 warn(FR-006)直接服务 §五 监控。 |
| §六 简单(YAGNI) | ✅ 通过 | 显式排除:分布式 tracing(OpenTelemetry)、文件/syslog/loki 客户端、日志保留策略、采样抽样、`LOG_LEVEL` 环境变量(R6)。库选型 pino 是单依赖最小解(R1)。 |
| §七 UI 调整纪律 | ✅ 通过(N/A) | 本 spec 不触 UI(`src/components/**`、`src/app/**` 中 JSX/className),不触发 /heroui-react。 |

**Gate 结论**:零违反,无需 Complexity Tracking 表项。

## Project Structure

### Documentation (this feature)

```text
specs/034-observability-logging/
├── plan.md              # 本文件
├── research.md          # Phase 0:R1-R8 决策与替代方案
├── data-model.md        # Phase 1:LogRecord 逻辑实体(requestId/event 枚举)
├── quickstart.md        # Phase 1:可运行验证场景
├── contracts/
│   └── log-record.md    # Phase 1:JSON 行日志协议契约(SC-001/SC-003 依赖)
├── checklists/
│   └── requirements.md  # specify/clarify 阶段已生成
└── tasks.md             # /speckit-tasks 生成(本 plan 不产)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── logger.ts                  # 【新】pino 实例 + 环境切换 + 脱敏 + slow 阈值
│   ├── request-context.ts         # 【新】AsyncLocalStorage<{requestId,userId}> 封装
│   └── env.ts                     # 【无改】沿用 NODE_ENV 推导 logger 行为
├── server/
│   ├── api/
│   │   ├── trpc.ts                # 【改】createContext 生成 requestId + ALS enter;
│   │   │                          #       新增 timingMiddleware(slow warn, FR-006)
│   │   ├── root.ts                # 【无改】
│   │   └── routers/
│   │       ├── transaction.ts     # 【改】create procedure 显式 requestId(FR-001/Q5)
│   │       ├── auth.ts            # 【改】signIn/signUp 显式 requestId + lockout warn
│   │       └── dashboard.ts       # 【改】getMonthSummary 显式 requestId
│   ├── auth/config.ts             # 【改】betterAuth({ logger: 分级转发 }) (FR-014)
│   └── db/
│       └── client.ts              # 【改】Drizzle 包装层捕获异常记 SQL state (FR-007)
└── app/
    └── api/trpc/[trpc]/route.ts   # 【改】onError 走 logger(替换 dev-only console.error)

src/tests/
├── unit/server/logger/
│   ├── serializer.test.ts         # 【新】R7:脱敏 + 注入防御
│   ├── levels.test.ts             # 【新】级别路由 + 测试静默
│   └── request-context.test.ts    # 【新】ALS 跨异步隔离
├── procedure/
│   ├── transaction.test.ts        # 【改】断言 requestId 关联日志
│   └── auth.test.ts               # 【改】断言 lockout warn 事件
└── integration/transaction/
    └── drizzle-error.test.ts      # 【新】真实 PG 异常 → SQL state 入日志
```

**Structure Decision**:沿用宪章 §二 Feature-Sliced 单仓结构。logger 入 `src/lib/`(共享基础设施层,
与 `env.ts` 同级,符合既有约定)。AsyncLocalStorage 封装入 `src/lib/request-context.ts`(独立文件,
便于测试 import)。procedure 改动仅在关键路径(Q5 决策),非全量签名变更。零新目录、零新 feature slice。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**无违反项。表为空。**
