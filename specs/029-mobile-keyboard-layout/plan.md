# Implementation Plan: 029 移动端键盘弹起布局稳定性

**Branch**: `029-mobile-keyboard-layout` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-mobile-keyboard-layout/spec.md`

## Summary

针对"记一笔"底部 HeroUI Drawer 在移动端虚拟键盘弹起时遮挡输入、顶飞标题、产生 CLS 抖动的问题,引入 `visualViewport` API 驱动的两层 workaround:**聚焦字段自动 scrollIntoView** + **保存按钮键盘上方黏附**。所有 P1/P2/P3 入口(交易 Drawer、全屏交易页、账户/分类/设置/onboarding)等价达标,桌面端 0 回归。

技术路径(见 [research.md](./research.md) R1–R5):浏览器原生 `window.visualViewport` + HeroUI v3 Drawer/Modal 外层 className/style 协调(组件本身不替换,合规于宪章原则七 + spec clarification Q2)。

## Technical Context

**Language/Version**: TypeScript 5.x + React 19 + Next.js 15(App Router)

**Primary Dependencies**:
- `@heroui/react` + `@heroui/styles`(HeroUI v3,宪章 v3.2.1 锁定)
- `react-hook-form` + `zod`(既有,无新增)
- 浏览器原生 `window.visualViewport` API(无新增 npm 依赖)

**Storage**: N/A(本 feature 不涉及数据库 / 服务端 schema)

**Testing**:
- Vitest + @testing-library/react(hook 单元 + 组件测试)
- Chrome DevTools Device Emulation(iPhone 12 / Pixel 7 + Mid-Tier Mobile preset)
- 真机:iOS Safari 16+ 与 Android Chrome 最新两版本

**Target Platform**:
- 移动浏览器(iOS Safari 16+、Android Chrome 最新两版本)
- 桌面浏览器(Chrome / Firefox / Safari,回归 0 缺陷)
- PWA 安装模式与浏览器模式行为一致

**Project Type**: Web application(Next.js App Router 全栈)

**Performance Goals**:
- 聚焦字段 300ms 内进入可视区域中心(SC-001)
- 键盘过渡 200ms ease(与 iOS 键盘 250ms 动画对齐)
- 累计 CLS ≤ 0.05(SC-003)
- 端到端"打开 → 输入 → 保存"中位耗时较修复前不增加(SC-006)

**Constraints**:
- 宪章原则五 "10 秒完成一笔账"体感预算
- 宪章原则七 HeroUI v3 不可替换、不可绕过(允许外层 workaround — clarification Q2)
- 宪章原则六 YAGNI:不引入新 npm 依赖、不引入新 UI 库
- 现有 commit 96d470f 的 `viewport-fit=cover` + safe-area-inset 已是本 feature 前置

**Scale/Scope**:
- P1:TransactionDrawer 内嵌 TransactionForm(1 个文件核心改动)
- P2:`/transaction/new` + `/transaction/[id]/edit`(共享 hook + sticky bottom)
- P3:账户 / 分类 / 设置 / onboarding(共用 hook + 抽测)
- 跨 feature 共享:`useVisualViewport` + `useScrollIntoViewOnFocus`(放 `src/lib/hooks/`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

宪章 v3.2.1 七项原则逐条核对:

| # | 原则 | 状态 | 说明 |
|---|---|---|---|
| 一 | MVP 范围(不可妥协) | ✅ 通过 | 不新增 MVP 外功能;移动键盘可用性是 MVP "10 秒完成一笔"体感预算的硬性支撑,属于既有 MVP 范围内的质量加固 |
| 二 | Feature-Sliced Architecture(tRPC + Next.js App Router) | ✅ 通过 | 改动分布在 `transaction/` feature slice(TransactionDrawer / TransactionForm)+ 跨 feature 共享 hooks(`src/lib/hooks/`)。不破坏 feature 边界 |
| 三 | Domain-Driven Design | ✅ 通过 | 不动领域层 / 聚合根 / Drizzle schema。本 feature 是纯 UI/UX 修复,无服务端逻辑变化 |
| 四 | 测试优先 | ✅ 通过 | Vitest + Testing Library 覆盖 hook(`useVisualViewport` 各种 visualViewport.height 输入)+ Drawer 组件(模拟 resize 事件断言 paddingBottom 变化);真机 + DevTools 人工验收对齐 025 模式 |
| 五 | 性能与极速录入 | ✅ 通过 | spec FR-001..010 全部直接服务于 "10 秒完成一笔" 体感预算。SC-006 显式测量端到端中位耗时 |
| 六 | 简单(YAGNI) | ✅ 通过 | 0 新增 npm 依赖;`useVisualViewport` 30 行 hook + `useScrollIntoViewOnFocus` 15 行 ref callback,不引入抽象层、不引入 polyfill 库 |
| 七 | UI 调整纪律(/heroui-react skill) | ✅ 通过 | Phase 0 已调用 `/heroui-react` skill 调研 Drawer/Modal/TextArea/NumberField 官方文档(research.md R2)。HeroUI 组件**不替换、不绕过**,只在 Drawer.Body / Drawer.Footer 外层加 className/style + onFocus handler,完全符合 spec clarification Q2 决策("允许 HeroUI 外层薄薄 workaround") |

**Gate 结果**:0 项违反,**Phase 0 / Phase 1 可继续**。

无 Complexity Tracking 表项(无宪章违反需要 justify)。

## Project Structure

### Documentation (this feature)

```text
specs/029-mobile-keyboard-layout/
├── plan.md                          # This file
├── research.md                      # Phase 0 — 5 项技术决策(R1–R5)
├── data-model.md                    # Phase 1 — 无新实体,仅 UI 状态说明
├── quickstart.md                    # Phase 1 — 验证 runbook(11 节)
├── contracts/
│   └── visual-equivalence.md        # Phase 1 — 视觉/行为等价契约
├── checklists/
│   └── requirements.md              # /speckit-specify 阶段产出
└── tasks.md                         # Phase 2(/speckit-tasks 后续生成)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── hooks/
│       ├── use-visual-viewport.ts          # 新增 — visualViewport API 封装
│       └── use-scroll-into-view-on-focus.ts # 新增 — focusin 事件 + rAF + setTimeout
├── components/
│   ├── transaction/
│   │   ├── transaction-drawer.tsx          # 修改 — Drawer.Footer 加 keyboard-aware paddingBottom
│   │   └── transaction-form.tsx            # 修改 — 表单根 div 接 useScrollIntoViewOnFocus ref
│   ├── account/
│   │   └── *.tsx                            # P3 修改 — 共用 hook
│   ├── category/
│   │   └── *.tsx                            # P3 修改 — 共用 hook
│   ├── settings/
│   │   └── *.tsx                            # P3 修改 — 共用 hook
│   └── onboarding/
│       └── *.tsx                            # P3 修改 — 共用 hook
├── app/
│   ├── (app)/
│   │   ├── transaction/new/page.tsx        # P2 修改 — sticky bottom + hook
│   │   └── transaction/[id]/edit/page.tsx  # P2 修改 — sticky bottom + hook
│   └── layout.tsx                           # 不动(96d470f 已加 viewportFit=cover)
└── app/globals.css                          # 可能修改 — 加键盘相关 transition utility

