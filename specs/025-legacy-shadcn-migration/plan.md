# Implementation Plan: 历史页面 shadcn 迁移 (025-legacy-shadcn-migration)

**Branch**: `025-legacy-shadcn-migration` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-legacy-shadcn-migration/spec.md`

## Summary

024-ui-consistency(尚待合并)沉淀 9 个 shadcn 原语到 `src/components/ui/`(dialog / select / tabs / popover / radio-group / checkbox / command / tooltip / alert-dialog),本 feature 是 024 的**纵向延伸**:把剩余历史页面(008/009/010)从裸 HTML 元素(`<select>` × 5 + `window.confirm` × 2)迁移到 shadcn 原语,让宪章 v2.0.0 第二章"UI 组件 | shadcn/ui | Radix + Tailwind"在**所有页面**代码层面真实成立。

技术策略:**7 处迁移点跨 5 个文件** + **0 新 procedure / 0 新表 / 0 新实体**。归档/反归档 UX 按 clarify Q2 决议**对齐 023**(optimistic + toast,无 confirm);删除按 clarify Q3 用 AlertDialog destructive 红色按钮。所有迁移**行为零回归**,以 008/009/010 既有 quickstart Acceptance Scenario 为验收基线(归档 confirm 步骤按 Q2 更新)。

**强依赖**:024 必须先合并到 main;本 feature 在 024 之前**阻塞**。若 024 实施中调整了 Select / AlertDialog 的 API(如 Select 改为 Command),本 plan 的 prop 映射自动跟随。

## Technical Context

| 维度 | 值 |
|---|---|
| **Language/Version** | TypeScript 5.x on Next.js 16 (App Router, standalone) |
| **Primary Dependencies** | React 19 / tRPC v11 + react-query / react-hook-form + zod / Tailwind v4 + shadcn/ui(024 沉淀) / sonner(toast) |
| **新增依赖** | **无前端 npm 依赖** —— 所有 shadcn 原语由 024 在 Phase 1 沉淀;`@radix-ui/react-alert-dialog` / `@radix-ui/react-select` 等也由 024 引入 |
| **Storage** | N/A(纯前端重构;数据通过既有 tRPC procedure 存取,**不动 server**) |
| **Testing** | Vitest + Testing Library(既有 component tests,selector 调整)+ 手动浏览器验证(008/009/010 quickstart 回归 + 本 feature quickstart) |
| **Target Platform** | Web(mobile-first responsive,Next.js standalone Docker) |
| **Project Type** | Full-stack web service(UI 重构部分) |
| **Performance Goals** | Radix Select 浮层打开 P95 < 100ms / AlertDialog 打开 P95 < 100ms;记账表单提交总耗时不超过迁移前 + 5%(spec SC-005) |
| **Constraints** | **行为零回归** —— 008/009/010 quickstart 所有既有 Acceptance Scenario 100% 通过(除 010 归档 confirm 按 Q2 更新);**全工程 0 匹配裸 select/window.confirm**(FR-020) |
| **Scale/Scope** | 7 处迁移点跨 5 个文件 + 1 个原语依赖验证 + 3 个 quickstart 末尾追加;预计 PR ≤ 1000 行 diff |

无 NEEDS CLARIFICATION —— 3 个 clarify 问题已锁定(Q1 AlertDialog 沉淀归 024 / Q2 archive=optimistic+toast + delete=AlertDialog / Q3 destructive variant)。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | 原则 | 检查 | 状态 |
|---|---|---|---|
| 一 | MVP 范围 | 本 feature 是 024 的延伸,把 shadcn/ui 落地到所有页面。不属 V2+ 范围外(宪章第二章已声明 shadcn/ui 为不可妥协技术栈,本 feature 让声明在仓库真正成立)。Status 标 `Draft (UI infrastructure consolidation)`。 | ✅ |
| 二 | Feature-Sliced | 迁移点全部在既有 slice 内(transaction / transactions / settings),无新 slice。AlertDialog 由 024 沉淀到 `ui/`(跨 slice 共享原语,合规)。 | ✅ |
| 三 | DDD | 不动 server / 不动 schema / 不动 domain;纯前端组件 + UI state。Family 聚合不变。 | ✅ |
| 四 | Test-First | 既有 component tests(selector 调整)+ 手动 quickstart 回归;无新测试库引入。Radix 自带 a11y 是迁移副产出,不需要新 a11y 测试套件。 | ✅ |
| 五 | Performance & Fast Input | Radix Select 浮层 < 100ms 打开;记账表单 SC-005 不超迁移前 +5%。AlertDialog 打开 < 100ms 不阻塞用户。optimistic + toast 改造(010)缩短归档感知延迟。 | ✅ |
| 六 | YAGNI | 不引入 i18n / 不刷新设计系统 / 不重写历史页面布局;只换控件源。AlertDialog 沉淀归 024(单一权威),025 不重复沉淀。010 archive/unarchive 实现保持 server-first(onSuccess + toast,严格不算 onMutate optimistic),UX 表述"optimistic + toast"对用户感知等价。 | ✅ |

**Gate 结论**: 全部 6 原则 PASS,无 violation。

## Project Structure

### Documentation (this feature)

```text
specs/025-legacy-shadcn-migration/
├── spec.md              # /speckit-specify + /speckit-clarify (done)
├── checklists/requirements.md
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1 (UI state machines + 复用清单)
├── contracts/
│   └── components.md    # Phase 1 (5 个改造组件契约)
└── quickstart.md        # Phase 1 (验证指南)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── ui/
│   │   └── alert-dialog.tsx         # DEPENDENCY: 024 沉淀,本 feature 复用(不修改)
│   ├── transaction/
│   │   └── transaction-form.tsx     # UPDATE: 2 处 <select> → shadcn Select
│   ├── transactions/
│   │   └── transaction-filters.tsx  # UPDATE: 2 处 <select> → shadcn Select
│   └── settings/
│       └── account-form.tsx         # UPDATE: 1 处 <select> → shadcn Select
├── app/(app)/
│   ├── transactions/
│   │   └── page.tsx                 # UPDATE: window.confirm(删除) → AlertDialog + destructive + confirm state
│   └── settings/
│       └── page.tsx                 # UPDATE: archive 取消 confirm + 加 toast;unarchive 加 toast
└── tests/
    └── unit/
        └── components/
            ├── transaction/
            │   └── transaction-form.test.tsx     # 若已存在,UPDATE selector;否则不新增
            ├── transactions/
            │   └── transaction-filters.test.tsx  # 若已存在,UPDATE selector;否则不新增
            └── settings/
                └── account-form.test.tsx         # 若已存在,UPDATE selector;否则不新增

