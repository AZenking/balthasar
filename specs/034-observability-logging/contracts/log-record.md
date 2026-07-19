# Contract: LogRecord(JSON 行日志协议)

**Feature**: 034-observability-logging
**Date**: 2026-07-19
**Status**: Phase 1 — Stable

> 这是**对外协议契约**(spec clarification 已论证:JSON 行格式是协议级而非实现级,因为它定义了
> 日志消费者——运维、Docker 收集层、未来 ELK——能依赖的稳定接口)。变更须经 spec 修订。

## 协议概述

- **传输**:`stdout`(每条日志一行,`\n` 分隔)。
- **格式**:每行一条合法 JSON 对象,UTF-8 编码。
- **方向**:服务端 → stdout →(Docker logging driver / Vercel 函数日志层)→ 运维检索。
- **消费者**:运维(`jq` / `docker logs` / `grep`)、未来日志聚合层(loki/elk,本 spec 不引入)。

## 字段契约

完整字段定义见 [data-model.md](../data-model.md#实体-1logrecord逻辑实体不入库)。
本契约冻结以下**必填**字段(缺失视为生产 bug):

| 字段 | 类型 | 必填 | 示例 |
|---|---|---|---|
| `time` | string ISO8601 UTC | ✅ | `"2026-07-19T08:30:00.123Z"` |
| `level` | enum | ✅ | `"info"` |
| `msg` | string | ✅ | `"request complete"` |
| `requestId` | string UUID v4 \| null | ✅ | `"a1b2c3d4-..."` 或 `null` |
| `userId` | string UUID \| null | ✅ | `"user-uuid-..."` 或 `null` |

**可选**字段(`path` / `type` / `durationMs` / `code` / `event` / `source` / `sqlState` /
`retryAfterSeconds`):仅在 applicable 时出现,消费者需对缺失字段做容错(非 null-safe 假设)。

## 示例行

### 1. 正常请求(info)

```json
{"time":"2026-07-19T08:30:00.123Z","level":"info","msg":"request complete","requestId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","userId":"u-001-...","path":"transaction.create","type":"mutation","durationMs":187,"source":"trpc"}
```

### 2. 慢请求(warn,触发 FR-006)

```json
{"time":"2026-07-19T08:30:01.000Z","level":"warn","msg":"slow request","requestId":"b2c3d4e5-...","userId":"u-001-...","path":"transaction.create","type":"mutation","durationMs":345,"source":"trpc"}
```

### 3. 失败请求(error)

```json
{"time":"2026-07-19T08:30:02.000Z","level":"error","msg":"request failed","requestId":"c3d4e5f6-...","userId":"u-001-...","path":"transaction.create","type":"mutation","durationMs":12,"code":"BAD_REQUEST","source":"trpc"}
```

### 4. 业务事件(idempotency.hit,依赖 033)

```json
{"time":"2026-07-19T08:30:03.000Z","level":"info","msg":"idempotency hit","requestId":"d4e5f6g7-...","userId":"u-001-...","event":"idempotency.hit","clientRequestId":"client-uuid-stable","path":"transaction.create","source":"trpc"}
```

注:`clientRequestId`(业务幂等键)是**唯一允许**入日志的客户端输入字段(spec FR-004 例外),
因为它本身是 uuid,无敏感信息,且运维需用它关联 033 的去重诊断。

### 5. 安全事件(lockout)

```json
{"time":"2026-07-19T08:30:04.000Z","level":"warn","msg":"lockout triggered","requestId":"e5f6g7h8-...","userId":null,"event":"auth.lockout_triggered","retryAfterSeconds":900,"path":"auth.signIn","source":"trpc"}
```

### 6. DB 异常(error,Drizzle 转发 — sqlState 提取自 TRPCError.cause)

```json
{"time":"2026-07-19T08:30:05.000Z","level":"error","msg":"request failed","requestId":"f6g7h8i9-...","userId":"u-001-...","path":"transaction.create","type":"mutation","durationMs":12,"code":"INTERNAL_SERVER_ERROR","source":"trpc","sqlState":"23505","dbSource":"drizzle"}
```

注:DB 异常由 timingMiddleware 在 tRPC 边界统一捕获(`result.error.cause.code`
即 PG SQLSTATE)。`source` 仍是 `"trpc"`(发出日志的边界),`sqlState` +
`dbSource: "drizzle"` 标记底层来源。

### 7. Better-Auth 转发(warn)

```json
{"time":"2026-07-19T08:30:06.000Z","level":"warn","msg":"session verification failed","requestId":"g7h8i9j0-...","userId":null,"source":"better-auth"}
```

## 脱敏契约(零泄漏保证)

以下字段**绝不**出现在任何 LogRecord 中(由 pino `redact` 在序列化前移除,值替换为 `[REDACTED]`):

| 字段 path | 原因 |
|---|---|
| `password`, `*.password` | 凭证 |
| `email`, `*.email` | PII |
| `headers.authorization`, `headers.cookie` | 凭证 |
| `secret`, `*.secret` | 凭证(含 `BETTER_AUTH_SECRET`) |
| `amount`, `*.amount` | 财务敏感 |
| `remark`, `*.remark` | 用户隐私备注 |

**允许**入日志的字段(已论证非敏感):
- `userId`(uuid,聚合用,不可逆推身份)
- `requestId`(服务端 uuid,无业务语义)
- `clientRequestId`(033 客户端 uuid,幂等键,无敏感)
- `path` / `event` / `code` / `sqlState` / `source` / `level` / `time` / `durationMs` /
  `type` / `retryAfterSeconds`(均无用户数据)

**验证**:SC-003 要求"1000 条生产日志行经自动敏感字段扫描,均不含上述字段"。tasks.md 会
落一个自动化扫描脚本(扫 `grep -E '"(password\|email\|amount\|remark\|secret)"\s*:'` 在
生产日志样本上)。

## 注入防御契约(单行完整性)

- 任何用户可控字符串(含 `remark`、客户端传入的 `path` 段、错误消息回显)**必须**作为结构化
  字段传给 logger,由 pino 序列化器转义。
- **禁止**写法:`logger.info(\`transaction ${userRemark} created\`)`(msg 拼接用户输入)。
- **允许**写法:`logger.info({ path, requestId }, "transaction created")`(结构化字段)。
- 验证:测试构造含 `\n{"level":"info","msg":"fake"\n` 的 remark,断言输出仍是**单条**合法 JSON 行。

## 消费者契约(运维侧)

运维可依赖的稳定保证:
1. **每行一条 JSON**:可用 `jq` 行模式解析(`jq -c '.'` / `docker logs balthasar \| jq -c .`)。
2. **`requestId` 关联**:同一请求的所有日志(边界 + 领域 + DB + Better-Auth)共享同一 `requestId`,
   `docker logs balthasar \| jq -c 'select(.requestId=="<id>")'` 可取完整链路(SC-001)。
3. **`time` 是 UTC ISO8601**:跨时区一致,显示层自行转本地。
4. **`level` 是字符串标签**:不是数字(pino 默认数字,本契约配置 `formatters.level` 转)。
5. **可选字段缺失**:消费者必须对缺失的 `code`/`event`/`sqlState` 等做容错。

## 向后兼容

- 本契约是**首版**(v1),无前序版本。
- 未来变更(新增字段、调整枚举)须经 spec 修订,且:
  - 新增字段:**minor**,消费者容错即可。
  - 删除/重命名字段:**major**,需提前通知消费者(运维脚本依赖)。
  - `level` 标签集变更:**major**。
- 本 spec 不承诺日志保留时长(由部署层决定)。
