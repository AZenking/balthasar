---

description: "Task list for 001-auth-family (T3 Stack: Next.js + tRPC + Better-Auth + Drizzle)"

---

# Tasks: 用户认证与默认家庭初始化 (v2.0.0)

**Input**: Design documents from `/specs/001-auth-family/`

**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/README.md, research.md, quickstart.md

**Tests**: 包含。宪章四 (Test-First) 不可妥协 —— 每个用例按"测试先行"组织。

**Organization**: 按 User Story 分阶段,每 US 可独立实现+测试+部署。

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: 可并行 (不同文件,无依赖)
- **[Story]**: 该任务属于哪个 US
- 所有路径相对仓库根;全栈代码在 `src/`

## Path Conventions

T3 Stack 单仓:
- 后端: `src/server/...`
- 前端 (App Router): `src/app/...`
- 共享: `src/lib/...`
- 测试: `src/tests/...`

---

## Phase 1: Setup (项目初始化)

**Purpose**: T3 Stack 工程骨架 + Better-Auth + tRPC + Drizzle 装配

- [X] T001 用 `create-t3-app` 初始化项目 (App Router + tRPC + Drizzle + Tailwind,不选 NextAuth,选"我自己实现 auth"),保留默认 `src/` 结构 — 改为手动搭建等价骨架 (避免 CLI 交互)
- [X] T002 安装额外依赖: `better-auth`、`@better-auth/cli`、`bcrypt` (fallback)、`uuidv7`、`testcontainers`、`@testing-library/react` — 写入 `package.json`
- [X] T003 [P] 配置 `tsconfig.json` 路径别名 (`@/server/*`、`@/lib/*`、`@/app/*`、`@/components/*`) — `tsconfig.json`
- [X] T004 [P] 配置 Vitest with projects: `vitest.config.ts` (unit / procedure / integration 三 project)
- [X] T005 [P] 配置 testcontainers Postgres pool + 启动后自动 `drizzle-kit migrate` 作为 init,在 `src/tests/helpers/db.ts`
- [X] T006 [P] 实现 zod 校验 env loader `src/lib/env.ts` (DATABASE_URL、BETTER_AUTH_SECRET、BETTER_AUTH_URL、NODE_ENV,分 server/client 段)

---

## Phase 2: Foundational (跨 US 共享前置)

**Purpose**: Drizzle schema + Better-Auth 配置 + tRPC root router + 自管钩子

**⚠️ CRITICAL**: 此阶段未完成,US1-US4 均无法启动

### 数据层 (Drizzle schema + 初始迁移)

- [X] T007 用 `npx @better-auth/cli@latest generate` 生成 Better-Auth 必需表 schema (user / session / verification / account) 至 `src/server/db/schema/auth.ts`
- [X] T008 [P] Create families Drizzle schema in `src/server/db/schema/family.ts` per [data-model.md](./data-model.md) §`families` —— `owner_user_id` FK 指向 Better-Auth `users.id` (text cuid2);`updated_at` 用 Drizzle 应用层 `.$onUpdate(() => new Date())` 维护
- [X] T009 [P] Create members Drizzle schema in `src/server/db/schema/member.ts` per data-model.md
- [X] T010 [P] Create auth_events Drizzle schema in `src/server/db/schema/auth-events.ts` per data-model.md
- [X] T011 [P] Create auth_failure_counters Drizzle schema in `src/server/db/schema/auth-failure-counters.ts` per data-model.md
- [X] T012 Generate initial Drizzle migration `src/server/db/migrations/0001_init.sql` via `drizzle-kit generate` (覆盖 Better-Auth 表 + 业务 4 表)
- [X] T013 Create Drizzle client singleton in `src/server/db/client.ts`
- [X] T014 [P] Create `src/server/db/index.ts` re-export 所有 schema (供 Better-Auth adapter 与业务代码统一导入)

### 共享工具

- [X] T015 [P] Create `src/lib/uuid.ts` — UUID v7 生成器封装
- [X] T016 [P] Create `src/server/domain/auth/email-normalize.ts` — trim + lower per FR-015
- [X] T017 [P] Create `src/server/domain/auth/password-policy.ts` — NIST 800-63B 长度 ≥ 8 + OWASP top-1000 黑名单,FR-003
- [X] T018 [P] Create `src/server/domain/auth/lockout-policy.ts` — 5/5min 决策函数,纯函数 (输入 counter + now,返回 decision)

### Better-Auth 配置

