# Quickstart: 服务端可观测日志

**Feature**: 034-observability-logging
**Date**: 2026-07-19
**Status**: Phase 1

本文件是**可运行验证指南**:如何在本地/CI 端到端验证本 spec 的 6 个 SC 和关键 FR。
**不含**完整实现代码(那在 tasks.md);**含**可复制粘贴的命令与期望输出。

---

## 前置条件

- 本仓已 `pnpm install`(或 `npm install`),依赖含 `pino@^9` + `pino-pretty@^11`(dev)。
- 本仓已按宪章 §四配好 Vitest 三 project(unit / procedure / integration)。
- Docker 可用(integration 测用 testcontainers 起真实 PG)。
- `.env` / `.env.local` 已按 `src/lib/env.ts` schema 配齐(DB / Better-Auth 密钥)。

---

## 场景 1 — 生产 JSON 行格式 + requestId 关联(SC-001 / FR-001 / FR-002)

**目标**:验证生产环境输出结构化 JSON 行,且同一请求的边界 + 领域日志共享 `requestId`。

**步骤**:

```bash
# 1. 以生产模式启动(模拟)
NODE_ENV=production pnpm build && NODE_ENV=production pnpm start

# 2. 在另一终端发起一次成功的 transaction.create(需先登录拿 cookie)
curl -X POST http://localhost:3000/api/trpc/transaction.create \
  -H 'Content-Type: application/json' \
  -H 'Cookie: balthasar.session_token=<your-session>' \
  -d '{"0":{"json":{"type":"expense","amount":1000,"accountId":"...","categoryId":"...","remark":"午餐","occurredAt":"2026-07-19T08:00:00Z"}}}'

# 3. 在 docker logs / 进程 stdout 中按 requestId 检索该次请求的所有日志
docker logs balthasar 2>&1 | jq -c 'select(.path=="transaction.create")' | tail -5
```

**期望**:
- 输出每行一条合法 JSON,含 `time`(ISO8601 UTC)、`level: "info"`、`msg`、`requestId`、`userId`、
  `path: "transaction.create"`、`type: "mutation"`、`durationMs`、`source: "trpc"`。
- 同一 `requestId` 下至少有 1 条 `source: "trpc"` 的记录(若有领域层日志,还会有 `source: "domain"`)。
- **不出现** `remark` 原文(应被 `[REDACTED]` 替换或不记)。

---

## 场景 2 — 慢请求自动 warn(FR-006 / SC-002)

**目标**:验证超过宪章 §五阈值的请求自动升级为 warn,可聚合算 p95。

**步骤**:

```bash
# 用 jq 从一段时间窗口的日志聚合 transaction.create 的 p95
docker logs balthasar --since 10m 2>&1 \
  | jq -c 'select(.path=="transaction.create" and .level!="error") | .durationMs' \
  | sort -n \
  | awk 'BEGIN{c=0} {a[c++]=$1} END{print "p95:", a[int(c*0.95)]}'
```

**期望**:
- 慢请求(>300ms)的日志行 `level` 为 `warn`、`msg` 为 `"slow request"`。
- 正常请求(<300ms)`level` 为 `info`、`msg` 为 `"request complete"`。
- p95 数值与前端实测延迟同数量级(误差 < 50ms,排除网络抖动)。

---

## 场景 3 — 失败请求 error 记录 + code 字段(FR-005 / SC-001)

**目标**:验证失败的 tRPC 请求记 error,含 `code` 字段。

**步骤**:

```bash
# 故意传非法 categoryId 触发 BAD_REQUEST
curl -X POST http://localhost:3000/api/trpc/transaction.create \
  -H 'Content-Type: application/json' \
  -H 'Cookie: balthasar.session_token=<your-session>' \
  -d '{"0":{"json":{"type":"expense","amount":1000,"accountId":"...","categoryId":"nonexistent","remark":"x","occurredAt":"2026-07-19T08:00:00Z"}}}'

# 检索对应 error 日志
docker logs balthasar --since 1m 2>&1 \
  | jq -c 'select(.path=="transaction.create" and .level=="error")' | tail -3
```

**期望**:输出含 `level: "error"`、`code: "BAD_REQUEST"`(或 `"NOT_FOUND"` / `"INTERNAL_SERVER_ERROR"`)、
`requestId`、`userId`、`durationMs`、`source: "trpc"`。

---

## 场景 4 — 脱敏零泄漏(SC-003 / FR-004)

**目标**:验证敏感字段(password / email / amount / remark / secret)绝不入日志。

**步骤**:

