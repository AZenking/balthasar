# Implementation Plan: 手机端首页及相关页面重做

**Branch**: `027-mobile-home-revamp` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-mobile-home-revamp/spec.md`

## Summary

按《个人记账软件手机端首页设计》(2026-07-14) 及配套 5 屏线稿,重做手机端首页(`/dashboard`)及相关页面(明细/统计/记一笔),并解锁四类 MVP 外能力:转账、预算、资产聚合、退款。

**前置阻塞**:本 spec 功能直接违反宪章 v3.1.0 原则一(MVP 范围:禁止转账/预算)与原则三(`Budget`/`Asset`/`Debt` 表属范围外)。因此 US1 = 宪章 v3.1.0 → v3.2.0 (MAJOR) 修订,必须最先落地;US4(转账)/US5(预算)/US6(资产)/退款在宪章修订前不得进入实现。

**技术路线**(经 specify + clarify 确定):
- **DB 迁移**:`transactions.type` 枚举增 `transfer` + 新增 `toAccountId` 列;`accounts` 表新增 `type`(asset/debt)列;新增 `budgets` 表(`familyId, year, month, amount` 唯一)。
- **聚合规则**:`monthIncome`/`monthExpense` 的 SUM 排除 `transfer` 类型;资产按 `accounts.type` 分组聚合;预算四态由 usage% 与硬编码 80% 阈值计算。
- **首页**:主数字从"结余"反转为"本月支出";恢复 Top4 分类(026 刚下架的 Top2 扩展);趋势改本月每日 + 上月同期;补强隐私(遮蔽 recharts YAxis 刻度);底部导航 4 入口 + 上凸圆形 FAB(直接进记一笔表单默认支出)。

执行策略:**US1(宪章修订)→ US2(首页 MVP 内重做)→ US3(明细/统计)→ US4(转账)→ US5(预算)→ US6(资产)** 有序推进,每阶段可独立交付。

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19 / Next.js 16(均已冻结于宪章 v3.1.0 §技术栈)

**Primary Dependencies**:
- 保留(零变更):Next.js 16 (App Router) / React 19 / Tailwind v4 / `@heroui/react` + `@heroui/styles`(HeroUI v3)/ tRPC v11 / Drizzle / Better-Auth / `recharts` / `lucide-react` / `react-hook-form` / `zod` / `sonner` / `superjson` / `uuidv7` / `@internationalized/date` / `@dnd-kit/*`
- 新增:无(全部能力由现有栈覆盖)

**Storage**: PostgreSQL 16。**有 schema 变更**(与 026 零迁移不同):
1. `transactions.type` pgEnum 增 `transfer`;新增 `transactions.to_account_id` uuid NULLABLE(FK → accounts,ON DELETE RESTRICT)。
2. `accounts` 新增 `type` 列 pgEnum(asset/debt),NOT NULL DEFAULT 'asset'(向后兼容存量数据)。
3. 新增 `budgets` 表:`id`/`family_id`/`year`/`month`/`amount`/`created_at`/`updated_at`,UNIQUE(family_id, year, month)。
- 均需 Drizzle migration,且验证 down 路径可回滚(宪章开发流程第 1 项)。

**Testing**: Vitest 3 + `@testing-library/react` + `@testcontainers/postgresql`(保留)。新增:转账聚合隔离单测、预算四态单测、资产 type 分组集成测、隐私遮蔽 recharts 刻度的组件测。

**Target Platform**: Web 浏览器,移动端优先(320px–430px 视口,设计文档 §8 硬性验收 320px 无横向滚动)+ 桌面端居中布局。

**Project Type**: web-app(Next.js 全栈,T3 stack)

**Performance Goals**(宪章五 + 设计 SC):
- `dashboard.summary` query p95 < 500ms(扩展后保持:增 transfer 排除 + 预算 + 资产子查询,需 research 验证并发策略)
- 新增 `dashboard.budget` query p95 < 200ms(单行查询)
- 新增 `dashboard.assets` query p95 < 300ms(accounts 聚合 + transactions SUM)
- 转账 `transaction.create` mutation p95 < 300ms(宪章五 mutation 预算,含双账户余额更新)
- 首页月份切换 < 500ms 用户感知
- 首页单模块失败不阻塞整页(SC-008)

**Constraints**:
- 移动端 320px 无横向滚动、内容重叠、文字截断(设计 §8)
- 隐私模式无金额闪现 + 趋势图刻度/Tooltip/点击金额全遮蔽(FR-008/FR-009,补 026 已知缺口)
- 宪章 v3.1.0 → v3.2.0 MAJOR 修订必须先于 US4/5/6 实现(US1)
- 原则七:所有 UI 改动先 `/heroui-react` skill 查询
- 转账:转出/转入同一账户必须拒绝(FR-014)

**Scale/Scope**:
- 涉及页面:首页(重做)、明细页(扩展转账 tab + 日分组)、统计页(加月/年 toggle + 三宫格)、记一笔(加转账模式 + FAB 直进)
- DB 迁移:3 类(transfer 枚举+列、account type 列、budgets 表)
- 新增 procedure:3 个(`dashboard.budget` query、`dashboard.assets` query、预算 set mutation);扩展 3 个(`dashboard.summary` 加预算/资产、`transaction.create` 加转账、`account.create` 加 type)
- 宪章修订:1 次 MAJOR(v3.1.0 → v3.2.0)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 说明 |
|------|------|------|
| 一、MVP 范围 | ⚠️ Violation → **由 US1 修订解除** | v3.1.0 原文"禁止新增范围外功能 —— 转账、预算、AI、OCR、导入导出、投资、多币种等"。本 spec 的转账/预算/资产/退款四项直接违反。**解除方式**:US1 把宪章升到 v3.2.0 (MAJOR),从禁止项清单移除"转账、预算",保留"AI、OCR、导入导出、投资、多币种"。修订满足治理章节 MAJOR 三要求(提案见 spec §宪法修订提案 + 本 plan Complexity Tracking)。**门控**:US4/5/6 与退款 FR 在 US1 合并前不得实现。 |
| 二、Feature-Sliced Architecture | ✅ Pass | 不改架构。前端 `src/app/(app)/<feature>/page.tsx` + `src/components/<feature>/`;后端新 procedure 入 `routers/dashboard.ts`/`routers/transaction.ts`/`routers/account.ts`;新表 schema 入 `src/server/db/schema/budget.ts`;领域函数入 `src/server/domain/transaction/`(转账符号)与 `src/server/domain/dashboard/`(预算四态)。依赖方向 UI→tRPC→Domain→Drizzle→PG 不变。 |
| 三、领域驱动设计 | ⚠️ Violation → **由 US1 修订解除** | v3.1.0 原文"新表(`Asset`、`Debt`、`Budget`、`Investment`)在路线图解锁前属于范围外"。本 spec 新增 `budgets` 表。**解除方式**:US1 修订原则三,允许 `Budget` 作为 `Family` 聚合内实体;`Asset`/`Debt` 用现有 `accounts.type` 字段推导不新增表(YAGNI);`Investment` 仍属范围外。聚合根 `Family` 不变,新实体均通过 `familyId` 引用,不变量在 server procedure 强制。 |
| 四、测试优先 | ✅ Pass | 测试矩阵:① 单元 — 转账符号/聚合排除、预算四态阈值(80%/100%)、隐私遮蔽选择器;② procedure — `createCaller` 验证转账双账户、预算 CRUD、资产 family 隔离、转账同账户拒绝;③ 集成 — testcontainers 真实 PG 验证 migration + 聚合 SQL;④ 组件 — 320px 布局、隐私遮蔽 recharts 刻度、左滑删除+撤销。tasks 阶段先红后绿。 |
| 五、性能与极速录入 | ✅ Pass(待 research 验证 summary 扩展) | `summary` 扩展后增预算/资产子查询,需 research 验证 `Promise.all` 并发策略保持 p95 < 500ms。转账 mutation 含双账户更新需验证 < 300ms。极速录入:FAB 直进表单默认支出(无二级弹层),符合 10 秒目标。 |
| 六、简单 (YAGNI) | ✅ Pass | 显式排除:年预算(仅月预算,见 clarify Q3)、独立 Debt 表(用 account.type)、退款独立实体(反向支出,见 clarify Q1)、FAB 二级选项层(直进表单,见 clarify Q2)、趋势点点击弹层形态(plan 定)。可配置预算阈值留 V2。 |
| 七、UI 调整纪律 (HeroUI) | ⚠️ Reminder → **plan 阶段强制执行** | 本 spec 触及大量 `src/components/**/*.tsx` 与 `src/app/**/*.tsx` 的 JSX/className(首页重做、FAB 导航、明细/统计页、记一笔表单)。**所有 UI 改动实现前必须先 `/heroui-react` skill 查询**(HeroUI v3 组件 API/variant/theming)。记为实现阶段每张涉及 UI 的 task 的前置步骤。 |
| 技术栈 | ✅ Pass | 零栈变更。026 已冻结 HeroUI v3 / Tailwind v4 / tRPC v11 / Drizzle / PG16 / Better-Auth。本 spec 无新依赖。 |

**Gate 结论**:原则一/三的 violation 由 US1(宪章 v3.2.0 MAJOR 修订)解除,US1 是硬前置。原则七是 reminder(非 violation,但实现期强制 skill 查询)。两项均写入 Complexity Tracking。**允许 Phase 0/1 继续**,但 US1 未合并前 US4/5/6 不产出代码。

### Post-Design Re-check(Phase 1 完成后)

| 原则 | 设计后状态 | 复核 |
|------|------|------|
| 一、MVP 范围 | ⚠️ 仍需 US1 解除 | data-model/contracts 确认了 transfer/budget/assets 的实体设计,violation 范围与设计前一致,无新增违规。US1 仍是硬前置。 |
| 二、Feature-Sliced | ✅ Pass | 设计遵循:新 schema `schema/budget.ts`、领域函数 `domain/dashboard/budget-status.ts` + `domain/transaction/validate.ts` 扩展、procedure 入现有 router。无横向分层、无新顶层目录。 |
| 三、领域驱动 | ⚠️ 仍需 US1 解除 | data-model 确认 `Budget` 新表 + `Account.type` 列 + `Transaction.toAccountId` 列均在 `Family` 聚合内(familyId 引用 + server 强不变量)。`Investment` 仍排除。无聚合根变更。US1 解除后通过。 |
| 四、测试优先 | ✅ Pass | 每个 contract 含 Test Scenarios 节(转账双账户/自转拒绝/预算四态边界/资产 type 分组/退款冲减/降级 null)。data-model §3 纯函数有边界列举。 |
| 五、性能 | ✅ Pass | dashboard-summary 契约 Performance Budget 明确 6 并行 task + p95<500ms;budget/assets 降级策略(research R2)保证 SC-008。无 N+1(getAssets 用 CTE 单次聚合,research R5)。 |
| 六、YAGNI | ✅ Pass | 设计显式排除:年预算、独立 Debt 表、退款独立实体、FAB 二级层、趋势点弹层、可配阈值。全部有 Alternatives rejected 记录。 |
| 七、UI 纪律 | ⚠️ Reminder | 设计产出 5 个 contract + 组件清单,均触及 tsx。实现期 task 级 checklist 强制 `/heroui-react`。 |
| 技术栈 | ✅ Pass | 零新依赖(research 开头已验证现有栈覆盖)。 |

**Post-design 结论**:无新增违规。原则一/三的 violation 范围在设计后未扩大,仍由 US1 解除。允许进入 Phase 2(`/speckit-tasks`)。


## Project Structure

### Documentation (this feature)

```text
specs/027-mobile-home-revamp/
├── spec.md               # /speckit-specify 输出(已完成)+ /speckit-clarify 增补
├── plan.md               # 本文件
├── research.md           # Phase 0 输出(转账建模/聚合策略/隐私遮蔽 recharts/预算四态)
├── data-model.md         # Phase 1 输出(DB schema 变更 + 应用层契约实体)
├── contracts/            # Phase 1 输出(tRPC procedure 行为契约)
│   ├── dashboard-summary.md   # 扩展(加预算/资产/transfer 排除)
│   ├── transaction-create.md # 扩展(加 transfer 模式)
│   ├── dashboard-budget.md   # 新增
│   ├── dashboard-assets.md   # 新增
│   └── account-create.md     # 扩展(加 type)
├── quickstart.md         # Phase 1 输出(端到端验证手册)
└── tasks.md              # Phase 2 输出(/speckit-tasks,本命令不创建)
```

### Source Code (repository root)

```text
src/
├── app/                                  # Next.js App Router
│   ├── (app)/
│   │   ├── dashboard/page.tsx            # 首页重做(主数字支出/Top4/趋势每日/预算/资产)
│   │   ├── transactions/page.tsx         # 明细(加转账 tab + 日分组组头小计)
│   │   ├── reports/page.tsx              # 统计(加月/年 toggle + 三宫格 + 峰值徽标)
│   │   ├── transaction/new/page.tsx      # 记一笔(加 transfer 模式)
│   │   ├── settings/page.tsx             # "我的"(账户管理表单加 type 字段)
│   │   └── layout.tsx                    # AppShell(底部导航改 4 入口 + FAB)
│   ├── globals.css                       # 隐私遮蔽规则扩展(recharts YAxis tick)
│   └── layout.tsx
├── components/
│   ├── bottom-navigation.tsx             # 重做:4 入口 + 中央上凸圆形 FAB
│   ├── privacy-toggle.tsx                # 保留(隐私机制不变)
│   ├── dashboard/
│   │   ├── summary-hero-card.tsx         # 新/重做:主数字=支出(非结余)
│   │   ├── budget-progress.tsx           # 新:预算四态进度
│   │   ├── category-top-list.tsx         # 新:Top4 横向进度条(替代下架的 Top2)
│   │   ├── expense-trend-chart.tsx       # 重做:本月每日 + 上月同期 + 隐私遮蔽刻度
│   │   ├── recent-transactions.tsx       # 扩展:左滑删除 + 撤销
│   │   └── asset-overview.tsx            # 新:净资产/总资产/总负债 + 空引导
│   ├── transactions/
│   │   ├── transaction-filters.tsx       # 扩展:加转账 tab
│   │   └── transaction-day-group.tsx     # 新:按日分组 + 组头小计
│   ├── reports/
│   │   ├── stats-period-toggle.tsx       # 新:月/年 toggle
│   │   └── stats-insights-grid.tsx       # 新:最高支出日/最大单笔/支出次数三宫格
│   ├── transaction/
│   │   └── transaction-form.tsx          # 扩展:transfer 模式(转出/转入账户)
│   └── [现有目录保留]
├── lib/
│   ├── date-ranges.ts                    # 扩展:每日桶补零(月维度,非周)
│   └── privacy.ts                        # 保留
└── server/
    ├── api/routers/
    │   ├── dashboard.ts                  # 扩展 summary + 新增 budget/assets
    │   ├── transaction.ts                # 扩展 create(transfer)
    │   └── account.ts                    # 扩展 create/update(type)
    ├── db/
    │   ├── schema/
    │   │   ├── transaction.ts            # 改:type 枚举 +transfer、新增 toAccountId
    │   │   ├── account.ts                # 改:新增 type 列
    │   │   └── budget.ts                 # 新:budgets 表
    │   ├── queries/
    │   │   ├── dashboard.ts              # 改:聚合排除 transfer、新增 getBudget/getAssets
    │   │   └── transaction.ts            # 改:转账双账户余额
    │   └── migrations/                   # 新增 migration 文件(drizzle-kit generate)
    └── domain/
        ├── transaction/
        │   └── validate.ts               # 扩展:transfer 符号 + 同账户拒绝
        └── dashboard/
            └── budget-status.ts          # 新:预算四态计算(纯函数)

