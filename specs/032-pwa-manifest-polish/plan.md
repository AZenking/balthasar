# Implementation Plan: 032 PWA Manifest 专业度打磨

**Branch**: `032-pwa-manifest-polish` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-pwa-manifest-polish/spec.md`

## Summary

对照市面 PWA 标准(Lighthouse PWA audit / Chrome 可安装性)核对后,当前 BALTHASAR
PWA 在**可安装性、离线、更新机制**上已达标甚至超标,但 manifest 层有 5 处专业度差距:
深色模式启动白闪(theme_color/background_color 写死 #ffffff)、id 用 `/` 不稳定、
无 shortcuts(长按快速记账)、无 screenshots(安装预览图)、192 缺 maskable。本 feature
收敛这 5 项(P1-P3),把 manifest 从"达标"打磨到"专业"。P4(离线 IndexedDB 缓存)是
产品定位决策,另开 033 spec。

## Technical Context

**Language/Version**: TypeScript 5.x + 静态 JSON(`public/manifest.webmanifest`)

**Primary Dependencies**:
- `@heroui/react` v3 + Tailwind v4 + oklch 主题 —— 主题色真相源
- Next.js App Router `viewport`/`metadata` —— `layout.tsx` 已有 `themeColor`(数组,深浅色)
- 既有 `scripts/generate-service-worker.mjs` —— SW 生成模式参考(本 feature 可能加 icon 生成脚本)
- 无新依赖(纯 manifest + 静态资源)

**Storage**: N/A(纯静态文件 + 可能的 PNG 资源,无 DB / tRPC / 领域变更)

**Testing**: Vitest。本 feature 以 **manifest 契约测试**为主:
- 既有 `src/tests/unit/pwa/manifest.test.ts` 直接读 `public/manifest.webmanifest` JSON
  断言。本 feature 改 id 会打破其 `id === "/"` 断言 → MUST 同步更新(宪章原则四)。
- 新增断言:深色 theme_color/background_color、shortcuts ≥2、screenshots ≥2、
  192 maskable purpose。
- 真机/DevTools 走查(Lighthouse PWA audit、Chrome 安装预览、Android 长按图标)为
  NEEDS-MANUAL 项,沿用 029/031 baseline.md 模式。

**Target Platform**: PWA / 移动浏览器(iOS Safari、Android Chrome)+ 桌面 Chrome/Edge。
shortcuts/screenshots 以 Android Chrome + 桌面 Chrome 为主要验收(iOS 支持弱,已知限制)。

**Project Type**: 全栈 Web 应用(Next.js App Router)。本 feature 仅触及 `public/manifest.webmanifest`
+ `src/app/layout.tsx`(可能)+ 静态图标/截图资源 + manifest 契约测试。无后端。

**Performance Goals**: 不增加运行时 JS。manifest 体积小(当前 ~700B,加 shortcuts/screenshots
后仍 < 2KB)。screenshots 是按需加载(浏览器仅在安装弹窗时请求),不计入首屏。

**Constraints**:
- 宪章原则七 MUST:本 feature 主体是 manifest 配置(非 `src/components/**/*.tsx` 的 JSX/
  className),原则上不触发原则七。但 shortcuts 的"冷启动预选类型"若需改 `TransactionForm`
  / `TransactionDrawer` / `/transaction/new` 的 JSX 或加 URL query 解析,MUST 先查
  `/heroui-react` skill。
- 不破坏既有 PWA 功能(SW 注册、离线 fallback、安装引导、更新流程)—— 回归 0 缺陷。
- 改 `id` 的迁移代价(已安装用户重复图标)在 MVP 阶段可接受(spec Q2 已记录)。

**Scale/Scope**: 1 个 manifest 文件 + 1 个契约测试 + 2-3 个新图标/截图资源 + 可能的
URL query 解析改动。不触及后端、领域、DB。

**NEEDS CLARIFICATION(交给 Phase 0 research)**:
- 深色 theme_color/background_color 的具体值(layout.tsx 已有 `#2a2a2d`,直接对齐?)
- `dark_theme_color` 字段的浏览器支持(Chrome 115+?渐进增强策略?)
- `id` 改成什么值(`balthasar`?是否必须 `/` 开头?)
- shortcuts 的 URL 指向(`/transaction/new?type=expense` 还是让 Drawer 读 query 自动开?)
- screenshots 的尺寸/数量/form_factor 规范
- 192 maskable 的生成方式(有无 icon 生成脚本?手动?)

