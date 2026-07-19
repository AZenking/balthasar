# 可观测日志 (Observability)

> **Spec**: [`specs/034-observability-logging/`](../specs/034-observability-logging/) — 完整 WHAT/WHY/HOW。
> **Contract**: [`specs/034-observability-logging/contracts/log-record.md`](../specs/034-observability-logging/contracts/log-record.md) — JSON 行协议契约(运维侧稳定接口)。

## 概述

服务端结构化日志,基于 **pino**(research.md R1:比 winston 快 5-8x,异步序列化满足 SC-004 ≤5% p95 预算)。日志写 `stdout`/`stderr`,由 Docker logging driver 收集(本仓不自建落盘/远程聚合 —— YAGNI)。

## 三环境行为(由 NODE_ENV 推导,零 env 变量)

| `NODE_ENV` | level | 格式 | 输出 |
|---|---|---|---|
| `development` | `debug` | pino-pretty 着色(多行) | `stdout` |
| `production`  | `info`  | JSON 行(单行/记录) | `stdout` |
| `test`        | `silent for info/debug`(error 仍发) | JSON 行 | 测试可控内存 stream |

## 运维检索示例

```bash
# 按 requestId 关联一次请求的完整日志链(US1 SC-001)
docker logs balthasar 2>&1 | jq -c 'select(.requestId=="<id>")'

# 看 transaction.create 的 p95 耗时分布(US2 SC-002)
docker logs balthasar --since 10m 2>&1 \
  | jq -c 'select(.path=="transaction.create" and .level!="error") | .durationMs' \
  | sort -n | awk 'BEGIN{c=0} {a[c++]=$1} END{print "p95:", a[int(c*0.95)]}'

# 查所有慢请求(FR-006 自动升 warn)
docker logs balthasar 2>&1 | jq -c 'select(.msg=="slow request")'

# 查 5 类业务/安全事件(US3)
docker logs balthasar 2>&1 | jq -c 'select(.event?)'

# 查 Drizzle 异常(含 SQLSTATE,FR-007)
docker logs balthasar 2>&1 | jq -c 'select(.sqlState?)'

# 查 Better-Auth 转发的 warn/error(FR-014)
docker logs balthasar 2>&1 | jq -c 'select(.source=="better-auth")'
```

## 字段速查(完整定义见 contract)

每条日志行包含以下字段(必填 5 个 + 可选若干):

- **必填**:`time`(ISO8601 UTC)、`level`、`msg`、`requestId`(null 表示非请求上下文)、`userId`(null 表示未登录)
- **请求级**:`path`(tRPC procedure 名)、`type`(query/mutation)、`durationMs`、`code`(失败时 tRPC error code)、`source`(`trpc`/`better-auth`/`domain`)
- **事件级**:`event`(5 类业务事件名,见下)、`sqlState`(DB 异常 SQLSTATE)、`dbSource`(`drizzle`)、`retryAfterSeconds`(锁定时)、`clientRequestId`(幂等命中时)

### Event 枚举(FR-008)

| event | level | 触发场景 |
|---|---|---|
| `auth.lockout_triggered` | warn | FR-009 锁定生效 |
| `auth.rate_limited` | warn | 注册门关闭 / 限流 |
| `auth.first_user_bypass` | info | 首用户绕过 `ALLOW_REGISTRATION` |
| `authz.cross_family_attempt` | warn | 跨 family 越权访问 |
| `idempotency.hit` | info | 033 `clientRequestId` 幂等去重命中 |

## 脱敏保证(SC-003)

以下字段绝不入日志(pino `redact` 在序列化前替换为 `[REDACTED]`):

`password` / `email` / `headers.authorization` / `headers.cookie` / `secret` / `amount` / `remark` (含 `*.password` 等嵌套形式)

**允许**入日志(已论证非敏感):`userId`(uuid,聚合用)、`requestId`/`clientRequestId`(uuid)、`code`/`event`/`sqlState`/`path` 等。

### 自动扫描脚本(SC-003 验证)

```bash
# 扫描日志样本,敏感字段值若非 [REDACTED] 即报错
docker logs balthasar --since 1h 2>&1 | ./scripts/scan-logs-for-secrets.sh
```

接入 CI:staging 日志按周期通过此脚本断言 exit 0。

## 故障排查

| 症状 | 排查 |
|---|---|
| 日志无 `requestId` | 检查 `src/app/api/trpc/[trpc]/route.ts` 是否调用了 `startRequestContext` |
| 日志含明文密码 | `src/lib/logger.ts` 的 redact paths 是否配齐;新增敏感字段时同步更新 |
| 单条日志跨多行 | 反查代码 `logger.\w+(\`.*\$\{` —— FR-013 禁止 msg 拼接用户输入 |
| Better-Auth 日志双流 | `src/server/auth/config.ts` 的 `logger` 钩子是否接管(FR-014) |
| 日志拖慢请求 > 5% | profile;pino 默认异步,误用同步 destination 会回退 |

## 架构要点

- **requestId 传播**(research.md R2):`AsyncLocalStorage` 边界自动注入 + 关键路径(transaction.create / auth.* / dashboard)显式参数。
- **timingMiddleware**(`src/server/api/trpc.ts`):全局挂在 `publicProcedure`/`protectedProcedure`,每个 procedure 调用记一条 info/warn/error。
- **Better-Auth logger 接管**(`src/server/auth/config.ts`):`level:"warn"` + `log(level, msg)` 回调,分级转发到 pino(FR-014)。
- **Drizzle sqlState 提取**(`src/server/api/trpc.ts`):timingMiddleware 失败分支从 `result.error.cause.code` 读 PG SQLSTATE(FR-007)。
