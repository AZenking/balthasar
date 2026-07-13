# Specification Quality Checklist: UI 一致性补齐 (shadcn 原语沉淀 + 图标统一)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-12
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Self-Validation Result: PASS (clarify 025 反哺后再次通过)

**clarify 反哺引入的变化(2026-07-12,源于 025 clarify Q1)**:
- **AlertDialog 加入沉淀清单**:FR-002 从 8 个原语扩展为 9 个(补 `alert-dialog.tsx`)。
- **SC-001 文件计数调整**:目标从 13 个(既有 6 - modal 1 + 新 8)改为 14 个(既有 6 - modal 1 + 新 9)。
- 024 自身不消费 AlertDialog,但沉淀职责要求清单完整(单一权威源,后人单看 024 spec 即可拿到完整原语清单)。

**关于"技术栈提及"的刻意保留**:
- spec 中出现了 "shadcn / Radix / lucide-react / Next.js 16 / React 19 / Tailwind v4 / Vitest / RTL" 等技术名词。
- 这**不**违反"无实现细节"原则,因为本 feature 的**核心使命就是补齐宪章 v2.0.0 第二章已声明的技术栈**(宪章本身锁定 shadcn/ui + Radix + Tailwind 为不可妥协的技术选择)。spec 是对宪章技术栈的**执行**,而非**选择**;技术名词出现在这里是描述"对齐的标的",不是"如何实现"。
- 真正被规避的实现细节:`pnpm dlx shadcn add` 命令、`@radix-ui/react-dialog` 具体版本号、文件中 JSX 代码、selector `role="dialog"` 的具体写法 —— 这些都留待 plan.md / tasks.md。

**关于 SC-005 的"间接验证"措辞**:
- 该 success criteria 不能在本 feature 验收时强制验证(它观察的是后续 feature 的实现时间)。这是刻意的 —— 重构类 feature 的 ROI 往往滞后体现。
- 已通过"不在本 feature 验收时强制"明确边界,不影响 measurable 性(前 4 个 SC 都是强 measurable 的)。

**关于 FR-022 的"宪章对齐"**:
- 这是 meta-requirement(让宪章真实成立)。表面偏弱测试性,但实际可由"末尾 grep `Modal` / 检查 `ui/` 目录文件清单 / 浏览器 a11y tree"组合验证,可执行。

### 待 plan 阶段确定的开放点(非 spec 阻塞)

1. BottomNav 4 个图标的**具体 lucide 名字**(spec 已锁定范围:`LayoutDashboard` / `ReceiptText` / `PencilLine` / `Settings` 类线条图标,plan 阶段截图对比定夺)。
2. shadcn 原语沉淀路径:**CLI** vs **手动复制源码**(取决于 Next.js 16 / React 19 / Tailwind v4 兼容性,plan 阶段实测)。
3. emoji-picker 的 ~13 个 group 切换:**shadcn `Tabs`** vs **shadcn `Command`**(搜索 + 列表场景,plan 阶段评估)。
4. 是否在迁移过程中**额外修复** 023 自造 popover 的 a11y 问题(spec 已在 Edge Cases 默认"修",但 plan 阶段需列出具体修复项)。
5. **AlertDialog 沉淀的具体执行**(clarify 反哺):虽然 024 不消费,但需在 Phase 1 沉淀 9 个原语时一并落地,plan 阶段不能遗漏。

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