```bash
# 1. 触发一次登录失败(密码错)
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"WrongPassword123"}'

# 2. 触发一次含 remark 的交易创建(场景 1 已做)

# 3. 自动扫描最近日志,确认敏感字段零泄漏
docker logs balthasar --since 5m 2>&1 \
  | grep -E '"(password|email|amount|remark|secret|authorization|cookie)"\s*:\s*"\[REDACTED\]"' \
  | wc -l   # 期望:大量(many)条命中 —— 说明 redact 在工作

# 4. 反向扫描:不应出现真实敏感值
docker logs balthasar --since 5m 2>&1 \
  | grep -E '"(password|email|amount|remark)"\s*:\s*"[^[]' \
  | wc -l   # 期望:0(任何非 [REDACTED] 的值都是泄漏)
```

**期望**:
- 第 3 步:命中数 > 0(redact 标记存在)。
- 第 4 步:命中数 = 0(零真实值泄漏)。

---

## 场景 5 — Better-Auth 分级转发(FR-014 / Q6)

**目标**:验证 Better-Auth 的 error/warn 进入统一日志流(带 `source: "better-auth"` + `requestId`),
info/debug 不转发。

**步骤**:

```bash
# 触发 Better-Auth 内部 warn(如 session 验证异常)
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"WrongPassword123"}'

# 检索 better-auth 来源日志
docker logs balthasar --since 1m 2>&1 \
  | jq -c 'select(.source=="better-auth")' | tail -3
```

**期望**:
- 出现 `source: "better-auth"` 的 `warn`/`error` 级日志,`requestId` 与 signIn 请求一致。
- **不出现** Better-Auth 的 `info`/`debug` 级日志(被分级过滤)。

---

## 场景 6 — Drizzle 异常记 SQL state(FR-007 / SC-005)

**目标**:验证 DB 查询抛错时日志含 PostgreSQL SQLSTATE。

**步骤**(需 integration 测试环境):

```bash
# 跑集成测试:故意触发 unique violation 或断连
pnpm test:integration -- drizzle-error
```

**期望**(集成测试自动断言):
- 测试构造场景(如插入重复 unique 索引)→ Drizzle 抛错 → 日志含 `level: "error"`、
  `source: "drizzle"`、`sqlState: "23505"`(unique)或 `08006`(connection)、`requestId`。

---

## 场景 7 — 测试环境静默(FR-011)

**目标**:验证 `NODE_ENV=test` 时 info/debug 不污染测试输出。

**步骤**:

```bash
# 跑 unit + procedure 测试,观察控制台
pnpm test:unit
pnpm test:procedure
```

**期望**:
- 控制台**不出现** info/debug 级日志行(只有 Vitest 的标准测试输出)。
- 测试主动捕获日志(通过注入内存 destination)仍可断言 —— 即"静默是对外,捕获是对内"。

---

## 场景 8 — 三环境自动切换(SC-006)

**目标**:验证无需改代码,仅切 `NODE_ENV` 即可切换格式/级别/destination。

**步骤**:

```bash
# 开发(着色)
NODE_ENV=development pnpm dev
# 触发请求,观察终端 —— 期望着色人类可读(pino-pretty)

# 生产(JSON 行)—— 见场景 1

# 测试(静默)—— 见场景 7
```

**期望**:
- `development`:pino-pretty 着色,多行展示字段。
- `production`:单行 JSON。
- `test`:info/debug 静默。
- 三者切换**无代码改动**(仅 `NODE_ENV` env 变化)。

---

## 故障排查

| 症状 | 可能原因 | 排查 |
|---|---|---|
| 日志无 `requestId` | ALS 未在请求边界 enter | 检查 `createContext` 是否调用 `startRequestContext`;单测 `request-context.test.ts` |
| 日志含明文密码 | pino redact paths 未配齐 | 检查 `src/lib/logger.ts` redact 配置;单测 `serializer.test.ts` |
| 单条日志跨多行 | 用户输入被拼接到 msg | grep 代码 `logger.\w+\(\`.*\$\{` 反查;FR-013 违规 |
| Better-Auth 日志双流 | logger 钩子未接管 | 检查 `src/server/auth/config.ts` `logger` 配置(FR-014) |
| 日志拖慢请求 > 5% | 同步序列化 / 大对象 redact | profile;pino 默认异步,若误用 sync destination 回退 |
| 测试输出噪声 | logger 未感知 `NODE_ENV=test` | 检查 logger 工厂函数 env 分支(FR-011) |

---

## 相关文档

- [spec.md](./spec.md) — WHAT/WHY
- [plan.md](./plan.md) — HOW(技术决策、文件改动、宪章检查)
- [research.md](./research.md) — R1-R8 决策与替代方案
- [data-model.md](./data-model.md) — LogRecord / RequestContext 实体定义
- [contracts/log-record.md](./contracts/log-record.md) — JSON 行日志协议契约(消费者稳定接口)
- 宪章 [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) §五 p95 / §四 测试优先