.specify/memory/constitution.md           # US1:v3.1.0 → v3.2.0 MAJOR 修订

docs/
├── DOMAIN.md                             # 更新:transfer 语义 + Budget/Asset 实体
└── DATABASE.md                           # 更新:budgets 表 + accounts.type + transactions.to_account_id
```

**Structure Decision**:沿用 026 已确认的 Feature-Sliced 单仓结构,无新顶层目录。schema 变更遵循"一 feature 一 schema 文件"(新建 `schema/budget.ts`);领域纯函数按聚合子域归类(`domain/dashboard/budget-status.ts` 新建,`domain/transaction/validate.ts` 扩展)。`components/dashboard/` 是本次重做主战场,新增 4 个子组件(summary-hero-card 重做、budget-progress、category-top-list、asset-overview)+ 2 个扩展(expense-trend-chart、recent-transactions)。底部导航从 026 的"5 入口含 Drawer"改为"4 入口 + 独立 FAB"。

## Complexity Tracking

> 填写因为 Constitution Check 有 violations 需要正当化

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 原则一(MVP 范围):解锁转账/预算/资产/退款 | 手机端首页设计(2026-07-14,用户确认)把这四项列为核心模块。转账是记一笔第三模式、预算是首页首屏第 3 模块、资产是下滑区第 8 模块、退款是计算规则(§5)。缺失则首页信息架构不完整,与设计文档冲突。 | "只做 MVP 内 UI 重做"被否决:用户在 specify 阶段明确选"解锁全部范围(修宪章)"。转账/预算/资产/退款在同类记账 App(随手记/钱迹/MoneyWiz)是基础能力,非投机性扩展。 |
| 原则三(领域驱动):新增 `budgets` 表 | 预算金额无法从现有数据推导(用户意图,非交易衍生),必须持久化。`Budget(familyId, year, month, amount)` 是 `Family` 聚合内实体,符合"通过 familyId 引用 + server 端强不变量"。 | "用 accounts.initialBalance 或交易备注存预算"被否决:语义错配、查询困难、违反聚合边界清晰性。"不存预算,只做 UI 占位"被否决:设计 §4.3 要求四态(含已用/剩余/百分比),无持久化则无法实现。 |
| 原则三:`Asset`/`Debt` 不新增表(用 accounts.type) | 资产/负债只需净资产/总资产/总负债三个聚合数,可由 `accounts.type`(asset/debt)+ `initialBalance` + 交易流水 SUM 推导。符合 YAGNI(原则六)。 | "新增 Asset/Debt 独立表"被否决(clarify Q1 已定 Option B):当前只需聚合数,独立表是过度建模;accounts.type 字段足够表达分类,且向后兼容(DEFAULT 'asset')。 |
| 原则七(UI 纪律):实现期强制 /heroui-react skill 查询 | 本 spec 触及 ~15 个 tsx 组件的 JSX/className,凭 shadcn 时代记忆编码会触发 HeroUI v3 API 误用(组合式 slot、variant、oklch token)。 | 本项是 reminder 非 violation,不删简。实现期每张 UI task 前置 skill 查询,作为 task 级 checklists。 |

## 现有代码迁移清单 (FR-C002, US1 合规必备)

> 宪章治理章节要求 MAJOR 修订(v3.1.0 → v3.2.0)附"针对违反新规则已有代码的迁移计划"。本清单是 FR-C002 的落地物,US1(T003-T006)合并前须与宪章修订同 PR 提交。逐项列出 027 前(仅 income/expense、无 budget/asset 表)需改造的现有代码,及对应的 027 task。

### 1. `transactionType` 枚举消费者(transfer 加入后)

| 现有代码 | 影响 | 迁移动作 | 027 task |
|---|---|---|---|
| `src/server/db/schema/transaction.ts:33` `pgEnum("transaction_type", ["income","expense"])` | 枚举加 `transfer` | migration `ALTER TYPE ADD VALUE`;schema 文件加 transfer | T029, T030 |
| `src/server/domain/transaction/validate.ts:20` `applySign(type, amount)` | transfer 分支缺失 | 加 `if (type==="transfer") return Math.abs(amount)` | T031 |
| `src/server/api/routers/transaction.ts:35` `z.enum(["income","expense"])` | input 拒 transfer | 改 `z.discriminatedUnion("type", [...])` 含 transfer | T032 |
| `src/app/api/v1/transactions/route.ts` + `[id]/route.ts`(REST 入口) | 同上,applySign 消费 | 同步加 transfer 分支(若保留 REST;否则标注 deprecated) | T032 附带 |

### 2. sign-driven 聚合 SQL(需改 type-driven,research R9)

| 现有代码 | 现状(sign-driven) | 迁移后(type-driven) | 027 task |
|---|---|---|---|
| `src/server/db/queries/dashboard.ts:26` `getMonthSummary` income | `SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)` | `SUM(CASE WHEN type='income' THEN amount ELSE 0 END)`(防 transfer 正 amount 误入) | T033 |
| 同上 expense | `SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END)` | `SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END)`(含退款 +正 amount,ABS 统一) | T033 |
| `src/server/db/queries/transaction.ts:227` `getTransactionSummary` | 同 sign-driven CASE | 同步改 type-driven | T033 附带 |

### 3. `WHERE type='expense'` 查询(确认是否需排除 transfer)

| 现有代码 | 现状 | 迁移评估 | 027 task |
|---|---|---|---|
| `src/server/db/queries/dashboard.ts:104` `getCategoryBreakdown` | `WHERE type='expense'` | **无需改**(transfer 不归分类,本就不进此查询;退款 type 也是 expense 自动正确) | 无(T010 仅改 slice 2→4) |
| `src/server/db/queries/dashboard.ts:142` `getDailyTrend` / `:194` `getWeeklyTrend` | `WHERE type='expense'` | **无需改**(趋势是支出趋势,transfer 不计入;正确) | 无(T011 改 daily 维度,不改 type 过滤) |
| `src/components/transactions/transaction-filters.tsx` TypeTab | `"__all__" \| "expense" \| "income"` | 加 `"transfer"` tab | T021, T036 |

### 4. 退款路径(新增,027 前无)

| 新增代码 | 动作 | 027 task |
|---|---|---|
| `transaction.create` procedure expense 分支 | 加 `isRefund` 标志;`isRefund=true` 跳过 applySign、直接存 +abs(amount) | T032, T059 |
| 聚合 SQL | `SUM(CASE WHEN type='expense' THEN ABS(amount))` 天然兼容(见 §2) | T033 |

### 5. 资产/预算(新增,027 前无对应代码)

| 新增 | 动作 | 027 task |
|---|---|---|
| `accounts.type` 列 | migration + schema;存量数据 DEFAULT 'asset'(向后兼容) | T050, T051 |
| `budgets` 表 | migration + schema | T040, T041 |
| `getAssets` 查询 | 新建(CTE 聚合,含 transfer 双向余额) | T052 |

**迁移验证**:US1 合并时,本清单作为 PR 描述附件;`/speckit-implement` US4/5/6 阶段逐项对照执行。集成测试(T028 transfer / T039 budget / T048 assets)覆盖各迁移点的正确性。