tests/
├── unit/
│   ├── use-visual-viewport.test.ts         # 新增
│   └── use-scroll-into-view-on-focus.test.ts # 新增
└── components/
    └── transaction-drawer.test.tsx          # 新增 / 扩展
```

**Structure Decision**:

- **共享 hooks 放 `src/lib/hooks/`**:跨多个 feature slice 复用(Drawer + 全屏页 + P3),不属于任一单一 feature;`lib/` 是项目级 utilities 既定位置(与 `lib/trpc/`、`lib/utils.ts`、`lib/validators/` 同构)。
- **HeroUI 组件不动**:Drawer/Modal/NumberField/TextArea/Select/DatePicker 全部保留 HeroUI v3 原生,只在容器 className / inline style / onFocus 上叠加。
- **不动 `layout.tsx`**:96d470f 已经把 `viewportFit: "cover"` 落地,本 feature 在其之上叠加。
- **不动服务端**:`src/server/**` 完全不触碰。

## Complexity Tracking

> 无宪章违反需要 justify。表为空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (无) | — | — |

---

## Phase 0 / Phase 1 Outputs

- ✅ `research.md` — R1–R6 五项技术决策(`visualViewport` API / HeroUI workaround / Footer 策略 / CLS=0 / 桌面降级 / 96d470f 基线)
- ✅ `data-model.md` — 无新实体,仅 UI 状态(keyboardHeight / isKeyboardOpen / viewportOffsetTop)
- ✅ `contracts/visual-equivalence.md` — 视觉/行为 invariant + 验证流程
- ✅ `quickstart.md` — 11 节验证 runbook(P1/P2/P3 + 桌面回归 + 性能 + PR 门)

**Next**: `/speckit-tasks` 生成 `tasks.md`,按 P1 → P2 → P3 优先级切 PR。