## Constitution Check

*GATE: Phase 0 研究前必过。Phase 1 设计后复查。*

| 原则 | 状态 | 说明 |
|---|---|---|
| 一、MVP 范围 | ✅ 通过 | PWA 安装体验是既有 MVP 能力的打磨(非新功能);shortcuts 服务"10 秒记账"既定目标。无新表/新路由(可能新增 query param 解析,非新路由)。 |
| 二、Feature-Sliced | ✅ 通过 | 改动集中在 manifest(公共资源)+ 可能的 `/transaction/new` query 解析。无跨 slice 抽象。 |
| 三、领域驱动 | ✅ 通过 | 无领域变更(无 schema/procedure/domain)。纯前端呈现层。 |
| 四、测试优先 | ✅ 通过(见 Testing) | manifest 契约测试先改(红)→ 实现(绿);真机走查 NEEDS-MANUAL。 |
| 五、性能与极速录入 | ✅ 通过 | shortcuts 直接服务"10 秒记账"——长按图标直达记账入口,省 2-3 步。无运行时 JS 增加。 |
| 六、简单(YAGNI) | ✅ 通过 | 不引入 PWA 库(如 pwa-assets-generator,除非 research 证明必要);优先手动/脚本生成图标。manifest 字段只加有实测收益的。 |
| 七、UI 调整纪律 | ⚠️ 条件触发 | manifest 配置不触发;但 shortcuts 的"冷启动预选类型"若改 JSX/query 解析 MUST 先查 `/heroui-react`。Phase 1 决定是否触及 JSX。 |

**无违反项。Complexity Tracking 表为空。**

## Project Structure

### Documentation (this feature)

```text
specs/032-pwa-manifest-polish/
├── plan.md              # This file
├── research.md          # Phase 0: manifest 各字段浏览器支持 + 决策
├── data-model.md        # Phase 1: 无持久化实体,manifest 配置实体清单
├── quickstart.md        # Phase 1: Lighthouse + 真机走查验证指南
├── contracts/
│   └── manifest-fields.md   # manifest 字段契约(深色/id/shortcuts/screenshots/icons)
└── checklists/
    └── requirements.md  # /speckit-specify 产出
```

### Source Code (repository root)

```text
public/
├── manifest.webmanifest          # ← 主体改动:深色色 + 稳定 id + shortcuts + screenshots + 192 maskable
├── pwa/
│   ├── icon-192.png              # (既有,加 purpose maskable)
│   ├── icon-192-maskable.png     # ← 可能新增(若不共用 icon-192)
│   ├── icon-512.png              # (既有)
│   ├── icon-maskable-512.png     # (既有)
│   └── screenshots/              # ← 新增目录
│       ├── dashboard-mobile.png  #    窄屏截图
│       ├── dashboard-desktop.png #    宽屏截图
│       └── new-transaction.png
└── (offline.html 既有,不动)

src/
├── app/
│   ├── layout.tsx                # ← 可能微调(若 manifest 与 viewport 需对齐,或 dark_theme_color 补声明)
│   └── (app)/transaction/new/
│       └── page.tsx              # ← 可能改:读 ?type= query 预选类型(shortcuts URL 目标)
└── tests/unit/pwa/
    └── manifest.test.ts          # ← 同步更新(id 断言)+ 新增字段断言
```

**Structure Decision**: 单 project web 应用。本 feature 主体是 `public/manifest.webmanifest`
配置 + 静态资源 + 1 个契约测试。可能触及 `layout.tsx`(主题色对齐)与
`/transaction/new/page.tsx`(shortcuts 的 type query 解析),由 Phase 1 contracts 决定。
不新增目录结构(screenshots 放 `public/pwa/screenshots/`)。

## Complexity Tracking

> 无宪法违反项(Phase 0 前 + Phase 1 后双次确认)。表为空。

**Post-design 复查(research R1-R6 后)**:
- R1(单一 `background_color`)是**简化**——放弃不存在的 `dark_theme_color`,复杂度下降。
- R2(id 保持 URL 形式)是**澄清**——不引入新机制。
- R3(shortcuts 走全屏页 + `defaultType` prop)触及 JSX/props,但已在 spec FR-013 显式
  声明需查 `/heroui-react`(原则七合规),不违反。
- 无新依赖、无新表/路由、无领域变更。复杂度净下降。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
