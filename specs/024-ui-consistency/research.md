# Research: UI 一致性补齐 (024-ui-consistency)

**Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 决策清单

### R1: shadcn CLI 与 Next.js 16 / React 19 / Tailwind v4 兼容性 —— **优先 CLI,失败回退手动复制**

**Decision**: 启动 US1 时**先试** `pnpm dlx shadcn@latest add dialog select tabs popover radio-group checkbox command tooltip alert-dialog` + `pnpm dlx shadcn@latest init`(创建 `components.json`);若 CLI 因 Next 16 / React 19 / Tailwind v4 兼容性问题报错,**回退手动复制** shadcn 官方源码(`https://ui.shadcn.com/docs/components/<name>`)到 `src/components/ui/<name>.tsx`。

**Rationale**:
- shadcn 设计哲学是"copy-paste, you own the code" —— CLI 只是便利工具,不是必须。手动复制**等价有效**。
- shadcn CLI 在 2024-2025 期间已迭代支持 Tailwind v4 + React 19,但 Next 16 是 2025-Q4 发布,可能有滞后适配。
- 手动复制代价:每个原语 ~50-150 行源码 × 9 = 500-1500 行,30 分钟可完成(不算 import / token 调整)。
- shadcn CLI 自动处理:`components.json` 创建 / alias 配置 / Radix dep 安装 / 源码下载;节省 ~10-15 分钟。

**Decision Tree**:
```
US1 T001: 试 CLI init → 创建 components.json?
├─ 成功 → T002: 试 CLI add 9 原语 → 全部成功?
│   ├─ 全成功 → 继续 US1 后续 task(token + import)
│   └─ 部分失败 → 失败的回退手动复制
└─ 失败 → 手动创建 components.json(从官方模板)+ 手动复制 9 原语源码
```

**Alternatives Rejected**:
- ❌ 完全跳过 CLI 直接手动:可能错过 CLI 自动配置的便利,无脑增加工作量。
- ❌ 等 shadcn 官方适配 Next 16:阻塞本 feature,违反时间盒。

---

### R2: 新增 `@radix-ui/*` 依赖清单 —— **8 个 Radix 包 + 1 个 cmdk**

**Decision**: 安装以下 npm 包(随 R1 的 CLI 流程自动引入,或手动 `pnpm add` 时按此清单):

| shadcn 原语 | Radix 包 |
|---|---|
| dialog | `@radix-ui/react-dialog` |
| select | `@radix-ui/react-select` |
| tabs | `@radix-ui/react-tabs` |
| popover | `@radix-ui/react-popover` |
| radio-group | `@radix-ui/react-radio-group` |
| checkbox | `@radix-ui/react-checkbox` |
| command | `cmdk`(非 Radix,独立包) |
| tooltip | `@radix-ui/react-tooltip` |
| alert-dialog | `@radix-ui/react-alert-dialog` |

**Rationale**:
- shadcn 原语是 Radix 包装,不重新实现;依赖关系由 shadcn 官方源码 `import` 决定。
- `cmdk` 是独立项目(非 Radix),Command 原语基于它构建。
- 所有 Radix 包都是 React 19 compatible(2025-Q1 起 peer dep 放宽)。

**Alternatives Rejected**:
- ❌ 替代 cmdk 用别的 combobox 库:破坏 shadcn 标准接口。
- ❌ 不引入 Command/Tooltip/AlertDialog:违反 clarify Q1 决议(沉淀清单完整)。

---

### R3: Tailwind v4 `@theme` token 体系 —— **`--color-*` 前缀 + shadcn 源码微调**

**Decision**: 024 项目用 Tailwind v4 的 `@theme { --color-*: ... }` block(已存在),而非 shadcn 默认的 v3 `:root { --*: ... }` block。两者差异:

| 维度 | Tailwind v4(024 当前) | shadcn 默认 v3 |
|---|---|---|
| Block | `@theme { ... }` | `:root { ... }` / `.dark { ... }` |
| 前缀 | `--color-X` | `--X` |
| Tailwind class 生成 | 自动从 `--color-X` 生成 `bg-X` / `text-X` / `border-X` | 需 `tailwind.config.js` extend |
| Dark mode | 需 `.dark` class + `@theme { .dark & ... }` 嵌套 | 直接 `.dark { --X: ... }` 覆盖 |

**对接策略**:
- **shadcn 源码直接 import 可用**:因为 Tailwind v4 自动从 `--color-X` 生成对应 class(`bg-background` / `text-foreground` / `border-border`),shadcn 源码引用的 className 在 v4 体系下成立。
- **补 token**(clarify Q1):`--color-popover` / `--color-popover-foreground`(shadcn Dialog/Popover 默认引用,024 当前缺失);其他原语可能引用的 `--color-secondary` / `--color-secondary-foreground` 等也一并补(对照 shadcn 源码 grep `bg-` / `text-` 完整清单)。
- **不引入 dark 值**(独立 dark mode feature scope);dark mode 接入时只需加 `.dark` class + `@theme` 嵌套覆盖。

**Alternatives Rejected**:
- ❌ 改回 Tailwind v3 `:root` block:违反"用当前最新 stable"原则(项目已 v4)。
- ❌ 给 shadcn 源码全量 `className` 覆盖:违反 DRY + 偏离官方默认。

---

### R4: BottomNav 4 个图标具体 lucide 名 —— **LayoutDashboard / ReceiptText / PencilLine / Settings**

**Decision**:

| Tab | lucide 名 | 视觉特征 |
|---|---|---|
| 首页(/dashboard) | `LayoutDashboard` | 4 格网格,典型 dashboard 视觉 |
| 流水(/transactions) | `ReceiptText` | 收据 + 文字行,记账领域 |
| 记账(/transaction/new) | `PencilLine` | 铅笔,写账单 |
| 设置(/settings) | `Settings` | 齿轮,标准 |

