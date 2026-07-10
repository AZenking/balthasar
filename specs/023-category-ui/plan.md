# Implementation Plan: 自定义分类管理 UI (023-category-ui)

**Branch**: `feat/018-ui` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

## Summary

018-custom-category backend 已交付 7 个 tRPC procedure。本 feature 实现其前端 UI,让用户能管理自定义分类(增/编/归档/拖拽排序)并在交易表单使用自定义分类记账。与 008/009/010 模式一致(backend feature + UI feature 分开)。

技术策略:**新建 `/settings/categories` 页** + **新建 settings 组件**(category-manager / category-form / category-item / emoji-picker) + **新建 dnd 包装** + **更新 008 transaction-form 的 categoryId 下拉**(改用 `category.list` 新返回结构含 children)。最小改动面,沿用 010 的 react-hook-form + zod + tRPC client + react-query invalidate 模式。

## Technical Context

| 维度 | 值 |
|---|---|
| **Language/Version** | TypeScript 5.x on Next.js 16 (App Router, standalone) |
| **Primary Dependencies** | React 19 / tRPC v11 + react-query / react-hook-form + zod / Tailwind v4 + shadcn/ui |
| **新增依赖** | `@dnd-kit/core` + `@dnd-kit/sortable`(拖拽)/ `sonner`(toast)/ `lucide-react`(图标)/ shadcn components: dialog / select / tabs / popover / radio-group / checkbox |
| **Storage** | N/A(纯前端,数据通过 018 tRPC procedure 存取) |
| **Testing** | Vitest + Testing Library (component tests) + 手动浏览器验证 (与 008/009/010 模式一致) |
| **Target Platform** | Web (mobile-first responsive,Next.js standalone Docker) |
| **Project Type** | Full-stack web service(UI feature 部分) |
| **Performance Goals** | 列表渲染 P95 < 500ms / emoji picker < 100ms / 拖拽间隔足够 < 300ms / 拖拽全重排 < 800ms(spec SC-002..004) |
| **Constraints** | 200 上限继承 018 / 二级深度 ≤ 2 / 内置不可写 / 家庭隔离(后端已保证) |
| **Scale/Scope** | 单家庭 < 100 分类 + 22 内置 < 122 行;< 120 emoji 常量 |

无 NEEDS CLARIFICATION —— 2 个 clarify 问题已锁定(mutation 混合策略 + emoji picker 分类 tabs)。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | 原则 | 检查 | 状态 |
|---|---|---|---|
| 一 | MVP 范围 | 023 是 V1.5 UI enhancement over 018-custom-category(已合并)。不属 V2+ 范围外。Status 标 `Draft (V1.5 UI enhancement over 018)`。 | ✅ |
| 二 | Feature-Sliced | UI 组件在 `src/components/settings/` 沿用 010;新页 `src/app/(app)/settings/categories/`;更新 008 transaction-form 的下拉。所有改动在 settings / transaction slice 内。 | ✅ |
| 三 | DDD | UI 不直接操作 DB,通过 018 tRPC procedure(family 隔离由后端保证)。前端无 familyId 概念(session 派生)。 | ✅ |
| 四 | Test-First | 组件测试用 Vitest + Testing Library;手动浏览器验证覆盖 6 US。react-hook-form + zod schema 单独可测。 | ✅ |
| 五 | Performance & Fast Input | 拖拽 SLA < 300ms(间隔足够)/ < 800ms(全重排)在 SC 中定义;emoji picker < 100ms;列表 < 500ms。optimistic 更新策略保证感知性能。 | ✅ |
| 六 | YAGNI | 沿用 010/008 模式(react-hook-form + tRPC + invalidate);不引入 Redux/Zustand(react-query 已够);不实现 i18n(与 008/009/010 一致,中文硬编码);DnD 用成熟库 @dnd-kit 不自造。 | ✅ |

**Gate 结论**: 全部 6 原则 PASS,无 violation。

## Project Structure

### Documentation (this feature)

```text
specs/023-category-ui/
├── spec.md              # /speckit-specify + /speckit-clarify (done)
├── checklists/requirements.md
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1 (UI types)
├── contracts/
│   └── components.md    # Phase 1 (component contracts)
└── quickstart.md        # Phase 1 (validation guide)
```

### Source Code (repository root)

```text
src/
├── app/(app)/settings/
│   ├── page.tsx                          # UPDATE: 加"分类管理"入口卡片
│   └── categories/
│       └── page.tsx                      # NEW: /settings/categories 页
├── components/
│   ├── settings/
│   │   ├── category-manager.tsx          # NEW: 列表容器 + type 切换 + includeArchived + 新增按钮
│   │   ├── category-item.tsx             # NEW: 单行(含二级 children 缩进 + 编辑/归档/拖拽手柄)
│   │   ├── category-form.tsx             # NEW: 新增/编辑共享表单(type/name/emoji/parent/sortOrder)
│   │   └── emoji-picker.tsx              # NEW: 分类 tabs + 搜索 + grid + 选中
│   ├── category/
│   │   ├── category-select.tsx           # NEW: 008 交易表单用,显示内置+自定义+层级
│   │   └── use-category-reorder.ts       # NEW: 拖拽 hook(optimistic + 间隔耗尽 + 调 reorder)
│   └── transaction/
│       └── transaction-form.tsx          # UPDATE: categoryId 下拉改用 <CategorySelect />
├── lib/
│   ├── constants/category-emojis.ts      # EXISTING (018): 加 tab 分组元数据
│   └── validators/category.ts            # NEW: zod schema (create/update)
└── tests/
    └── unit/
        └── components/
            └── category/
                ├── emoji-picker.test.tsx  # NEW
                ├── category-form.test.tsx # NEW
                └── category-select.test.tsx # NEW
```

**Structure Decision**: 沿用 010 的 `src/components/settings/` + 008 的 `src/components/transaction/`;新建 `src/components/category/` 放跨 feature 共享的 category-select + reorder hook。零删除。

## Complexity Tracking

> 无 Constitution Check 违规,本表为空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    | -          | -                                   |