- [X] T019 Create Better-Auth server config in `src/server/auth/config.ts` —— 启用 `emailAndPassword` 插件 + `rateLimit` (sign-up-email: 1h/10) + `session` (expiresIn: 30d, updateAge: 1d);密码 policy 注入 T017
- [X] T020 [P] Create Better-Auth client config in `src/server/auth/client.ts` —— `createAuthClient` for browser
- [X] T021 Mount Better-Auth handler at `src/app/api/auth/[...all]/route.ts` —— toNextJsHandler(auth)

### tRPC 基础设施

- [X] T022 Create tRPC context `src/server/api/trpc.ts` —— `createContext` 从 Next.js request 取 Better-Auth session,注入 `ctx.session` (无则 null)
- [X] T023 [P] Create `protectedProcedure` 中间件 —— `publicProcedure.use` 链,session 为 null 抛 `UNAUTHORIZED`
- [X] T024 Create empty root router `src/server/api/root.ts` —— `appRouter = router({})` 占位,后续 Phase 在此挂子 router;**先于此 Phase 后续 tRPC 客户端/服务端文件创建**,因为 T025/T026 依赖其 `RootRouter` 类型
- [X] T025 [P] Create tRPC client `src/lib/trpc/client.ts` —— `createTRPCReact<RootRouter>` + links (httpBatchLink + httpSubscriptionLink);依赖 T024 的 RootRouter 类型
- [X] T026 [P] Create tRPC server caller `src/lib/trpc/server.ts` —— `caller<RootRouter>()` 用于 RSC 内调用;依赖 T024 的 RootRouter 类型
- [X] T027 Mount tRPC API at `src/app/api/trpc/[trpc]/route.ts` —— `fetchRequestHandler({ router: appRouter, createContext })`,依赖 T024 router + T022 context

**Checkpoint**: Better-Auth 跑通 `/api/auth/*`、tRPC 跑通空 router,可进入 US 实现。

---

## Phase 3: User Story 1 — 注册并自动建立家庭 (Priority: P1) 🎯 MVP

**Goal**: 新用户提交邮箱+密码 → Better-Auth 创建 user → 在同一事务内创建 Family + Member → Better-Auth 自动建立 session 并签发 cookie

**Independent Test**: 注册成功后,即使后续 story 未实现,也必须能验证: User/Family/Member 三表计数各为 1、`password` 字段不出现 (Better-Auth 内部处理)、session 行已写入 (FR-008)、`register_success` 审计事件已写入 (FR-016)。

### Tests for User Story 1 ⚠️ TDD

- [X] T028 [P] [US1] Procedure 契约测试 `auth.register.useMutation` happy path 在 `src/tests/procedure/auth.test.ts` —— createCaller 调用,断言返回 user/family/member 形状
- [X] T029 [P] [US1] Procedure 契约测试 400 (email 格式 / password < 8 / 弱密码) 在 `src/tests/procedure/auth.test.ts`
- [X] T030 [P] [US1] Procedure 契约测试 409 (重复邮箱) 在 `src/tests/procedure/auth.test.ts`
- [X] T031 [P] [US1] Procedure 契约测试 429 (IP 限流第 11 次) 在 `src/tests/procedure/auth.test.ts`
- [X] T032 [P] [US1] 单元测试 password-policy (长度边界 7/8,黑名单命中) 在 `src/tests/unit/server/domain/auth/password-policy.test.ts`
- [X] T033 [P] [US1] 单元测试 email-normalize 在 `src/tests/unit/server/domain/auth/email-normalize.test.ts`
- [X] T034 [P] [US1] 集成测试: family-init.hook 原子写 (FR-004) 在 `src/tests/integration/auth/register.test.ts` —— testcontainers,模拟 hook 中途失败,验证 user/family/member 三表 0 残留
- [X] T035 [P] [US1] 集成测试: 并发注册同邮箱 → 恰好一个成功,其余 409 (SC-006) 在 `src/tests/integration/auth/register.test.ts`
- [X] T036 [P] [US1] 集成测试: 同 IP 第 11 次注册 → 429 + 第 11 个未写任何行 (SC-011) 在 `src/tests/integration/auth/register.test.ts`

### Implementation for User Story 1

