# Implementation Plan: UI 一致性补齐 (024-ui-consistency)

**Branch**: `024-ui-consistency` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-ui-consistency/spec.md`

## Summary

宪章 v2.0.0 第二章声明 "UI 组件 | shadcn/ui | Radix + Tailwind" 为不可妥协技术栈,但实际仓库 `src/components/ui/` 只有 6 个原子组件(button / card / input / label / modal / skeleton),`components.json` 不存在,023 实际用裸 HTML 元素 + 自造 Modal/Popover 绕开了缺失原语。本 feature 让宪章技术栈**真正落地**:

技术策略:**沉淀 9 个 shadcn 原语** + **同步补全 globals.css token**(clarify Q1) + **迁移 023 分类管理 UI 的 5 处手写实现** + **替换 BottomNav emoji 图标为 lucide-react** + **扩展既有 button.tsx 加 destructive variant**(为 025 AlertDialog 铺路)。**0 新 procedure / 0 新表 / 0 新实体**,纯前端 + UI 基础设施。

下游 feature **025-legacy-shadcn-migration** 在 024 合并 main 后启动,把剩余历史页面(008/009/010)迁移到 024 沉淀的原语上,最终让宪章"shadcn/ui 在所有页面成立"。

## Technical Context

| 维度 | 值 |
|---|---|
| **Language/Version** | TypeScript 5.x on Next.js 16 (App Router, standalone) |
| **Primary Dependencies** | React 19 / tRPC v11 + react-query / Tailwind v4 (`@theme` block + `--color-*` token) / shadcn-ui(待沉淀)/ lucide-react |
| **新增依赖** | `@radix-ui/react-{dialog,select,tabs,popover,radio-group,checkbox,tooltip,alert-dialog}` + `cmdk`(Command 原语基础);具体清单在 Phase 0 R2 决议 |
| **Storage** | N/A(纯前端) |
| **Testing** | Vitest + Testing Library(既有 023 component tests 调整 selector)+ 手动浏览器验证(023 quickstart 6 US 回归 + 本 feature quickstart) |
| **Target Platform** | Web(mobile-first responsive,Next.js standalone Docker) |
| **Project Type** | Full-stack web service(UI 基础设施 + 023 迁移部分) |
| **Performance Goals** | shadcn 原语 import 零运行时开销(纯组件)/ Popover 打开 P95 < 100ms / Dialog 打开 P95 < 100ms / BottomNav 切换 active 视觉 < 16ms(1 帧) |
| **Constraints** | **行为零回归** —— 023 quickstart 全部 Acceptance Scenario 100% 通过 / **宪章 v2.0.0 第二章对齐** —— 9 个原语 + token 补全后真正成立 |
| **Scale/Scope** | 9 个新原语文件 + 1 个 globals.css 扩展 + 1 个 button.tsx 扩展 + 4 个 023 组件迁移 + 1 个 bottom-nav 重写 + 023 modal.tsx 删除;预计 PR diff 1500-2000 行 |

无 NEEDS CLARIFICATION —— 6 个 clarify 问题已锁定(Session 1 ×4 + Session 2 ×1 + Session 3 ×1)。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | 原则 | 检查 | 状态 |
|---|---|---|---|
| 一 | MVP 范围 | 本 feature 是 UI 基础设施补齐,不属 V2+ 范围外(宪章第二章已声明 shadcn/ui 为 MVP 技术栈;023 实际未落地,本 feature 补这一缺口)。Status 标 `Draft (UI infrastructure consolidation)`。 | ✅ |
| 二 | Feature-Sliced | 9 个原语沉淀到 `src/components/ui/`(跨 slice 共享,合规);023 迁移在 `src/components/settings/` slice 内;BottomNav 在 `src/components/` 顶层(跨 slice 共享,合规)。无新 slice。 | ✅ |
| 三 | DDD | 不动 server / 不动 schema / 不动 domain;纯前端组件 + CSS token。Family 聚合不变。 | ✅ |
| 四 | Test-First | 023 既有 RTL component tests(emoji-picker / category-form / category-select)迁移后 selector 调整(FR-014);手动 quickstart 回归 023 6 US + 本 feature 4 US。不引入新测试库。 | ✅ |
| 五 | Performance & Fast Input | shadcn 原语基于 Radix,lazy mount + 无 runtime cost;Popover/Dialog 打开 < 100ms 不阻塞用户。BottomNav 切换 < 16ms 保证滑动响应。 | ✅ |
| 六 | YAGNI | (a) 不引入 dark mode(独立 feature);(b) 不重写 008-010 历史页面(025 负责);(c) Command/Tooltip/AlertDialog 三个原语 024 自身不消费,但**沉淀职责要求清单完整**(Q1 025 反哺决议),非"为未来投机",而是"宪章清单的单一权威";(d) `Modal` 删除后**不保留兼容垫片**。 | ✅ |

**Gate 结论**: 全部 6 原则 PASS,无 violation。

## Project Structure

### Documentation (this feature)

```text
specs/024-ui-consistency/
├── spec.md              # /speckit-specify + /speckit-clarify (done,3 sessions)
├── checklists/requirements.md
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1 (9 原语 + token + UI 状态机)
├── contracts/
│   └── components.md    # Phase 1 (9 个改造契约)
└── quickstart.md        # Phase 1 (验证指南)
```

### Source Code (repository root)

```text
├── components.json                            # NEW: shadcn CLI 配置(FR-001)
├── src/
│   ├── app/
│   │   └── globals.css                        # UPDATE: 补 9 原语所需 token(--popover 等)
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx                     # UPDATE: 扩展 destructive variant
│   │   │   ├── dialog.tsx                     # NEW: shadcn 原语
│   │   │   ├── select.tsx                     # NEW
│   │   │   ├── tabs.tsx                       # NEW
│   │   │   ├── popover.tsx                    # NEW
│   │   │   ├── radio-group.tsx                # NEW
│   │   │   ├── checkbox.tsx                   # NEW
│   │   │   ├── command.tsx                    # NEW
│   │   │   ├── tooltip.tsx                    # NEW
│   │   │   ├── alert-dialog.tsx              # NEW (clarify Q1 025 反哺)
│   │   │   ├── card.tsx                       # 不动
│   │   │   ├── input.tsx                      # 不动
│   │   │   ├── label.tsx                      # 不动
│   │   │   ├── skeleton.tsx                   # 不动
│   │   │   └── modal.tsx                      # DELETE: 024 US2 末尾(由 Dialog 接管)
│   │   ├── settings/
│   │   │   ├── emoji-picker.tsx               # UPDATE: 手写 popover → shadcn Popover + Tabs
│   │   │   ├── category-form.tsx              # UPDATE: 裸 radio/select → RadioGroup + Select
│   │   │   ├── category-manager.tsx           # UPDATE: Modal → Dialog;裸 checkbox → Checkbox
│   │   │   └── category-item.tsx              # UPDATE: 引用变更(若 import path 改)
│   │   └── bottom-nav.tsx                     # UPDATE: emoji 字符 → lucide-react SVG
│   └── tests/
│       └── unit/
│           └── components/
│               └── settings/
│                   ├── emoji-picker.test.tsx     # UPDATE: selector 适配
│                   ├── category-form.test.tsx    # UPDATE: selector 适配
│                   └── category-select.test.tsx  # 不动(008 transaction-form 用,024 不迁移)
```

**Structure Decision**:
- **`components.json`** 新建在仓库根(shadcn CLI 标准位置)
- **9 个 ui/ 原语** 新建在 `src/components/ui/`(与既有 5 个原子组件并列)
- **`button.tsx`** 是 UPDATE(扩展 destructive variant,不破坏既有 API)
- **`modal.tsx`** 在 US2 末尾 DELETE(由 Dialog 接管,清理 import)
- **023 4 组件 + bottom-nav** 全部 UPDATE(无新文件)
- **不动 server / schema / domain / 008 transaction-form / 009 / 010**(025 负责)

## Complexity Tracking

> 无 Constitution Check 违规,本表为空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    | -          | -                                   |

## Phase 0-1 Outline

### Phase 0: Research(research.md)

7 个决策点:
- **R1**: shadcn CLI 与 Next.js 16 / React 19 / Tailwind v4 实际兼容性(CLI 优先 vs 手动复制)
- **R2**: 新增 `@radix-ui/*` 依赖清单(9 个原语对应的 Radix 包)
- **R3**: Tailwind v4 `@theme` block token 体系(`--color-*` 前缀)与 shadcn 原语源码的对接
- **R4**: BottomNav 4 个图标具体 lucide 名(具体决策 + 视觉对比)
- **R5**: emoji-picker 的 group 切换:shadcn `Tabs` vs `Command`(spec Edge Case 留 plan 决议)
- **R6**: `button.tsx` destructive variant 实现(为 025 AlertDialog 铺路)
- **R7**: `Modal` 删除时机与 023 category-manager 渐进迁移(避免中间态 broken)

### Phase 1: Design(data-model.md + contracts/components.md + quickstart.md)

- **data-model.md**: 9 个原语清单 + globals.css token 补全清单 + 4 个迁移组件 UI 状态机 + BottomNav tabs 数据结构。
- **contracts/components.md**: 9 个契约 —— `components.json` / globals.css / button.tsx destructive / 9 个新原语文件 / emoji-picker / category-form / category-manager / category-item / bottom-nav。
- **quickstart.md**: 浏览器手动验证 4 个 US × 多场景 + 023 6 US 回归 + a11y 抽查 + 跨平台视觉对比。

### Post-Plan

- `tasks.md`: `/speckit-tasks` 生成,按 US1(9 原语 + token + button destructive)→ US2(023 迁移 5 处)→ US3(BottomNav)分解,预计 25-30 个 task。
