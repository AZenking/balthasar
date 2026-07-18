# Implementation Plan: 031 记一笔 Drawer 键盘避让收敛 + 类型 Tabs 优化

**Branch**: `031-drawer-keyboard-and-tabs` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-drawer-keyboard-and-tabs/spec.md`

## Summary

029 已为移动端键盘避让落地两套机制(全局 `scrollIntoView` + 表单 `paddingBottom: keyboardHeight`),
但二者在 iOS Safari/PWA 上叠加:全局 `scrollIntoView` 滚动了 `position: fixed` 的 Drawer 本体
(连带 Visual Viewport),表单 `paddingBottom` 又把内容向上推,导致 Drawer 底部与键盘之间出现
空隙、背景页透出。本 feature 把两套机制**收敛为一套**——以 `Drawer.Content` 高度受
`visualViewport.height` 钳制为唯一真相源,提交按钮移入 `Drawer.Footer`,scroll 只作用于
`Drawer.Body` 内部,并对顶部类型 Tabs 做视觉收紧与 HeroUI v3 官方用法对齐。技术路径来自
`/heroui-react` skill 与 React Aria 上游 issue(adobe/react-spectrum #5926 / #7902)确认的
"HeroUI v3 无键盘感知 prop"事实。

## Technical Context

**Language/Version**: TypeScript 5.x(项目既有,见 `tsconfig.json`)

**Primary Dependencies**:
- `@heroui/react` v3(React Aria + Tailwind v4 + oklch 主题)—— Drawer / Tabs / Button 等
- `@heroui/styles` v3 —— HeroUI slot 样式注入
- `next` (App Router, RSC) —— 客户端组件 `"use client"`
- `react` 19 / `react-dom` —— hooks(`useEffect` / `useLayoutEffect` / `useRef`)
- 复用 029 既有 `useVisualViewport`(`src/lib/hooks/use-visual-viewport.ts`)

**Storage**: N/A(纯前端 UI 行为,无新表、无 tRPC procedure、无 Drizzle 改动)

**Testing**: Vitest(宪章原则四)。本 feature 以 **hook 纯函数 + 组件交互**为单测主体:
- `useVisualViewport` 的 `computeKeyboardState` 已有单测(029 T003),本 feature 若调整阈值/输出
  需同步更新。
- 新增/改造的"scroll 到 Drawer.Body 内部"逻辑 MUST 抽成纯函数便于单测。
- React 组件层(`TransactionDrawer` / `TransactionForm` embedded 分支)用 Vitest + Testing
  Library 走关键交互(聚焦 → 字段可见 → footer 可达)。
- 真机/DevTools GUI 走查(sc-001 目测无空隙、sc-003 多露一字段)为 NEEDS-MANUAL 项,
  沿用 029 baseline.md 模式。

**Target Platform**: PWA / 移动浏览器为主——iOS Safari(含 standalone PWA)、Android Chrome。
桌面端回归 0 缺陷(优雅降级为 identity)。

**Project Type**: 全栈 Web 应用(Next.js App Router)。本 feature 仅触及 `src/components/transaction/`
与 `src/lib/hooks/`,无后端改动。

**Performance Goals**: 宪章原则五"手机 10 秒完成一笔账"——本 feature 不增加热路径 JS(无新依赖),
改善的是交互稳定性而非延迟;keyboard resize 事件订阅复用 029 已有的 `useVisualViewport`,
无新增全局监听。

**Constraints**:
- 宪章原则七 MUST:任何 JSX/className/props 改动前先 `/heroui-react` 查 HeroUI v3 官方文档
  (Phase 0 research 已完成,见 research.md)。
- 不替换 HeroUI 组件、不引入新 UI 库、不回退 shadcn/cva(029 clarification Q2 既定边界)。
- 不破坏桌面端既有交易表单体验(SC-004 回归 0 缺陷)。
- CLS ≤ 0.05(029 SC-003,沿用),真机目测无抖动(SC-002)。

**Scale/Scope**: 1 个 Drawer + 1 个表单 embedded 分支 + 1 组 Tabs + 2 个既有 hook 的微调。
不触及全屏交易表单页(P2)/ 次要表单(P3),不触及后端。

## Constitution Check

*GATE: Phase 0 研究前必过。Phase 1 设计后复查。*

| 原则 | 状态 | 说明 |
|---|---|---|
| 一、MVP 范围 | ✅ 通过 | "记一笔"是 MVP 核心高频路径;Tabs 类型切换是既有功能;无新表/新路由/新范围。 |
| 二、Feature-Sliced | ✅ 通过 | 改动集中在 `src/components/transaction/` 与 `src/lib/hooks/`,纯 feature slice 内部。 |
| 三、领域驱动 | ✅ 通过 | 无领域变更(无 schema/procedure/domain)。仅 UI 行为层。 |
| 四、测试优先 | ✅ 通过(见 Testing) | hook 纯函数先测;组件交互测;真机走查 NEEDS-MANUAL。 |
| 五、性能与极速录入 | ✅ 通过 | 直接服务于"10 秒完成一笔账"——修好键盘抖动 = 保护体感预算。无新依赖、无新全局监听。 |
| 六、简单(YAGNI) | ✅ 通过 | **收敛而非新增**:删除重复的键盘补偿机制、删除全局 scrollIntoView,复杂度净下降。复用既有 `useVisualViewport`,不引入键盘感知库。 |
| 七、UI 调整纪律 | ✅ 通过(已查 skill) | Phase 0 已调 `/heroui-react` skill 取得 Drawer/Modal/Tabs v3 官方文档(research.md R2/R3/Q3),所有 className/props/slot 决策有据。 |

**无违反项。Complexity Tracking 表为空。**

## Project Structure

### Documentation (this feature)

```text
specs/031-drawer-keyboard-and-tabs/
├── plan.md              # This file
├── research.md          # Phase 0: Drawer/Modal/Tabs v3 官方文档 + 收敛决策
├── data-model.md        # Phase 1: 无持久化实体,仅行为实体清单
├── quickstart.md        # Phase 1: 真机/DevTools 走查验证指南
├── contracts/
│   └── keyboard-strategy.md   # UI 契约:Drawer 键盘避让唯一机制
└── checklists/
    └── requirements.md  # /speckit-specify 产出
```

### Source Code (repository root)

```text
src/
├── components/transaction/
│   ├── transaction-drawer.tsx     # ← Drawer.Content 高度钳制 + Footer 装载 submit
│   └── transaction-form.tsx       # ← embedded 分支重构:移除 paddingBottom 补偿,
│                                  #   Tabs className 收紧,submit 交给 Drawer.Footer
└── lib/hooks/
    ├── use-visual-viewport.ts          # ← 复用(可能补 expose visualViewport.height)
    └── use-scroll-into-view-on-focus.ts # ← 改造:只滚 Drawer.Body 自身 scrollTop
```

**Structure Decision**: 单 project web 应用(既有 Feature-Sliced 布局)。本 feature 不新增目录、
不新增文件,仅在既有 4 个文件内收敛改造。tabs 测试位于 `src/lib/hooks/__tests__/`(既有)与
`src/components/transaction/__tests__/`(若不存在则建,沿用 029 模式)。

## Complexity Tracking

> 无宪法违反项。表为空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
