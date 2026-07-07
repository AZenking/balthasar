# Implementation Plan: 设置页与账户管理

**Branch**: `010-settings-ui` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-settings-ui/spec.md`

## Summary

实现 `/settings` 页面的完整前端 —— 替换当前仅有登出按钮的占位页。用户管理账户 (新建/列表/编辑/归档/取消归档) 和退出登录。纯前端 feature,复用 002-account 后端 API (create/list/update/archive/unarchive),不新增后端 API。

## Technical Context

复用 001-009 栈,无新依赖。tRPC client hooks + shadcn/ui + 原生 `<select>` (shadcn Select 组件未安装)。

**Language/Version**: TypeScript 5.x (Next.js 16 App Router)

**Primary Dependencies**: Next.js 16, tRPC v11, React 19, Tailwind CSS, shadcn/ui (button/card/input/label/skeleton)

**Storage**: N/A (纯前端,复用 002-account PostgreSQL 后端)

**Testing**: 浏览器手动验证 (与 009 模式一致)

**Target Platform**: Web (Mobile-First, 375px+)

**Project Type**: Web app (纯前端 feature)

**Performance Goals**: 设置页首次加载 ≤ 2s (SC-001);创建账户 ≤ 30s (SC-002);登出 ≤ 1s (SC-005)

**Constraints**: 不新增后端 API;不新增依赖;Mobile-First 375px 无横向滚动 (SC-003);编辑表单仅含 name+currency (002 update API 限制);已归档账户不可编辑 (002 FR-011)

**Scale/Scope**: 单页面 + 3 个组件,家庭级账户 (MVP 单成员,账户数 < 20)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | 原则 | 状态 | 说明 |
|---|---|---|---|
| 一 | MVP Scope | ✅ | /settings 页面 + 账户管理在 MVP 范围 (docs/MVP.md "能创建账户") |
| 二 | Feature-Sliced | ✅ | 单页面 + settings 组件目录,不跨 feature |
| 三 | DDD | ✅ | 纯前端,无 domain 变更,复用 002 Account 实体 |
| 四 | Test-First | ✅ | 浏览器手动验证 (与 009 一致;纯 UI feature) |
| 五 | Performance | ✅ | 首次加载 ≤ 2s;cursor 不适用 (账户数 < 20) |
| 六 | YAGNI | ✅ | window.confirm 替代 dialog;内联表单不新建页面;不新增依赖 |

**Gate Result**: ✅ ALL PASS — 无违反,无需 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/010-settings-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── (app)/
│       └── settings/
│           └── page.tsx              # **替换** 占位页 → 完整设置页
├── components/
│   └── settings/
│       ├── account-form.tsx          # **新增** 内联表单 (新建+编辑共用)
│       └── account-item.tsx          # **新增** 单行账户 (名称/币种/初始余额/操作按钮)
└── lib/
    └── (无新增 — 复用 trpc/client, utils)
```

**Structure Decision**: 纯前端,仅修改/新增 `src/app/(app)/settings/` 和 `src/components/settings/`。与 009 模式一致 (page.tsx + components/feature/)。不新增后端文件。

## Complexity Tracking

无。