specs/008-transaction-ui/quickstart.md     # UPDATE: 末尾追加"shadcn 迁移回归验证"小节
specs/009-transactions-list-ui/quickstart.md # UPDATE: 同上
specs/010-settings-ui/quickstart.md        # UPDATE: 同上 + 更新 archive 步骤为"立即归档 + toast"
```

**Structure Decision**:
- **不新建文件**(除 3 个 quickstart 追加)—— 5 个改造文件全部 UPDATE 既有路径。
- **不动 `src/components/ui/`** —— AlertDialog 由 024 沉淀,本 feature 只 import。
- **不动 `src/server/**`** —— 纯前端重构,FR-017 锁定。
- **tests 路径** —— 若 008/009/010 既有 component tests 存在则 UPDATE selector,不存在则不新增(spec Constitution Check 原则四"手动 quickstart 回归为主")。

## Complexity Tracking

> 无 Constitution Check 违规,本表为空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    | -          | -                                   |

## Phase 0-1 Outline

### Phase 0: Research(research.md)

7 个决策点(详见 research.md):
- **R1**: 024 依赖验证(分支 / 合并状态 / Select / AlertDialog 可用性)
- **R2**: shadcn `Select` 的 prop 映射(从裸 `<select>`+`<option>` → `SelectTrigger`+`SelectContent`+`SelectItem`)
- **R3**: shadcn `AlertDialog` destructive variant 实现(`AlertDialogAction asChild` + `Button variant="destructive"`)
- **R4**: "全部账户/全部分类"占位项的 value sentinel(空字符串 vs `__all__`)
- **R5**: 010 archive/unarchive 是否引入真正 `onMutate` optimistic(决议:不引入,保持 server-first onSuccess + toast)
- **R6**: 010 反归档 toast 文案(对齐 023:"已恢复" / "恢复失败")
- **R7**: 历史 quickstart 末尾追加格式(checklist 表格 vs 散文)

### Phase 1: Design(data-model.md + contracts/components.md + quickstart.md)

- **data-model.md**: UI state machines(`confirmingTxId` state / AlertDialog open/close / mutation 状态)+ 复用 024 ui/ 原语清单 + 货币枚举来源。
- **contracts/components.md**: 5 个改造文件的契约 —— 改前 / 改后 / 行为差异 / a11y 提升 / 测试 selector 调整。
- **quickstart.md**: 浏览器手动验证 7 个场景(US1 × 5 + US2 × 6 + US3 × 6)+ `grep` 0 匹配机器验证 + 跨平台视觉一致性观察。

### Post-Plan

- `tasks.md`: `/speckit-tasks` 生成,按 7 处迁移点 + 3 quickstart 追加 + 1 依赖验证分解,预计 12-15 个 task。
- `agents context`: 跑 `.specify/scripts/bash/update-agent-context.sh`(若存在)刷新 agent 上下文。