- [X] T037 [P] [US1] Create family-init.hook.ts in `src/server/auth/hooks/family-init.hook.ts` —— Better-Auth `database.before` 钩子,在 user insert 前后扩展事务创建 family + member (FR-004/005)
- [X] T038 [US1] Wire family-init.hook into Better-Auth config (`src/server/auth/config.ts` 的 `database.hooks` 段)
- [X] T039 [P] [US1] Create audit.hook.ts skeleton in `src/server/auth/hooks/audit.hook.ts` —— Better-Auth events 钩子,写入 auth_events 表 (写方法 insert-only)
- [X] T040 [US1] Wire audit.hook into Better-Auth config (events 段,注册 onUserCreated / onSessionCreated 等)
- [X] T041 [US1] Create auth router with `register` procedure in `src/server/api/routers/auth.ts` —— 调用 Better-Auth `auth.api.signUpEmail`,触发钩子 (family-init 自动跑、audit 自动写)
- [X] T042 [US1] Wire `authRouter` into appRouter in `src/server/api/root.ts`

**Checkpoint**: US1 独立可测 —— `pnpm dev` 后浏览器调用 `/api/trpc/auth.register` 返回 200 + Set-Cookie,DB 中三表 1:1:1,审计 1 条。

---

## Phase 4: User Story 2 — 老用户登录 + 锁定 (Priority: P1)

**Goal**: 已注册用户邮箱+密码登录;5 次失败后锁定 5 分钟,锁定窗口内即使密码正确也返回带 `retryAfterSeconds` 的错误

**Independent Test**: 给定已存在用户 (US1 准备),正确密码登录 200 + 新 cookie;错误密码 5 次后第 6 次正确密码仍失败;锁定窗口结束后正确密码 200。

### Tests for User Story 2 ⚠️ TDD

- [X] T043 [P] [US2] Procedure 契约测试 `auth.login` 200 happy path 在 `src/tests/procedure/auth.test.ts`
- [X] T044 [P] [US2] Procedure 契约测试 `auth.login` 401 (不存在邮箱 / 错误密码 —— 响应一致 per FR-007) 在 `src/tests/procedure/auth.test.ts`
- [X] T045 [P] [US2] Procedure 契约测试 `auth.login` 锁定场景 (custom data 含 retryAfterSeconds) per FR-009 + Clarification Q4 在 `src/tests/procedure/auth.test.ts`
- [X] T046 [P] [US2] 单元测试 lockout-policy.ts (5 阈值、locked_until 计算、window 过期决策) 在 `src/tests/unit/server/domain/auth/lockout-policy.test.ts`
- [X] T047 [P] [US2] 集成测试: 5 次失败 → 第 6 次正确密码仍失败 (SC-007) 用 fake timer 在 `src/tests/integration/auth/login-lockout.test.ts`
- [X] T048 [P] [US2] 集成测试: 锁定窗口过期后第 7 次正确密码 → 200 + counter 清空 在 `src/tests/integration/auth/login-lockout.test.ts`
- [X] T049 [P] [US2] 集成测试: 时序攻击防御 —— "用户不存在" vs "密码错"响应时间偏差 < 50ms (Better-Auth 默认 constant-time,验证其生效) 在 `src/tests/integration/auth/login-lockout.test.ts`

### Implementation for User Story 2

- [X] T050 [P] [US2] Create lockout.hook.ts in `src/server/auth/hooks/lockout.hook.ts` —— Better-Auth `signIn.before` 钩子,查 auth_failure_counters,锁定窗口内抛带 `retryAfterSeconds` 的 TRPCError
- [X] T051 [P] [US2] Create lockout-failure.hook.ts in `src/server/auth/hooks/lockout-failure.hook.ts` —— Better-Auth `signIn.after` 错误钩子,increment counter,达 5 设 locked_until + 写 lockout_triggered 审计
- [X] T052 [P] [US2] Create lockout-success.hook.ts in `src/server/auth/hooks/lockout-success.hook.ts` —— 登录成功删除 counter 行
- [X] T053 [US2] Wire 三个 lockout hooks into Better-Auth config
- [X] T054 [US2] Add `login` procedure in `src/server/api/routers/auth.ts` —— 调用 Better-Auth `auth.api.signInEmail`,抛错转 TRPCError 时携带 retryAfterSeconds

**Checkpoint**: US2 独立可测。锁定语义、计时防御、审计事件齐全。

---

## Phase 5: User Story 3 — 登出 (Priority: P2)

**Goal**: 已登录用户登出,旧 session 立即失效;未登录或已登出调用仍成功 (幂等)

**Independent Test**: 登出后用旧 cookie 调 `/api/trpc/auth.me` → 401 (SC-008);二次登出 → 成功,审计事件不重复。

