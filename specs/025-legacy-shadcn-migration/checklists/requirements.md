# Specification Quality Checklist: 历史页面 shadcn 迁移 (008/009/010)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-12
**Feature**: [spec.md](../spec.md)
**Depends on**: `024-ui-consistency`(必须先合并)

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

### Self-Validation Result: PASS (clarify 后再次通过)

**clarify 引入的变化(2026-07-12)**:
- **Q1 决议**(AlertDialog 沉淀位置):025 不再独立沉淀,改由 024 承担。025 FR-001..FR-003 重写为"复用 024 沉淀 + 阻塞依赖"。024 FR-002 清单从 8 个原语扩展为 9 个(补 `alert-dialog.tsx`),024 SC-001 文件计数从 13 改为 14。
- **Q2 决议**(archive/delete UX 一致性):010 账户归档从 `window.confirm` → **取消 confirm + optimistic + toast**(与 023 对齐),010 反归档补 toast。009 删除保留 AlertDialog(不可逆)。**新增 FR-013**(反归档 toast)+ **FR-012 重写**(归档从 confirm 改 optimistic)。FR 编号顺移(FR-014 → FR-015..FR-021)。
- **Q3 决议**(AlertDialog destructive variant):009 删除按钮用 `Button variant="destructive"` 红色,FR-008 + US2 AS5 更新。
- **0 个 [NEEDS CLARIFICATION] 残留**(初始 spec 已闭合,clarify 只挑战默认值,无新增 NEEDS)。

**关于"技术栈提及"**:
- 与 024 spec 一致,本 feature 出现的 "shadcn / Radix / lucide-react / react-hook-form / Next.js" 都是**宪章 v2.0.0 第二章已声明的技术栈**,spec 是对宪章的**执行**(把宪章声明应用到剩余历史页面),而非**选择**。
- 真正被规避的实现细节:`Select` / `SelectTrigger` 的 prop 名字、`AlertDialogCancel` 的 `autoFocus` 写法、confirm state 的具体命名(`confirmingTxId` vs `pendingDeleteId`)—— 都留 plan.md。

**关于 024 强依赖**:
- FR-001..FR-003 假设 024 已沉淀 9 个原语(含 AlertDialog)+ `components.json`;若 024 实际交付偏差(如 AlertDialog 遗漏),本 feature 在 plan 阶段阻塞,需先回 024 补齐。
- 这是一处**真实的项目依赖**,不是 spec 不完整。

**关于"全工程 0 匹配"的 FR-020**:
- `grep -rE '<select|<option|window\.confirm' src/components/ src/app/` 是强 measurable 的验收点。
- 已通过当前 grep 确认:5 处 `<select>` + 1 处 `window.confirm(删除)` + 1 处 `window.confirm(归档)` 共 7 处迁移点(007 无匹配)。
- 风险:若 plan 阶段发现新的 `<select>`(如未来新加的页面),自动纳入本 feature scope(FR-020 是"全工程"而非"列举的 7 处")。

**关于 SC-005 的"5 用户 × 3 笔交易"**:
- 这是轻量用户测试,样本量小但可执行(可由 1 名开发者 + 2 名内部用户组成 3 人样本,tolerance 放宽到 ±10%)。
- 若实际项目无可用测试用户,plan 阶段可降级为"1 开发者 × 10 笔交易"自我计时。

### 待 plan 阶段确定的开放点(非 spec 阻塞)

1. shadcn `Select` 在长列表(~30 项)的 max-height / 滚动键盘导航具体配置。
2. 历史 quickstart 末尾"迁移回归验证"小节的具体 checklist 措辞。
3. 三个 feature(008/009/010)的迁移是**一次性单 PR** vs **拆 3 个 PR**(影响 review 节奏)。
4. 010 archive/unarchive mutation 是否需引入 `onMutate`/`onError` 真正的 optimistic update(目前 023 是 server-first onSuccess + toast,严格不算 optimistic onMutate;clarify Q2 决议描述为"optimistic + toast"是 UX 表述,实现可保持 server-first)。

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
