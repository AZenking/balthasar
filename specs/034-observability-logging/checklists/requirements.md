# Specification Quality Checklist: 服务端可观测日志

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-19
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - Note: 库选型(pino / winston / 自包装)显式留给 plan 阶段;spec 仅描述 WHAT/WHY。
    `requestId` / JSON 行 / ISO8601 是**协议级**描述(影响外部可观测契约),
    非"实现细节"——它们定义了日志消费者能依赖的稳定接口,故保留。
- [x] Focused on user value and business needs
  - 三类用户(运维/开发者/系统拥有者)的 WHY 均显式说明,且绑定宪章 §五 p95、§三审计。
- [x] Written for non-technical stakeholders
  - 每个 US 用"作为 X,我需要 Y,以便 Z"业务语言;FR 才进入可测条件。
- [x] All mandatory sections completed
  - User Scenarios / Requirements / Success Criteria / Assumptions 均填实。

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
  - 六项方向决策已就位:Q1 范围 / Q2 格式 / Q3 采样(specify 阶段)+
    Q4 日志注入 / Q5 requestId 传播 / Q6 Better-Auth 归并(clarify 阶段)。
- [x] Requirements are testable and unambiguous
  - FR-001..FR-014 每条均有可验证字段或行为(可写为单测/集成测断言)。
    FR-013(注入防御)有具体验证用例(含 `\n` 的 remark → 单条合法 JSON 行);
    FR-014(Better-Auth 归并)带降级路径(plan 阶段验证库能力)。
- [x] Success criteria are measurable
  - SC-001..SC-006 均含可量化指标(检索到记录 / p95 可算 / 零泄漏 / 5% 开销 / 自动切换)。
- [x] Success criteria are technology-agnostic (no implementation details)
  - SC 不点名 pino/winston;"JSON 行"/"ISO8601"是协议级而非实现级。
- [x] All acceptance scenarios are defined
  - US1(4 场景)+ US2(2 场景)+ US3(3 场景)= 9 条,覆盖正常/异常/边界。
- [x] Edge cases are identified
  - 5 条 edge case(日志自错/超大 body/时区/HMR/测试静默)。
- [x] Scope is clearly bounded
  - Assumptions 显式排除:前端 RUM、分布式 tracing、文件/syslog 客户端、保留策略。
- [x] Dependencies and assumptions identified
  - 依赖 033 `clientRequestId`(US3 idempotency.hit);其余为合理默认。

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
  - FR ↔ US ↔ SC 三者可追溯(FR-008 的事件清单直接对应 US3 场景)。
- [x] User scenarios cover primary flows
  - P1 故障追溯 / P2 性能量化 / P3 安全审计,覆盖运维/开发/拥有者三类用户。
- [x] Feature meets measurable outcomes defined in Success Criteria
  - SC 与宪章 §五 p95、§三审计、零敏感泄漏 直接挂钩。
- [x] No implementation details leak into specification
  - 唯一可能被认为是实现细节的(JSON 行格式)被论证为"对外协议",保留合理。

## Notes

- 本 spec 已通过首轮质量校验,所有项均 pass,无需迭代修正。
- clarify 阶段补充三项决策(Q4 日志注入 / Q5 requestId 传播 / Q6 Better-Auth 归并),
  对应新增 FR-013 / FR-014,并细化 FR-001。checklist 项均保持 pass(原本就 pass,
  新决策使其更可测,但状态无翻转)。
- 六项 Clarifications 已在 spec 内联给出明确答案,无需向用户追问。
- 库选型(pino vs winston vs 自包装)是 plan/research 阶段的明确议题,非 spec 缺口。
- 与 033-offline-cache-readonly 的耦合点(US3 idempotency.hit)已在 Assumptions 标注,
  plan 阶段需核对 033 合并状态以决定 US3 该事件项是否同期交付。
- 宪章检查(治理章节硬要求):
  - §一 MVP:可观测日志是既有 MVP 功能(记账/认证/审计)的横切支撑,非范围外功能。✅
  - §二 Feature-Sliced:logger 作为 `src/lib/` 共享工具(与 env.ts / utils.ts 同层),
    AsyncLocalStorage 注入是基础设施(与 createContext 同级),非 cross-feature 抽象
    泄漏。✅
  - §四 测试优先:FR-010(fail-open)、FR-004(脱敏)、FR-011(测试静默)、FR-013(注入
    防御,有具体输入用例)、FR-014(Better-Auth 归并)均有可测断言。✅
  - §五 性能:SC-004 约束日志开销 ≤ 5% p95 预算,与宪章一致;Q3 慢请求自动升级 warn
    直接服务 p95 监控。✅
  - §六 YAGNI:Assumptions 显式排除分布式 tracing / ELK 客户端 / 保留策略;Q5 关键路径
    显式参数 + 其余 ALS 隐式的混合方案,避免为非关键路径提前付签名侵入代价。✅
  - §七 UI 纪律:本 spec 不触 UI,不触发 /heroui-react。✅
