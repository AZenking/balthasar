# Tasks: 服务端可观测日志

**Input**: Design documents from `/specs/034-observability-logging/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/log-record.md, quickstart.md

**Tests**: 本 spec 显式遵循宪章 §四(测试优先) + research.md R8 测试矩阵,测试任务**已包含**且按"先红后绿"排列(每阶段测试在前、实现在后)。

**Organization**: 按用户故事分组(spec US1 P1 / US2 P2 / US3 P3),支持独立实现与独立测试。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行(不同文件、无未完成依赖)
- **[Story]**: 所属用户故事(US1/US2/US3)
- 所有任务含精确文件路径

## Path Conventions

单仓结构(宪章 §二 Feature-Sliced),`src/` + `src/tests/` 在仓库根。
logger 入 `src/lib/`(与 `env.ts` 同层);ALS 封装入 `src/lib/request-context.ts`。

---

## Phase 1: Setup(共享基础设施)

**Purpose**: 依赖安装与 logger 模块骨架(本 spec 零 DB migration,Setup 极轻)。

- [X] T001 [P] 安装 pino 生产依赖:`pnpm add pino@^9`(写入 `package.json` dependencies) — research.md R1
- [X] T002 [P] 安装 pino-pretty 开发依赖:`pnpm add -D pino-pretty@^11`(写入 `package.json` devDependencies) — research.md R1
- [X] T003 [P] 新建空文件骨架(不填实现):`src/lib/logger.ts`、`src/lib/request-context.ts`、`src/tests/unit/server/logger/` 目录

**Checkpoint**: 依赖就位,骨架文件可被 import(空 export)。

---

## Phase 2: Foundational(阻塞前置 — 所有 US 共享的 logger 内核 + requestId 基础设施)

**Purpose**: logger 工厂 + AsyncLocalStorage 封装 + tRPC 边界接入。所有用户故事都依赖这一层。

**⚠️ CRITICAL**: US1/US2/US3 任何实现均需先完成本阶段(它们共享 logger + requestId 机制)。

### Tests for Foundational(先红后绿)

> 写测试在前,运行确认 FAIL(模块尚未实现),再做实现任务转绿。

- [X] T004 [P] 单测 `src/tests/unit/server/logger/serializer.test.ts`:断言 pino redact paths 生效(含 password/email/amount/remark/secret 的对象 → 输出含 `[REDACTED]` 且原值不出现)— research.md R7, FR-004, SC-003
- [X] T005 [P] 单测 `src/tests/unit/server/logger/serializer.test.ts`(同文件追加):断言注入防御 —— 含 `\n{"level":"info","msg":"fake"\n` 的 remark 字段 → 输出仍是单条合法 JSON 行 — FR-013
- [X] T006 [P] 单测 `src/tests/unit/server/logger/levels.test.ts`:断言 `NODE_ENV=test` 时 info/debug 不写 destination(error 仍写);`production` 时输出 JSON 行;`development` 时输出着色 — FR-002, FR-011, SC-006
- [X] T007 [P] 单测 `src/tests/unit/server/logger/request-context.test.ts`:断言 AsyncLocalStorage 跨 `await` 保持同一 requestId;并发请求(两个独立 async scope)store 不串 — FR-001, research.md R2
- [X] T008 [P] 单测 `src/tests/unit/server/logger/slow-threshold.test.ts`:断言 `transaction.create` 301ms → warn、299ms → info;`dashboard.*` 501ms → warn;其它 path 不触发 slow(用 `isSlow` 纯函数测) — FR-006

### Implementation for Foundational

- [X] T009 [P] 实现 `src/lib/request-context.ts`:`AsyncLocalStorage<{ requestId, userId }>` + `startRequestContext(requestId, run)` + `getRequestContext()` + `setUserId(id)`;无 store 时 `getRequestContext()` 返回 null(fail-open) — research.md R2, data-model.md 实体 2
- [X] T010 [P] 实现 `src/lib/logger.ts` 创建 pino 实例的工厂:按 `NODE_ENV` 三态切换 level/format/destination(production=info+JSON+stdout、development=debug+pino-pretty+stdout、test=silent+JSON+内存 stream);配置 `redact: { paths, censor: "[REDACTED]" }`(paths 见 contracts/log-record.md 脱敏表);配置 `timestamp` 输出 ISO8601 UTC;配置 `formatters.level` 转 string 标签 — research.md R1/R6/R7, FR-002/FR-003/FR-004/FR-011
- [X] T011 [P] 在 `src/lib/logger.ts` 中导出 `isSlow(path, durationMs): boolean` 纯函数,内部查表 `{ "transaction.create": 300, "dashboard.getMonthSummary": 500 }`(其余 path → Infinity) — FR-006
- [X] T012 在 `src/server/api/trpc.ts` 的 `createContext` 中调用 `startRequestContext(uuid(), async () => …)` 包裹 session 解析 + 返回;session 解析成功后调用 `setUserId(user.id)` — research.md R2, FR-001
- [X] T013 在 `src/server/api/trpc.ts` 新增 `timingMiddleware`(用 `t.middleware`):测量 start/end、算 durationMs、调用 `isSlow` 决定 level、输出 `{ path, type, durationMs, requestId, userId }` 到 logger;将 `timingMiddleware` 挂到 `publicProcedure` 与 `protectedProcedure`(或挂到 router 全局) — research.md R3, FR-005/FR-006
- [X] T014 [P] 修改 `src/app/api/trpc/[trpc]/route.ts` 的 `onError`:从 dev-only `console.error` 改为统一调用 logger(`env.NODE_ENV === "development"` 区分仅用于控制 stack 详情是否入日志,但 error 级别本身在所有环境都记) — 现状仅 dev 记,修复后 prod 也记, FR-005
- [X] T015 [P] 转绿 Foundational 测试:运行 `pnpm test:unit -- src/tests/unit/server/logger/`,确认 T004-T008 全部由红转绿

**Checkpoint**: logger + requestId 基础设施就位,tRPC 边界每个请求都产出 JSON 行日志(含 requestId、userId、path、durationMs)。可在 staging 用 `docker logs balthasar | jq .` 验证。**此时 US1 即已基本可用**(故障追溯闭环),后续 US1 任务为补强 + 验收。

---

## Phase 3: User Story 1 — 生产故障可追溯(Priority: P1) 🎯 MVP

**Goal**: 任意失败的 tRPC 请求,运维能按 `requestId` 检索到从边界到领域的完整日志链(SC-001)。

**Independent Test**: 故意触发一次 `transaction.create` 失败(非法 categoryId)→ `docker logs | jq 'select(.requestId=="<id>")'` 拿到完整链路。

### Tests for User Story 1(先红后绿)

- [X] T016 [P] [US1] 扩展 `src/tests/procedure/transaction.test.ts`:断言 create 成功 → 日志含 `level:"info"` + `path:"transaction.create"` + `requestId` + `userId`;create 失败 → 日志含 `level:"error"` + `code`(BAD_REQUEST/NOT_FOUND/INTERNAL_SERVER_ERROR) — FR-001/FR-005, SC-001
- [X] T017 [P] [US1] 新建 `src/tests/integration/transaction/drizzle-error.test.ts`:用 testcontainers 真实 PG,故意触发 Drizzle 异常(如 unique violation 或断连),断言日志含 `level:"error"` + `source:"drizzle"` + `sqlState`(23505/08006 等) + `requestId` — research.md R8, FR-007, SC-005
- [X] T018 [P] [US1] 新建 `src/tests/integration/authz/cross-family.test.ts`:用 testcontainers,用户 A 试图访问 family B 的 transaction → 抛 NOT_FOUND,断言日志含 `level:"warn"` + `event:"authz.cross_family_attempt"` + 访问者 userId + 被访问资源 id — FR-008, SC-005

### Implementation for User Story 1

- [X] T019 [P] [US1] 在 `src/server/db/client.ts` 的 Drizzle 查询包装层捕获异常:解析 PG error 的 `code`(SQLSTATE)字段,记 `logger.error({ sqlState, source:"drizzle", requestId: getRequestContext()?.requestId, path })`;**不**记 SQL 参数值;捕获后**重新抛出**(不吞业务异常,仅做日志 side-effect) — FR-007
- [X] T020 [US1] 在 `src/server/api/routers/transaction.ts` 的 `create` procedure 中,显式从 `getRequestContext()` 取 `requestId` 并作为参数传给 `insertTransaction` / `validateAccountAndCategory` 等领域/数据访问调用(关键路径显式参数,research.md R2/Q5);procedure 入口记 `logger.debug({ requestId, path:"transaction.create" })` 便于追溯进入点 — FR-001
- [X] T021 [P] [US1] 在 tRPC `errorFormatter`(`src/server/api/trpc.ts`)或 timingMiddleware 的 error 分支:当 `code === "NOT_FOUND"` 且错误来自跨 family 访问时,额外记 `event:"authz.cross_family_attempt"` warn(含访问者 userId、被访问资源 id 从 input 提取) — FR-008
- [X] T022 [US1] 转绿 US1 测试:运行 `pnpm test:procedure -- transaction` 和 `pnpm test:integration -- drizzle-error cross-family`,确认 T016-T018 由红转绿
- [X] T023 [US1] 端到端验证(quickstart.md 场景 1/3/6):在 staging 触发成功 + 失败 + Drizzle 异常请求,`docker logs | jq` 确认按 requestId 检索拿到完整链路 — SC-001

**Checkpoint**: US1 完整闭环 —— 生产故障可追溯。可独立部署/演示(MVP 交付)。

---

## Phase 4: User Story 2 — 性能基线可度量(Priority: P2)

**Goal**: 从日志聚合算 `transaction.create` 与 `dashboard.getMonthSummary` 的 p50/p95/p99,作为宪章 §五 p95 达标依据(SC-002)。

**Independent Test**: staging 发 100 次 `transaction.create` → `jq` 聚合 durationMs 算 p95,与人工秒表抽测一致。

### Tests for User Story 2(先红后绿)

- [X] T024 [P] [US2] 扩展 `src/tests/unit/server/logger/slow-threshold.test.ts`:断言 timingMiddleware 在 301ms 时实际输出 `level:"warn"` + `msg:"slow request"`(端到端验证 isSlow 与 middleware 集成,不只测纯函数) — FR-006
- [X] T025 [P] [US2] 扩展 `src/tests/procedure/transaction.test.ts`:断言 create 成功日志的 `durationMs` 字段为正数且与 `performance.now()` 测量一致(误差 < 5ms) — SC-002

### Implementation for User Story 2

- [X] T026 [US2] 在 `src/server/api/routers/dashboard.ts` 的 `getMonthSummary` procedure 中,显式取 `requestId` 传给底层查询(关键路径,research.md R2);确认 timingMiddleware 已覆盖该 procedure(应为全局,无需额外挂) — FR-001, 与 T020 同模式
- [X] T027 [P] [US2] 验证 timingMiddleware 已对所有 procedure 生效(T013 挂载点):跑一次完整 `pnpm test:procedure`,确认每个 procedure 的测试都能在日志捕获中看到 `path` + `durationMs` — FR-005/FR-006
- [X] T028 [US2] 转绿 US2 测试:运行 `pnpm test:unit -- slow-threshold` 和 `pnpm test:procedure -- transaction`,确认 T024-T025 由红转绿
- [X] T029 [US2] 端到端验证(quickstart.md 场景 2):staging 发 100 次 `transaction.create`,用 `docker logs | jq -c 'select(.path=="transaction.create") | .durationMs' | sort -n | awk` 算 p95,与人工秒表对比误差 < 50ms — SC-002

**Checkpoint**: US2 完成 —— p95 可量化。宪章 §五首次有客观测量手段。

---

## Phase 5: User Story 3 — 安全与业务事件留痕(Priority: P3)

**Goal**: 5 类安全/业务事件(lockout / rate_limited / first_user_bypass / cross_family / idempotency.hit)有 warn/info 级事件日志(SC-005)。

**Independent Test**: staging 触发 5 次密码错登录 → `docker logs | jq 'select(.event=="auth.lockout_triggered")'` 拿到 warn 记录含 retryAfterSeconds。

> **依赖说明**:US3 的 `idempotency.hit` 事件依赖 033 的 `clientRequestId` 已落地。若 033 未合并,US3 该事件项推迟,不影响其余 4 个事件交付。

### Tests for User Story 3(先红后绿)

- [X] T030 [P] [US3] 扩展 `src/tests/procedure/auth.test.ts`:断言连续登录失败至触发锁定(FR-009)→ 日志含 `level:"warn"` + `event:"auth.lockout_triggered"` + `retryAfterSeconds` — FR-008
- [X] T031 [P] [US3] 扩展 `src/tests/procedure/auth.test.ts`:断言 Better-Auth logger 钩子被调用 —— 模拟 Better-Auth 内部 warn(如 session verification failed),断言日志含 `source:"better-auth"` + `level:"warn"` + 关联 `requestId` — FR-014
- [X] T032 [P] [US3] 扩展 `src/tests/procedure/transaction.test.ts`(条件性,依赖 033 合并):同一 `clientRequestId` 第二次提交 → 断言日志含 `level:"info"` + `event:"idempotency.hit"` + `clientRequestId`;若 033 未合并,标 SKIP 并在 tasks 备注 — FR-008, Assumptions

### Implementation for User Story 3

- [X] T033 [US3] 修改 `src/server/auth/config.ts`:在 `betterAuth({})` 配置中加 `logger: { level: "warn", log: (lvl, msg) => logger[lvl]({ source:"better-auth", requestId: getRequestContext()?.requestId }, msg) }`;回调内 try/catch 吞错(fail-open, FR-010) — research.md R4, FR-014
- [X] T034 [US3] 在 `src/server/auth/hooks/lockout.ts`(或 signIn 错误处理路径):当 FR-009 锁定生效时,记 `logger.warn({ event:"auth.lockout_triggered", retryAfterSeconds, userId, path:"auth.signIn", source:"trpc" })` — FR-008
- [X] T035 [P] [US3] 在 `src/server/auth/hooks/registration-gate.ts`(或首次用户绕过路径):当 `ALLOW_REGISTRATION=false` 且 user.count==0 首次注册时,记 `logger.info({ event:"auth.first_user_bypass", userId, source:"trpc" })` — FR-008
- [X] T036 [P] [US3] 在注册限流触发路径(Better-Auth rateLimit 或 registration-gate):记 `logger.warn({ event:"auth.rate_limited", path:"auth.signUp", source:"trpc" })` — FR-008
- [X] T037 [US3] 在 `src/server/api/routers/transaction.ts` 的 `create` procedure 幂等命中分支(033 已落地的 `clientRequestId` 去重逻辑):命中既有 transaction 时,记 `logger.info({ event:"idempotency.hit", clientRequestId, requestId, path:"transaction.create", source:"trpc" })`;**条件性任务**:若 033 未合并,此任务推迟 — FR-008
- [X] T038 [US3] 转绿 US3 测试:运行 `pnpm test:procedure -- auth transaction`,确认 T030-T032 由红转绿(T032 条件性)
- [X] T039 [US3] 端到端验证(quickstart.md 场景 5):staging 触发登录失败 + 锁定 + Better-Auth warn,`docker logs | jq 'select(.source=="better-auth" or .event)'` 确认 5 类事件均能检索 — SC-005

**Checkpoint**: US3 完成 —— 安全与业务事件可审计。所有 6 SC 可验证。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 跨故事收尾、文档同步、零泄漏自动化扫描。

- [X] T040 [P] 文档同步:更新 `docs/DOMAIN.md`(若有 logger 章节)或新增 `docs/OBSERVABILITY.md` 简述本 spec 的日志协议(指向 `specs/034-observability-logging/contracts/log-record.md`) — 宪章开发流程第 3 项
- [X] T041 [P] 在 `docs/AGENTS.md`(若有运维章节)补充日志检索示例(`docker logs balthasar | jq -c 'select(.requestId=="...")'`) — 运维可用性
- [X] T042 [P] 新建脱敏扫描脚本 `scripts/scan-logs-for-secrets.sh`(或 `.mjs`):接受日志样本文件,扫描 `"(password|email|amount|remark|secret|authorization|cookie)"\s*:\s*"[^[]` 模式,命中则 exit 1;接入 CI(`.github/workflows/` 或等价)作为 SC-003 自动化验证 — SC-003
- [X] T043 验证 FR-010 fail-open:在测试中强制 logger destination 抛错(如传一个 `Writable` 在 `_write` 中 throw),断言业务请求仍正常完成(不抛 500) — FR-010
- [X] T044 [P] 验证 FR-009 噪声过滤:在 timingMiddleware 中加路径过滤(`/_next/*`、静态资源、健康检查端点不记 info,仅 error);单测覆盖 — FR-009
- [X] T045 [P] 验证宪章 §五 SC-004(日志开销 ≤5% p95):用 `pnpm test:procedure` + `--coverage` 或简易 benchmark,对比启用 logger 前后 `transaction.create` 的平均耗时,确认开销 < 15ms(300ms 的 5%) — SC-004
- [X] T046 跑 quickstart.md 全部 8 个场景(场景 1-8)在 staging 端到端验证,确认 6 个 SC 全部通过 — SC-001 至 SC-006
- [X] T047 [P] 跑全量测试套件 `pnpm test` 确认无回归(本 spec 应 100% 向后兼容,无 procedure 契约变更)
- [X] T048 [P] 提交 PR:分支 `034-observability-logging`,描述含 6 SC 验证结果 + quickstart 场景执行记录 + 脱敏扫描通过截图

**Checkpoint**: 全部完成,PR ready。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,立即开始。T001/T002/T003 可并行。
- **Foundational (Phase 2)**: 依赖 Phase 1 完成。**阻塞所有 US**。
- **US1 (Phase 3, P1 MVP)**: 依赖 Phase 2。无跨 US 依赖。
- **US2 (Phase 4, P2)**: 依赖 Phase 2。**软依赖 US1**(共享 timingMiddleware,但 US1 完成后 US2 大部分是验证而非新代码)。
- **US3 (Phase 5, P3)**: 依赖 Phase 2。`idempotency.hit` 事件软依赖 033 合并(其余 4 事件无依赖)。
- **Polish (Phase 6)**: 依赖所有目标 US 完成。

### User Story Dependencies

- **US1 (P1)**: 仅依赖 Foundational。可独立交付 MVP。
- **US2 (P2)**: 仅依赖 Foundational(US1 提供的 timingMiddleware 是 Foundational 产物,US2 主要是验证 + dashboard 路径接入)。
- **US3 (P3)**: 仅依赖 Foundational。`idempotency.hit` 项条件性依赖 033。

### Within Each User Story

- 测试先写、先红(宪章 §四)
- 数据访问/领域 → procedure → 边界集成
- 转绿后做端到端验证(对应 quickstart.md 场景)

### Parallel Opportunities

- Phase 1:T001/T002/T003 全并行(不同文件)。
- Phase 2 测试:T004-T008 全并行(各测独立单元)。实现 T009/T010/T011 并行(不同文件);T012/T013 串行(同文件 `trpc.ts`,且 T013 依赖 T010 logger);T014 并行。
- Phase 3 测试:T016-T018 并行(不同文件)。实现 T019 并行;T020/T021 串行(transaction router);T022-T023 验证。
- Phase 4/5 类似,测试任务多可并行。
- 跨 US:US1/US2/US3 在 Foundational 完成后可并行(若有多人)。

---

## Parallel Example: Phase 2 Tests(先红)

```bash
# Foundational 阶段 5 个单测文件可同时落:
Task: "T004 redact 单测 in src/tests/unit/server/logger/serializer.test.ts"
Task: "T005 注入防御单测(同文件追加)"
Task: "T006 级别路由单测 in src/tests/unit/server/logger/levels.test.ts"
Task: "T007 ALS 隔离单测 in src/tests/unit/server/logger/request-context.test.ts"
Task: "T008 slow 阈值单测 in src/tests/unit/server/logger/slow-threshold.test.ts"
```

## Parallel Example: Phase 3 Tests

```bash
# US1 三个测试可同时落:
Task: "T016 procedure 测 in src/tests/procedure/transaction.test.ts(扩展)"
Task: "T017 integration Drizzle 异常 in src/tests/integration/transaction/drizzle-error.test.ts(新)"
Task: "T018 integration 跨 family in src/tests/integration/authz/cross-family.test.ts(新)"
```

---

## Implementation Strategy

### MVP First(仅 US1)

1. Phase 1:Setup(3 任务,~10 min)
2. Phase 2:Foundational(12 任务,~3-4 小时 —— logger 内核 + tRPC 接入是本 spec 主要工作量)
3. Phase 3:US1(8 任务,~2 小时 —— 主要是 Drizzle 错误包装 + 跨 family warn)
4. **STOP and VALIDATE**:quickstart.md 场景 1/3/6 通过 → **MVP 可部署**(故障追溯闭环)
5. PR 可仅含 US1,后续 US2/US3 增量交付

### Incremental Delivery

1. Setup + Foundational → logger 基础设施 ready(此时 prod 已开始产出结构化日志,价值巨大)
2. + US1 → 故障可追溯(MVP!)
3. + US2 → p95 可量化(宪章 §五 首次可验证)
4. + US3 → 安全事件可审计
5. + Polish → 零泄漏自动化扫描 + 文档

### Parallel Team Strategy

单人按 P1→P2→P3 顺序即可;若有 2 人:
- Person A:Foundational → US1 主线
- Person B:并行准备 US2/US3 的测试任务(先红)

---

## Notes

- [P] 任务 = 不同文件、无未完成依赖
- [Story] 标签映射到 spec.md 用户故事(US1/US2/US3)
- 每阶段测试在前、实现在后(宪章 §四 先红后绿)
- 每个任务后提交(commit per task 或 logical group)
- Checkpoint 处可暂停独立验证
- 本 spec **零 DB migration**(plan.md Storage: N/A),无 schema 变更风险
- 本 spec **零 procedure 输入/输出契约变更**(显式 requestId 是内部参数,客户端无感) → 100% 向后兼容
- 依赖外部状态:`idempotency.hit`(T037/T032)依赖 033 合并,其余任务无外部依赖
