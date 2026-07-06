# Phase 0 Research: 001-auth-family (v2.0.0 T3 Stack)

**Date**: 2026-07-06
**Status**: Complete
**Source spec**: [spec.md](./spec.md)
**Source plan**: [plan.md](./plan.md)

本文档记录所有技术决策的选择、理由、被排除的替代方案。决策对齐宪章 v2.0.0 (尤其是原则二 Feature-Sliced、原则四测试优先、原则六 YAGNI)。

---

## Q1: 会话凭证机制 — Better-Auth 内置 session

### Decision
**Better-Auth 默认 session 管理** (基于 DB 的 opaque session token,httpOnly cookie,可配置滑动续期)。

### Rationale
- Better-Auth 内置 session 表 + cookie 管理 + CSRF 防护,**不需要**自建 session 系统。
- 满足 SC-008 (登出立即失效): Better-Auth `signOut` 删除 session 行,凭证立即失效。
- 满足 SC-009 (30 天滑动续期): Better-Auth session 配置 `expiresIn: 30d, updateAge: 1d` (每天滑动一次,避免每次请求都更新 DB)。
- Better-Auth 默认 cookie `HttpOnly; SameSite=Lax; Secure; Path=/`,符合最佳实践。

### Alternatives Considered
- **JWT 无状态**: 拒绝。无法满足 SC-008 登出立即失效。
- **自建 opaque token**: 拒绝。Better-Auth 已经提供,自建违反 YAGNI。
- **Better-Auth + JWT 插件**: 拒绝。无 JWT 使用场景,MVP 不需要跨服务 SSO。

---

## Q2: 密码哈希算法 — Better-Auth 默认 scrypt

### Decision
**Better-Auth 默认 scrypt** (内置)。**不**覆盖为 bcrypt。

### Rationale
- Better-Auth 默认使用 scrypt (Node 内置 `node:crypto`,无需 native binding)。
- scrypt 是 NIST 800-63B 认可的三大算法之一 (bcrypt/scrypt/argon2id)。
- 内存硬度优于 bcrypt,抵抗 GPU/ASIC 暴力破解。
- 无需引入额外 npm 包 (与之前 v1 决策中的 bcrypt 相比,工程复杂度更低)。

### Alternatives Considered
- **bcrypt**: 拒绝。Better-Auth 默认即满足,覆盖配置违反 YAGNI。
- **argon2id**: 拒绝。native binding 在 alpine 容器构建中常见痛点。

---

## Q3: 限流 / 锁定计数器存储 — DB

### Decision
**全部存 DB** (Postgres),Better-Auth `rate-limit` 插件 + 自建 `auth_failure_counters` / `registration_ip_counters` 表。

- Better-Auth rate-limit 插件: 按 IP 计数 → 用 `registration_ip_counters` 表 (满足 FR-018)。
- 自建 `auth_failure_counters` 表: 按邮箱计数的 5/5min 锁定逻辑 (FR-009),通过 Better-Auth 的 `signIn.before` hook 注入,因 Better-Auth 默认 rate-limit 只按 IP 不按 email。

### Rationale
- Better-Auth 默认 rate-limit 是 IP 维度,不能直接满足"按邮箱锁定"需求。
- DB 计数可用 testcontainers 端到端验证 (宪章四)。
- 持久化计数避免服务重启后丢失锁定状态。

### Alternatives Considered
- **Better-Auth rate-limit 单一覆盖**: 拒绝。无法按邮箱锁定。
- **Redis 计数**: 拒绝。增加运维组件,违反 YAGNI;V2 水平扩展时再迁。

---

## Q4: 邮箱校验策略 — Better-Auth 内置 + 简化正则

### Decision
依赖 Better-Auth `emailAndPassword` 插件内置校验 + 应用层在 procedure input schema 加 zod 简化正则兜底。

唯一性靠 DB `UNIQUE` 约束。

### Rationale
- Better-Auth 内置基础校验,无需重写。
- zod 兜底防止 procedure 层的错误请求穿透到 Better-Auth (节省一次 IPC)。

### Alternatives Considered
- **严格 RFC 5322 正则**: 拒绝。误杀合法邮箱。
- **DNS MX 实时查询**: 拒绝。增加延迟,违反 SC-001。

---

## Q5: 审计日志表 — 自建 `auth_events` + Better-Auth events hook

### Decision
**自建 `auth_events` 表**,通过 Better-Auth 的 lifecycle events hook (`onUserCreated` / `onSessionCreated` / `onSessionRevoked` 等) 写入。