### Tests for User Story 3 ⚠️ TDD

- [X] T055 [P] [US3] Procedure 契约测试 `auth.logout` 200/204 happy path 在 `src/tests/procedure/auth.test.ts`
- [X] T056 [P] [US3] Procedure 契约测试 `auth.logout` 幂等 (无 cookie / 已登出) 在 `src/tests/procedure/auth.test.ts`
- [X] T057 [P] [US3] 集成测试: 登出后旧 cookie → auth.me 401 (SC-008) 在 `src/tests/integration/auth/logout.test.ts`
- [X] T058 [P] [US3] 集成测试: 双重登出只写一条 `logout` 审计 在 `src/tests/integration/auth/logout.test.ts`

### Implementation for User Story 3

- [X] T059 [US3] Add `logout` procedure in `src/server/api/routers/auth.ts` —— 包装 Better-Auth `auth.api.signOut`,内部捕获 session-not-found 不抛错 (幂等)

**Checkpoint**: US3 独立可测。SC-008 通过。

---

## Phase 6: User Story 4 — 会话查询 + 审计查询 (Priority: P2)

**Goal**: 前端可查"当前是谁/家庭/成员";用户可查自己最近 30 天认证事件

**Independent Test**: 登录后 `auth.me` 返回 user/family/member;`auth.auditEvents` 返回时间倒序事件,不含 password/token 字段 (SC-010);30 天滑动续期生效 (SC-009)。

### Tests for User Story 4 ⚠️ TDD

- [X] T060 [P] [US4] Procedure 契约测试 `auth.me` 200 (返回 user/family/member) 在 `src/tests/procedure/auth.test.ts`
- [X] T061 [P] [US4] Procedure 契约测试 `auth.me` 401 (无 cookie / 过期) 在 `src/tests/procedure/auth.test.ts`
- [X] T062 [P] [US4] Procedure 契约测试 `auth.auditEvents` 200 (事件 DESC,无 password/token) 在 `src/tests/procedure/auth.test.ts`
- [X] T063 [P] [US4] 集成测试: 滑动续期 —— Better-Auth updateAge=1d,首次请求触发 expires_at 顺延,24h 内重复请求不写 DB (SC-009) 用 fake timer 在 `src/tests/integration/auth/session-expiry.test.ts`
- [X] T064 [P] [US4] 集成测试: 过期 session 调 auth.me → 401 + session 行被惰性删除 在 `src/tests/integration/auth/session-expiry.test.ts`
- [X] T065 [P] [US4] 集成测试: 全流程 (register→login_fail→lockout→login→logout) 产生 5 类审计事件,auth.auditEvents 可查 在 `src/tests/integration/auth/audit-events.test.ts`
- [X] T066 [P] [US4] 集成测试: 跨用户隔离 —— A 的 cookie 查不到 B 的事件 在 `src/tests/integration/auth/audit-events.test.ts`
- [X] T067 [P] [US4] 性能测试: 1000 行 auth_events → auth.auditEvents P95 < 5s (SC-010) 在 `src/tests/integration/auth/audit-events.test.ts`

### Implementation for User Story 4

- [X] T068 [P] [US4] Create `src/server/db/queries/auth-events.ts` —— 独立读路径 query module,导出 `findRecentAuthEventsByEmail(email, days=30)` 纯 Drizzle 查询函数。**与 audit.hook.ts 解耦** (hook 是 Better-Auth events 写端处理器,read 路径不应混入,见宪章二 Feature-Sliced)
- [X] T069 [US4] Add `me` query in `src/server/api/routers/auth.ts` —— Better-Auth `auth.api.getSession`,查 family + member,过期则返回 null
- [X] T070 [US4] Add `auditEvents` query in `src/server/api/routers/auth.ts` —— protectedProcedure,锁定为当前 session 的 email,调用 T068 的 `findRecentAuthEventsByEmail` 读函数,排除敏感字段

**Checkpoint**: US4 独立可测。SC-009 / SC-010 通过。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全 story 共享的最终质量门