**Rationale**:
- 与 spec Clarifications Q3 决议(LayoutDashboard / ReceiptText / PencilLine / Settings)**完全对齐**。
- 4 个图标均为 lucide-react `lucide-react@1.23.0` 已有(已在 023 `pnpm-lock.yaml`);若某个不存在,降级备选:`ReceiptText` → `ListOrdered`,`PencilLine` → `PenLine`。
- 视觉一致性:都是 24×24 viewBox / stroke-width 2 / 线条风格,与 023 settings/categories 卡片用的 `Tags` 风格统一。

**Alternatives Rejected**:
- ❌ "记账"用 `Plus` 圆按钮(FAB 风格):需重写 BottomNav 布局(脱离 tab 等分),破坏现有 active state 视觉。
- ❌ 用 lucide `Banknote` / `Wallet` 等做"流水":与"流水"语义弱,ReceiptText 更直接。

---

### R5: emoji-picker group 切换:shadcn Tabs vs Command —— **Tabs**

**Decision**: 用 shadcn `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent`。

**Rationale**:
- emoji-picker 当前是 ~13 个**互斥分类**(食物/交通/...),Tabs 是"互斥切换"的标准模式;Command 是"搜索 + 命令列表"模式,适合大量数据 + 模糊搜索。
- 023 emoji-picker 已经有搜索框(顶部),搜索是"跨 tab 全局搜索";如果改 Command,搜索逻辑会与 tabs 重复。
- Tabs 视觉更清晰(底部下划线指示 active tab),Command 是 popover 输入框模式,UI 占位大。
- 023 自造实现已是"按钮数组 + active 高亮"的 tabs 风格,迁移到 shadcn Tabs 几乎 1:1 映射。

**Layout 迁移**:
```
023 当前: <button 数组> + setState activeGroup
迁移后:   <Tabs value={activeGroup} onValueChange={setActiveGroup}>
          <TabsList> <TabsTrigger value="food">食物</TabsTrigger> ... </TabsList>
          <TabsContent value="food">...emoji grid...</TabsContent>
        </Tabs>
```

**Alternatives Rejected**:
- ❌ Command(cmdk):搜索模式与 tabs 重复;UI 重;YAGNI。
- ❌ 自造 select(类似 023 当前):违反 FR-008(必须用 shadcn Tabs)。

---

### R6: button.tsx destructive variant —— **加,实现一致**

**Decision**: 在既有 `src/components/ui/button.tsx` 的 `buttonVariants` map 加一条:

```ts
const buttonVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",  // 新增
  outline: "...",
  ghost: "...",
  link: "...",
};
```

**Rationale**:
- **既有 button.tsx 缺 destructive**(本次调查发现),与 shadcn 官方默认不符。
- 025 spec FR-008(AlertDialog destructive)依赖 `Button variant="destructive"`。
- globals.css 已有 `--color-destructive` + `--color-destructive-foreground`,无需补 token。
- 改动小(1 行 variant + 注释),不破坏既有 API(default 仍是 default)。

**Alternatives Rejected**:
- ❌ 在 025 实施时再补:破坏"沉淀职责单一权威"原则,025 不应承担 ui/ 修改。
- ❌ 用 className 直接 `bg-destructive`:破坏 buttonVariants token 流转。

---

### R7: Modal 删除时机与 category-manager 渐进迁移 —— **US2 单一 commit 切换 + 同 PR 内删 modal.tsx**

**Decision**: 在 US2 内,把 category-manager.tsx 的 `<Modal>` 改为 `<Dialog>` + **同一 PR / commit** 删除 `src/components/ui/modal.tsx`,避免任何中间态存在(无 dangling import 风险)。

**Rationale**:
- spec Edge Case 明确"不允许保留 modal.tsx 作为兼容垫片"。
- 当前只有 category-manager.tsx 引用 Modal(已 grep 确认),无其他文件依赖。
- 同 commit 内"改 import + 删文件"使 git diff 清晰,review 时一目了然。
- 渐进迁移(先加 Dialog,后删 Modal)会留中间态:US2 末尾若忘记删,modal.tsx 沉淀但无引用,违反"沉淀完整且消费"原则。

**Commit Structure**:
```
US2 commit:
- M src/components/ui/dialog.tsx (NEW, US1 已沉淀)
- M src/components/settings/category-manager.tsx (Modal → Dialog)
- D src/components/ui/modal.tsx (DELETE)
```

**Alternatives Rejected**:
- ❌ 渐进迁移(US2 改完 / US3 删 modal.tsx):中间态 broken,git history 难追。
- ❌ 保留 modal.tsx 作"未来用":违反 YAGNI + Edge Case 决议。

---

## 决策摘要表

| # | 决策 | 关键 |
|---|---|---|
| R1 | shadcn 沉淀路径 | CLI 优先,失败手动复制(等价有效) |
| R2 | Radix 依赖 | 8 个 `@radix-ui/*` + 1 个 `cmdk` |
| R3 | Tailwind v4 token 对接 | `--color-*` 前缀自动生成 class;补 `--color-popover` 等 |
| R4 | BottomNav 图标 | LayoutDashboard / ReceiptText / PencilLine / Settings |
| R5 | emoji-picker 切换 | shadcn Tabs(非 Command) |
| R6 | destructive variant | 加到既有 button.tsx(为 025 铺路) |
| R7 | Modal 删除时机 | US2 单 commit 切换 + 删文件,无中间态 |

**所有 NEEDS CLARIFICATION 已在 spec 阶段闭合**;本 research 是对 clarify 决议的实现细节填充,无新决策点引入。