字段: `id` (UUID v7)、`event_type` (enum)、`email`、`outcome`、`occurred_at`、`metadata` (jsonb,只放非敏感上下文,严禁 password / token / ip / ua)。

索引: `(email, occurred_at DESC)` 支撑 FR-017;`(event_type, occurred_at DESC)` 支撑运营报表。

### Rationale
- Better-Auth 无内置审计查询能力 (其 events 是 fire-and-forget 钩子)。
- 自建表保留对 FR-017 (按邮箱查最近 30 天) 的完全控制。
- 90 天保留策略由后续运营脚本清理 (V2,YAGNI)。

### Alternatives Considered
- **Better-Auth 内置日志**: 拒绝。Better-Auth 只输出 stdout,无查询能力。
- **独立审计数据库**: 拒绝。过度工程。

---

## Q6: Cookie 策略 — Better-Auth 默认

### Decision
采用 Better-Auth 默认 cookie 配置:
- `HttpOnly: true`
- `Secure: true` (生产)
- `SameSite: Lax`
- `Path: /`
- `Max-Age: 30d` (与 SC-009 一致)
- 不设 `Domain` (避免跨子域共享)

### Rationale
- 与之前 v1 决策一致 (Lax 是 CSRF 防护与 UX 的平衡)。
- Better-Auth 提供这些默认值,无需自配置 (YAGNI)。

---

## Q7: Drizzle 迁移工作流

### Decision
- Schema 单一真相源: `src/server/db/schema/*.ts`
- 生成命令: `drizzle-kit generate` → 产出 `migrations/*.sql`
- 应用命令: `drizzle-kit migrate` (生产) / Next.js 开发服务器启动时通过 `src/server/db/migrate-on-boot.ts` 自动 apply (开发)
- 每个新表 / 字段 MUST 同时提交对应 `.sql` 文件 (对齐宪章"开发流程"第 1 条)

### Rationale
- Drizzle Kit 产出纯 SQL,可人工 review 与回滚。
- 与 v1 决策一致。

---

## Q8: 配置与密钥管理 — T3 标准 env.ts

