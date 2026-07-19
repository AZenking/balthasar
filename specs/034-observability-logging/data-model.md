# Data Model: 服务端可观测日志

**Feature**: 034-observability-logging
**Date**: 2026-07-19
**Status**: Phase 1

> **本 spec 零 DB schema 变更**(见 plan.md Technical Context — Storage: N/A)。
> 本文件描述的是**逻辑实体**(runtime-only,不入库),用于约束 logger 输出契约。

---

## 实体 1:LogRecord(逻辑实体,不入库)

一条 JSON 行日志记录。由 pino 序列化后写入 `stdout`。

### 字段

| 字段 | 类型 | 必填 | 来源 | 说明 |
|---|---|---|---|---|
| `time` | `string`(ISO8601 UTC) | ✅ | pino 自动 | 形如 `2026-07-19T08:30:00.000Z`;pino 默认 `time` 是 epoch ms,需配 `timestamp: () => \`,\"time\":\"${new Date().toISOString()}\"\`` 改 ISO8601(spec FR-003 要求) |
| `level` | `"error" \| "warn" \| "info" \| "debug"` | ✅ | 调用方 | pino 内部用数字(10/20/30/40/50/60),输出 JSON 时配 `formatters.level: name => ({ level: pino.levels.labels[name] })` 转标签 |
| `msg` | `string` | ✅ | 调用方 | 人类可读消息。**禁止**含用户可控字符串拼接(spec FR-013) |
| `requestId` | `string \| null` | ✅ | AsyncLocalStorage / 显式参数 | UUID v4。请求边界生成;非请求上下文(启动、cron)为 `null`(spec FR-001/Q5) |
| `userId` | `string \| null` | ✅ | ctx.session | 已登录则 uuid,否则 `null`。**允许**入日志(用于聚合,uuid 不可逆推身份)(spec FR-004) |
| `path` | `string` | ❌ | tRPC middleware | tRPC procedure 路径,如 `transaction.create`、`auth.signIn`。仅请求级日志填 |
| `type` | `"query" \| "mutation" \| "subscription"` | ❌ | tRPC middleware | procedure 类型,辅助聚合 |
| `durationMs` | `number` | ❌ | tRPC middleware | 请求/查询耗时。仅请求级日志填(spec FR-006 slow 判定依据) |
| `code` | `string` | ❌ | tRPC error | tRPC error code(`BAD_REQUEST` / `UNAUTHORIZED` / `NOT_FOUND` / `INTERNAL_SERVER_ERROR` / `CONFLICT` / `TOO_MANY_REQUESTS`),失败时填 |
| `event` | `EventName`(见下) | ❌ | 业务调用方 | 业务/安全事件名(spec FR-008)。仅事件级日志填 |
| `source` | `"trpc" \| "better-auth" \| "drizzle" \| "domain"` | ❌ | 调用方约定 | 日志产生层,便于过滤 Better-Auth 转发日志 vs 原生日志 |
| `sqlState` | `string` | ❌ | Drizzle 异常 | PostgreSQL SQLSTATE(如 `23505` unique violation、`23503` FK violation、`08006` connection failure)。仅 DB 异常日志填(spec FR-007) |
| `retryAfterSeconds` | `number` | ❌ | auth lockout | 锁定剩余秒数。仅 `auth.lockout_triggered` 事件填 |

### EventName 枚举(spec FR-008)

```typescript
type EventName =
  | "auth.lockout_triggered"        // warn, FR-009 锁定生效
  | "auth.rate_limited"             // warn, FR-018 注册限流
  | "auth.first_user_bypass"        // info, ALLOW_REGISTRATION=false 首用户绕过
  | "authz.cross_family_attempt"    // warn, 跨 family 越权
  | "idempotency.hit";              // info, 033 幂等去重命中
```

新增事件须经 spec 修订(本 spec 不开放任意字符串,防 event 字段污染)。

### Validation Rules

- **必填字段缺失**:pino 调用方必须传 `requestId`(可 `null`),不传视为代码 bug —— 单测覆盖。
- **`level` 与 `code` 关联**:有 `code` 的记录 `level` 必须为 `error` 或 `warn`(slow + 成功 = warn,
  失败 = error);info/debug 级不应携带 `code`。