- [X] T071 [P] Run all unit + procedure + integration suites green: `pnpm test` with coverage (domain > 90%, procedure > 80%, integration > 70%)
- [X] T072 [P] Run [quickstart.md](./quickstart.md) end-to-end manual validation; tick all SC items
- [X] T073 Security review: grep `password` / `passwordHash` / `token` across `src/`,响应体,审计 metadata —— must be 0 hits (SC-004)
- [X] T074 Performance review: load test with `autocannon` —— verify auth.register & auth.login P95 < 300ms, auth.me P95 < 100ms
- [X] T075 Update `docs/DATABASE.md` to include Better-Auth tables + business tables (families/members/auth_events/auth_failure_counters/registration_ip_counters)
- [X] T076 Update `docs/DOMAIN.md` —— Family aggregate `ownerUserId` 引用 Better-Auth user.id;不变量"1:1:1" 通过 `idx_families_owner_user_id UNIQUE` 强制
- [X] T077 [P] Add `package.json` scripts: `dev`, `build`, `start`, `test`, `test:unit`, `test:procedure`, `test:integration`, `db:migrate`, `db:generate`, `db:studio`
- [X] T078 [P] Add `docker-compose.yml` at repo root for one-command Postgres + Next.js dev (MVP exit criterion: "Docker 一键启动")
- [X] T079 [P] Add `Dockerfile` for Next.js production build (standalone output)
- [X] T080 Final code review against Constitution v2.0.0 —— verify no Principle violations (especially Principle II feature-sliced + Principle IV no-DB-mocks + Principle VI no manual contracts)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,可立即开始
- **Foundational (Phase 2)**: 依赖 Phase 1 — **阻塞所有 US**
- **US1 (Phase 3)**: 依赖 Phase 2
- **US2 (Phase 4)**: 依赖 Phase 2 + 数据依赖 US1 (需已注册用户)
- **US3 (Phase 5)**: 依赖 Phase 2 + 数据依赖 US1+US2 (需 session 存在)
- **US4 (Phase 6)**: 依赖 Phase 2 + 数据依赖 US1/US2/US3 (审计事件由前序流程产生)
- **Polish (Phase 7)**: 依赖所有 US 完成

### User Story 独立性

- **US1**: 完全独立
- **US2**: 数据依赖 US1 (集成测试用 US1 流程准备数据)
- **US3**: 数据依赖 US1+US2
- **US4**: 数据依赖前序

### Story 内部顺序

- 测试 FIRST (TDD, 宪章四),观察失败
- Domain 纯函数先于 Hook
- Hook 先于 Procedure
- Procedure 改动同时影响 root router (挂子 router)
- 每个故事末尾必须可独立 demo

### 并行机会

- Phase 2 内 T008-T011 (4 张业务 schema 文件) 全部 [P]
- Phase 2 内 T015-T018 (uuid + 3 个 domain 纯函数) 全部 [P]
- 每个 US 内的 procedure 契约测试 [P],可并行编写

---

## Parallel Example

```bash
# Phase 2 Foundational — 4 路并行写业务 schema
Task T008: "Create families Drizzle schema in src/server/db/schema/family.ts"
Task T009: "Create members Drizzle schema in src/server/db/schema/member.ts"
Task T010: "Create auth_events Drizzle schema in src/server/db/schema/auth-events.ts"
Task T011: "Create auth_failure_counters Drizzle schema in src/server/db/schema/auth-failure-counters.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational (CRITICAL — blocks all)
3. 完成 Phase 3: US1 注册
4. **STOP and VALIDATE**: SC-001 / SC-004 / SC-005 / SC-006 / SC-011 各做一遍
5. 若仅交付 MVP 切片,US1 已足以"注册新用户、建立默认家庭、进入登录态",但无登录/登出,实用性低

### 推荐最小可发布切片: US1 + US2

注册 + 登录 = 用户可反复使用系统。US3 (登出) 与 US4 (审计) 作为快速跟进。

### 增量交付

1. Setup + Foundational → Foundation ready
2. + US1 → 注册闭环 (Demo!)
3. + US2 → 实用闭环
4. + US3 → 卫生
5. + US4 → 透明度
6. Polish → 准备发布

---

## Notes

- [P] 任务 = 不同文件,无依赖,可并行
- [Story] 标签把任务映射到 spec.md 的 User Story,可追溯
- 每个 US 末尾的 Checkpoint 必须可独立 demo
- 测试任务先于实现任务 (宪章四)
- 每完成一个 US,运行 `pnpm test` 必须全绿
- 完成所有任务后,运行 quickstart.md 的 11 项 SC 验证
- 任务粒度: 每个 Hook / Domain 函数 / Procedure 为独立任务,便于审查与回滚
- T3 Stack 模式: 前后端在 `src/` 同仓,无需跨工程切换;Better-Auth 钩子是本 feature 的核心扩展点