### Decision
- 配置来源: `.env` (开发) / 环境变量 (Docker)
- 解析: `src/lib/env.ts` 用 zod schema 校验,启动失败即 panic-fast
- 必需变量: `DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`NODE_ENV`
- Better-Auth 自动从 `process.env` 读取其所需变量

### Rationale
- T3 Stack 默认模式,与社区最佳实践一致。

---

## Q9: ID 生成策略 — Better-Auth cuid2 + 业务表 UUID v7

### Decision
**双轨**:
- Better-Auth 自管的 `user` / `session` / `verification` / `account` 表使用 **cuid2** (Better-Auth 默认,字符串 ID)。
- 业务表 (`families` / `members` / `auth_events` / `auth_failure_counters` / `registration_ip_counters`) 使用 **UUID v7** (时间有序)。

### Rationale
- Better-Auth 表的 ID 类型由库决定,覆盖会增加维护成本 (YAGNI)。
- 业务表保持 v1 决策 (UUID v7 时间有序,B-tree 友好)。
- `Family.ownerUserId` 是 cuid2 字符串外键,不影响业务表自身主键策略。

---

## Q10: 错误响应格式 — tRPC 错误码

### Decision
采用 tRPC 标准 `TRPCError` 与错误码:
- `BAD_REQUEST` (400) — 校验失败
- `UNAUTHORIZED` (401) — 未认证
- `FORBIDDEN` (403) — 越权
- `CONFLICT` (409) — 邮箱已注册
- `TOO_MANY_REQUESTS` (429) — IP 限流
- `LOCKED` (自定义 code,通过 `TRPCError` 的 `code: 'CONFLICT'` + custom data 实现 423 语义)
- `INTERNAL_SERVER_ERROR` (500)

Better-Auth 端点 (`/api/auth/*`) 走 Better-Auth 自有错误响应;业务 tRPC procedure 走 tRPC 错误。前端根据来源区分。

### Rationale
- tRPC 错误自动通过类型推断暴露给前端 (无需手写契约)。
- 锁定状态通过 custom data 携带 `retryAfterSeconds`,前端可在 client hook 中读取。

---

## Q11: updated_at 维护 — Drizzle 应用层钩子

### Decision
**Drizzle 应用层 `.$onUpdate(() => new Date())`**,不引入 DB trigger。

### Rationale
- 同 v1 决策,YAGNI。

---

## Q12: Better-Auth 集成边界 — 哪些自管 vs 哪些委托

### Decision

| 能力 | 自管/委托 | 实现位置 |
|---|---|---|
| User 注册 (邮箱+密码) | **委托** Better-Auth `emailAndPassword.signUp` | `src/server/api/routers/auth.ts` 的 `register` procedure 调用 |
| 邮箱唯一性 | **委托** Better-Auth (DB UNIQUE 约束兜底) | schema 配置 |
| 密码哈希 | **委托** Better-Auth 默认 scrypt | Better-Auth 内部 |
| 密码强度 (长度+黑名单) | **自管** 在 Better-Auth `password.policy` 配置项注入 | `src/server/auth/config.ts` |
| Session 创建/续期/失效 | **委托** Better-Auth | Better-Auth 内部 |
| Cookie 设置 | **委托** Better-Auth 默认 | Better-Auth 内部 |
| 注册后建 Family + Member | **自管** 通过 Better-Auth `database.before` 钩子,在事务内追加 | `src/server/auth/hooks/family-init.hook.ts` |
| 登录失败锁定 (按邮箱 5/5min) | **自管** 通过 Better-Auth `signIn.before` 钩子拦截 | `src/server/auth/hooks/lockout.hook.ts` |
| 登录失败时序攻击防御 | **委托** Better-Auth 默认 constant-time compare | Better-Auth 内部 |
| 注册 IP 限流 (10/h) | **委托** Better-Auth `rate-limit` 插件 | `src/server/auth/config.ts` |
| 登出 | **委托** Better-Auth `signOut` | tRPC `logout` procedure 内部调用 |
| 查询当前会话 | **委托** Better-Auth `getSession` | tRPC `me` procedure 内部调用 |
| 审计事件写入 | **自管** Better-Auth events hook 写入 `auth_events` 表 | `src/server/auth/hooks/audit.hook.ts` |
| 审计事件查询 (FR-017) | **自管** tRPC procedure 直接查 `auth_events` 表 | tRPC `auditEvents` procedure |
| 锁定 UX 显式提示 | **自管** Better-Auth `signIn.before` 钩子抛出带 `retryAfterSeconds` 的错误 | 与 lockout.hook.ts 同处 |

### Rationale
- Better-Auth 处理"通用认证机制",我们处理"业务规则与不变量"。
- 不重复实现 Better-Auth 已有能力 (YAGNI)。
- 钩子模式让自定义逻辑可单元测试 (注入 mock 邮箱/IP 即可)。

---

## Q13: tRPC Procedure 结构

### Decision

每个 feature 一个 router 文件,挂在 `appRouter` 下。本 feature 的 `auth` router 暴露:

```typescript
// src/server/api/routers/auth.ts
export const authRouter = router({
  register: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // 调用 Better-Auth auth.api.signUpEmail
      // 触发 family-init.hook (建 Family + Member)
      // 写 audit event
      return { user, family, member };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // lockout.hook 前置检查 (按邮箱)
      // 调用 Better-Auth auth.api.signInEmail
      // 失败时更新计数 + 触发锁定 + 写 audit
      // 成功时清空计数 + 写 audit
      return { user, family, member };
    }),

  logout: publicProcedure
    .mutation(async ({ ctx }) => {
      // 幂等: Better-Auth auth.api.signOut
      // 不抛错,无论 session 是否存在
    }),

  me: publicProcedure
    .query(async ({ ctx }) => {
      // Better-Auth getSession + 滑动续期
      // 查 family + member
      // 过期则惰性删除 session 行,返回 null
    }),

  auditEvents: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      // 限定当前 session.user 的 email
      // 查最近 30 天
      // 排除 password/token 字段
    }),
});
```

### Rationale
- 5 个 procedure 覆盖全部 FR/SC。
- protectedProcedure 中间件自动 401 未登录 (FR-012)。
- 输入 zod schema 在 procedure 处声明,TS 类型自动派生到 client (无 contracts/*.md)。
- 前端通过 `trpc.auth.register.useMutation()` 调用,类型推断保证端到端。

### Alternatives Considered
- **Server Actions 替代 tRPC**: 拒绝。Server Actions 类型推断较弱,且与 RSC mutation 模式耦合;tRPC 更适合需要 query/mutation 区分的场景。
- **REST 端点 + zod-openapi**: 拒绝。手写契约,违反 YAGNI。

---

## 总结

13 项决策,均对齐宪章 v2.0.0。无 NEEDS CLARIFICATION 残留,可进入 Phase 1 设计。