- **`event` 与 `level` 关联**(spec FR-008):
  - `auth.lockout_triggered` / `auth.rate_limited` / `authz.cross_family_attempt` → `warn`
  - `auth.first_user_bypass` / `idempotency.hit` → `info`
- **脱敏字段**(spec FR-004,见 research.md R7):以下字段**绝不**出现在任何 LogRecord 中,
  由 pino `redact` 在序列化前移除:
  - `password` / `*.password`
  - `email` / `*.email`(注:`userId` 是 uuid 不是 email,允许)
  - `headers.authorization` / `headers.cookie`
  - `secret` / `*.secret`(含 `BETTER_AUTH_SECRET`、API key 明文)
  - `amount` / `*.amount`(交易金额)
  - `remark` / `*.remark`(交易备注)
- **注入防御**(spec FR-013):用户可控字符串(`remark`、`path` 段、错误回显输入)必须作为
  结构化字段传 logger(非 `msg` 拼接);pino 序列化器自动转义 `\n` / 控制字符 / 引号。
- **单行约束**:每条 LogRecord 序列化后**必须**是单行合法 JSON(无中间换行)。

### State Transitions

LogRecord 是无状态的一次性事件,**无生命周期**(写入即终态)。

---

## 实体 2:RequestContext(runtime 上下文,不入库)

通过 `AsyncLocalStorage` 在单个请求的生命周期内传递(research.md R2)。

### 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `requestId` | `string` | ✅ | UUID v4,请求边界生成 |
| `userId` | `string \| null` | ✅ | 初始 `null`,session 解析后填充 |

### 接口

```typescript
// src/lib/request-context.ts (示意,非最终代码)
import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
  userId: string | null;
}

const als = new AsyncLocalStorage<RequestContext>();

export function startRequestContext(requestId: string, run: () => Promise<void>): Promise<void> {
  return als.run({ requestId, userId: null }, run);
}

export function getRequestContext(): RequestContext | null {
  return als.getStore() ?? null;
}

export function setUserId(userId: string): void {
  const store = als.getStore();
  if (store) store.userId = userId;
}
```

### Validation Rules

- `requestId` 必须是合法 UUID v4(用 `uuid` 包,本仓已装 `uuid@^11`)。
- `getRequestContext()` 在请求上下文外(启动、cron、migration)返回 `null`,logger 回退到
  `requestId: null`(fail-open,research.md R2)。
- 并发请求间 store 隔离:Node ALS 按异步执行上下文天然隔离,但实现需保证 `enterWith` /
  `run` 在请求边界正确 enter/exit(测试覆盖:research.md R8 `request-context.test.ts`)。

### State Transitions

```
[请求开始]
  → startRequestContext(requestId, userId=null)
  → [session 解析成功]
    → setUserId(user.id)
  → [procedure 执行 / Drizzle 查询 / Better-Auth log 回调]
    → getRequestContext() 取出 requestId/userId
  → [请求结束]
    → ALS scope 自动 exit
```

---

## 与现有实体的关系

- **不新增 DB 表**。LogRecord 是 `stdout` 行,不入任何表。
- **不修改 `auth_events` 表**(现有审计表,见 `src/server/auth/hooks/audit.ts`):
  `auth_events` 承担**持久化审计**(FR-016,DB 查询用),LogRecord 承担**运维观测**(`stdout`
  检索用)。两者**互补不重叠** —— 例如 `login_failure` 既写 `auth_events`(供后台审计 UI 查询),
  也记一条 LogRecord(供运维 grep)。这是有意设计:审计表是结构化业务数据,日志是运维信号,
  混淆会让两者都难用。
- **不修改 `transactions` / `accounts` 等业务表**:零 migration。
- **`clientRequestId`(033 幂等键)与日志 `requestId` 解耦**(research.md R2):
  - `clientRequestId`:客户端生成,跨重试稳定,业务幂等键,**入库**(`transactions.client_request_id`)。
  - `requestId`(本 spec):服务端每次请求新生成,日志关联键,**不入库**。
  - 033 的 `idempotency.hit` 事件日志会同时携带两者:`{ requestId, event:"idempotency.hit", clientRequestId }`。

---

## 生命周期与保留

- LogRecord **无入库生命周期**,保留策略由部署层(Docker logging driver / Vercel 函数日志)决定。
- 本 spec 不规定保留天数(spec Assumptions)。
- RequestContext 生命周期 = 单 HTTP 请求生命周期(请求结束即 GC)。
