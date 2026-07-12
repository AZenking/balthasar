# Tasks: UI 一致性补齐 (024-ui-consistency)

**Input**: Design documents from `/specs/024-ui-consistency/`(spec + plan + research + data-model + contracts/components + quickstart)

**Prerequisites**: plan.md ✅ / spec.md ✅(3 sessions clarify)/ research.md ✅ / data-model.md ✅ / contracts/components.md ✅ / quickstart.md ✅

**Tests**: ✅ 手动浏览器验证为主(与 023 模式一致);023 既有 component tests(emoji-picker / category-form / category-select)迁移后调整 selector(FR-014),非新增测试 task。

**Organization**: 按 user story 分组(US1=沉淀 / US2=023 迁移 / US3=BottomNav),Polish 阶段处理全工程验证 + a11y/跨平台抽查。

## Format: `[ID] [P?] [Story?] Description (file path)`

- **[P]**: 可并行(不同文件,无未完成依赖)
- **[Story]**: US1-US3(Setup/Polish 阶段无此 label)
- 所有 task 含**精确文件路径**
- 实现遵循 Constitution v2.0.0(Feature-Sliced + shadcn/ui + Radix + Tailwind v4)

---

## Phase 1: Setup (shadcn CLI + Radix 依赖)

**Purpose**: 创建 `components.json` + 安装 9 个原语对应的 Radix 依赖。**阻塞性**,所有 US 依赖此。

- [ ] T001 [P] Initialize shadcn CLI + create `components.json` at repo root — 执行 `pnpm dlx shadcn@latest init`(选 default style / neutral baseColor / CSS variables yes),生成 `components.json`。若 CLI 因 Next.js 16 / React 19 / Tailwind v4 兼容性失败(R1 决策树),手动 `Write` 创建 [data-model.md §二](./data-model.md#二componentsjsonus1-前置配置) 的 JSON 内容。详见 [research.md R1](./research.md#r1-shadcn-cli-与-nextjs-16--react-19--tailwind-v4-兼容性--优先-cli失败回退手动复制)。
- [ ] T002 [P] Install Radix deps — 执行 `pnpm add @radix-ui/react-{dialog,select,tabs,popover,radio-group,checkbox,tooltip,alert-dialog} cmdk`(R2 清单 8 + 1 = 9 包)。若 T001 走 CLI 路径且 shadcn add 时已自动安装,此 task 可跳过(verify via `pnpm ls @radix-ui/react-dialog`)。

**Checkpoint**: components.json 就绪 + Radix deps 安装,可进入 US1 沉淀。

---

## Phase 2: User Story 1 — 9 原语沉淀 + token + destructive (Priority: P1) 🎯 MVP

**Goal**: 在 `src/components/ui/` 沉淀 9 个 shadcn 原语文件 + 在 `globals.css` 补全原语所需 token + 在 `button.tsx` 加 destructive variant。

**Independent Test**: `ls src/components/ui/{dialog,select,tabs,popover,radio-group,checkbox,command,tooltip,alert-dialog}.tsx` 返回 9 行 + `grep -E '^\s*--color-(popover|secondary)' src/app/globals.css` 返回 ≥4 行 + `grep destructive src/components/ui/button.tsx` 返回 ≥1 行 + `pnpm type-check` 0 错误。

### Implementation

- [ ] T003 [P] [US1] Scaffold `dialog.tsx` + `alert-dialog.tsx` in `src/components/ui/` — 执行 `pnpm dlx shadcn@latest add dialog alert-dialog`(R1 CLI 优先);若失败,手动从 [shadcn 官方源码](https://ui.shadcn.com/docs/components/dialog) 复制 + 调整 `import { cn } from "@/lib/utils"`。详见 [contracts/components.md C4 + C12](./contracts/components.md#c4-c12-9-个新-ui-原语文件)。
- [ ] T004 [P] [US1] Scaffold `select.tsx` + `popover.tsx` in `src/components/ui/` — 执行 `pnpm dlx shadcn@latest add select popover`;失败手动复制。详见 [contracts C5 + C7](./contracts/components.md#c4-c12-9-个新-ui-原语文件)。
- [ ] T005 [P] [US1] Scaffold `tabs.tsx` + `radio-group.tsx` + `checkbox.tsx` in `src/components/ui/` — 执行 `pnpm dlx shadcn@latest add tabs radio-group checkbox`;失败手动复制。详见 [contracts C6 + C8 + C9](./contracts/components.md#c4-c12-9-个新-ui-原语文件)。
- [ ] T006 [P] [US1] Scaffold `command.tsx` + `tooltip.tsx` in `src/components/ui/` — 执行 `pnpm dlx shadcn@latest add command tooltip`;失败手动复制。024 自身不消费这两个原语,但**沉淀完整**(clarify Q1 025 反哺决议)。详见 [contracts C10 + C11](./contracts/components.md#c4-c12-9-个新-ui-原语文件)。
- [ ] T007 [US1] Extend `src/app/globals.css` with 4 missing tokens — 在 `@theme { ... }` block 末尾加 `--color-popover` / `--color-popover-foreground` / `--color-secondary` / `--color-secondary-foreground`(light oklch 值见 [data-model.md §三](./data-model.md#三globalscss-token-补全清单us1clarify-q1));dark 值不引入(独立 dark mode feature scope)。详见 [contracts C2](./contracts/components.md#c2-globalscss-token-扩展us1) + [research.md R3](./research.md#r3-tailwind-v4-theme-token-体系--color-前缀--shadcn-源码微调)。
- [ ] T008 [P] [US1] Add destructive variant to `src/components/ui/button.tsx` — 在 `buttonVariants` map default 之后加一行 `destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"`。既有 4 variant 不动,API 完全向后兼容。详见 [contracts C3](./contracts/components.md#c3-buttontsx-destructive-variant-扩展) + [research.md R6](./research.md#r6-buttontsx-destructive-variant--加实现一致)。
- [ ] T009 [US1] Browser smoke verify US1 — 跑 [quickstart.md "验证 US1" 场景 1.1-1.6](./quickstart.md#验证-us1-shadcn-原语沉淀--token-补全):9 原语文件清单 + components.json + 4 token grep + destructive variant grep + **原语主组件 export 验证**(`grep -cE "^export (const|function) (Dialog|AlertDialog|Select|Tabs|Popover|RadioGroup|Checkbox|Command|TooltipProvider)" src/components/ui/{dialog,alert-dialog,select,tabs,popover,radio-group,checkbox,command,tooltip}.tsx` 每文件 ≥1,FR-003)+ type-check/lint/test 全绿 + `/dashboard` 渲染无 console error。**依赖** T003-T008 全部完成。

**Checkpoint**: US1 完成,9 原语 + token + destructive 就绪,但 US2 还没消费。**此处可独立 commit/PR**(MVP 阶段 1)。

---

## Phase 3: User Story 2 — 023 迁移到 shadcn 原语 (Priority: P1) 🎯 MVP

**Goal**: emoji-picker / category-form / category-manager 迁移到 shadcn Popover/Tabs/RadioGroup/Select/Dialog/Checkbox;删除 `modal.tsx`(R7:与 category-manager 改造同 commit);调整 023 既有 component tests selector;跑 023 6 US quickstart 回归。

**Independent Test**: 浏览器打开 `/settings/categories` → 弹出 shadcn Dialog(非自造 Modal) → emoji picker 弹出 shadcn Popover + Tabs → type 字段 RadioGroup + parent 字段 Select → "显示已归档"Checkbox → 023 全部 6 US Acceptance Scenario 100% 通过 + `ls src/components/ui/modal.tsx` 不存在。

### Implementation

- [ ] T010 [P] [US2] Migrate `src/components/settings/emoji-picker.tsx` — 手写 `<button aria-expanded>` + `useState open` → shadcn `<Popover>` + `<PopoverTrigger>` + `<PopoverContent>`;group 切换 `<button>` 数组 → shadcn `<Tabs>` + `<TabsList>` + `<TabsTrigger>` + `<TabsContent>`(R5 决议 Tabs 非 Command)。详见 [contracts C13](./contracts/components.md#c13-emoji-pickertsx--popover--tabs) + [research.md R5](./research.md#r5-emoji-picker-group-切换shadcn-tabs-vs-command--tabs)。
- [ ] T011 [P] [US2] Migrate `src/components/settings/category-form.tsx` — type 字段裸 `<input type="radio">` × 2 → shadcn `<RadioGroup>` + `<RadioGroupItem>`;parent 字段裸 `<select>` + `<option>` → shadcn `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>`;RHF `<Controller>` 包裹(`onValueChange` 适配)。详见 [contracts C14](./contracts/components.md#c14-category-formtsx--radiogroup--select)。
- [ ] T012 [US2] Migrate `src/components/settings/category-manager.tsx` — (a) `<Modal>` → shadcn `<Dialog>` + `<DialogContent>` + `<DialogHeader>` + `<DialogTitle>`;(b) "显示已归档"裸 `<input type="checkbox">` → shadcn `<Checkbox>` + `<Label>`;(c) `showCreateForm` / `editingCategoryId` state 不变。详见 [contracts C15](./contracts/components.md#c15-category-managertsx--dialog--checkbox--modal-删除)。
- [ ] T013 [US2] Delete `src/components/ui/modal.tsx` — 与 T012 **同 commit**(R7 决议,避免中间态 broken)。先 `grep -r 'from "@/components/ui/modal"' src/` 应返回 0(只有 category-manager.tsx 之前引用,T012 已清理),再 `rm src/components/ui/modal.tsx`。详见 [research.md R7](./research.md#r7-modal-删除时机与-category-manager-渐进迁移--us2-单一-commit-切换--同-pr-内删-modaltsx)。
- [ ] T014 [US2] Update 023 existing component tests selectors — `src/tests/unit/components/settings/{emoji-picker,category-form}.test.tsx`(若存在):selector 从 `getByRole('button', { name: '选图标' })` 触发后 `getByRole('dialog')`、`getByRole('tab', { name: '食物' })`、`getByRole('radio', { name: '支出' })` 等适配。**禁止**删除或 skip 测试(FR-014)。详见 [contracts C13-C14 Test selectors](./contracts/components.md#测试-selector-调整汇总us2--us3)。
- [ ] T015 [US2] Browser verify US2 — 跑 [quickstart.md "验证 US2" 场景 2.1-2.8](./quickstart.md#验证-us2-023-分类管理-ui-迁移):Dialog / Popover+Tabs / RadioGroup / Select / Checkbox 行为零回归 + modal.tsx 删除 + **023 quickstart 全部 6 US 100% 通过**(FR-012 关键)+ a11y tree 抽查。**依赖** T010-T014 完成。

**Checkpoint**: US2 完成,023 6 US 行为零回归 + shadcn 原语消费 + modal.tsx 删除。**此处可独立 commit/PR**(MVP 阶段 2)。

---

## Phase 4: User Story 3 — BottomNav 图标统一 (Priority: P2)

**Goal**: `bottom-nav.tsx` 的 4 个 tab 图标从 emoji 字符(📊 📋 ✏️ ⚙️)改为 lucide-react SVG。

**Independent Test**: 浏览器打开任意 `(app)` 路由 → DevTools 检查 BottomNav → 4 个图标为 `<svg class="h-5 w-5 lucide-*" aria-hidden>` → macOS Safari / Windows Chrome / Android Chrome 三平台视觉一致 + VoiceOver 读出"首页/流水/记账/设置"而非"图形"。

### Implementation

- [ ] T016 [US3] Replace emoji icons with lucide-react in `src/components/bottom-nav.tsx` — `tabs` 数组 `icon: string`(emoji)→ `Icon: LucideIcon`(组件);渲染 `<span>{tab.icon}</span>` → `<Icon className="h-5 w-5" aria-hidden />`。4 个图标:`LayoutDashboard` / `ReceiptText` / `PencilLine` / `Settings`(R4 决议)。保留 active/inactive 配色 + tap target ≥ 44×44px。详见 [contracts C17](./contracts/components.md#c17-bottom-navtsx--emoji-字符--lucide-react) + [research.md R4](./research.md#r4-bottomnav-4-个图标具体-lucide 名--layoutdashboard--receipttext--pencilline--settings)。
- [ ] T017 [US3] Browser verify US3 — 跑 [quickstart.md "验证 US3" 场景 3.1-3.5](./quickstart.md#验证-us3-bottomnav-图标统一):DOM 检查 / active state 颜色不变 / 跨平台视觉一致 / VoiceOver a11y / 全工程功能性 emoji grep 0 匹配(FR-019)。

**Checkpoint**: US3 完成,BottomNav 4 图标 lucide 化。**此处可独立 commit/PR**(MVP 阶段 3)。

---

## Phase 5: Polish & Cross-Cutting (验证 + 收尾)

**Purpose**: 全工程质量门 + a11y/跨平台最终抽查 + PR 准备。

### Quality Gate

- [ ] T018 Final type-check + lint + test — 执行 `pnpm type-check && pnpm lint && pnpm test`,全绿后准备 PR。若 lint/test 失败,**禁止合并**,排查根因(常见:T014 测试 selector 遗漏 / T007 token 拼写错误)。
- [ ] T019 [P] Verify Constitution alignment (FR-020 + FR-021 + FR-022) — 执行 (a) `ls src/components/ui/{dialog,select,tabs,popover,radio-group,checkbox,command,tooltip,alert-dialog}.tsx` 返回 9 行;(b) `cat components.json | grep aliases.ui` 显示 `@/components/ui`;(c) `ls src/components/ui/modal.tsx 2>&1 | grep -q "No such"` 通过(modal 已删);(d) `grep -rE 'from "@/components/ui/modal"' src/` 返回 0 匹配;(e) **`git diff main..HEAD --name-only | grep -E '^src/server/'` 返回 0 匹配**(FR-021 NOT 动 server)+ **无新 procedure 文件**(FR-020 NOT 新 procedure,通过 git diff 验证 `src/server/api/routers/` 无新增)。详见 [quickstart.md Gate D](./quickstart.md#gate-d-宪章-v200-第二章对齐)。
- [ ] T020 [P] Verify settings slice zero raw radio/checkbox（隐含 FR-007..FR-011 倒推验证）— 执行 `grep -rE '<input type="radio"|<input type="checkbox"' src/components/settings/` 应返回 0 匹配（023 4 组件已迁移完成）。若发现遗漏,扩展迁移。详见 [quickstart.md Gate B](./quickstart.md#gate-b-全工程-grep-验证)。
- [ ] T021 [P] Final a11y + cross-platform audit (SC-003 + SC-004) — (a) macOS VoiceOver 抽查 `/settings/categories` Dialog/Popover/Select 焦点行为 + `/dashboard` BottomNav 读屏;(b) macOS Safari / Windows Chrome / Android Chrome(DevTools 模拟)截图对比 BottomNav + Dialog 视觉一致。详见 [quickstart.md 场景 2.8 + 3.3 + 3.4](./quickstart.md#验证-us2-023-分类管理-ui-迁移)。

**Checkpoint**: 全工程 024 闭环 + 质量门通过 → 准备开 PR + 合并 main → 025 启动。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 + T002 可并行(不同操作:CLI init vs deps install),但若 T001 走 CLI 路径成功,会自动触发 T002 的 deps 安装,T002 简化为 verify。
- **US1 (Phase 2)**: T001 → (T003 ∥ T004 ∥ T005 ∥ T006 ∥ T007 ∥ T008) → T009(4 组原语 + token + destructive 全部完成后验证)
- **US2 (Phase 3)**: T009 通过 → (T010 ∥ T011 ∥ T012) → T013(依赖 T012 改完) → T014(依赖 T010-T012 改完,跑测试) → T015(依赖 T010-T014 全完成)
- **US3 (Phase 4)**: T009 通过 → T016 → T017(可与 US2 并行,不同文件)
- **Polish (Phase 5)**: 所有 US 完成 → (T018 ∥ T019 ∥ T020 ∥ T021 可并行,不同验证维度)

### User Story Dependencies

| Story | 优先级 | 依赖 | 可并行? |
|---|---|---|---|
| US1 沉淀 | P1 🎯 MVP | Phase 1 | 是(基线) |
| US2 023 迁移 | P1 🎯 MVP | US1(消费 Dialog/Popover/Tabs/RadioGroup/Select/Checkbox) | 是(可与 US3 并行,改不同文件) |
| US3 BottomNav | P2 | US1(理论上独立,但 US1 的 destructive variant 可能间接影响) | 是(可与 US2 并行) |

### Within Each User Story

1. 沉淀 task(US1)/ 迁移 task(US2/US3)
2. 调整测试 task(US2:T014)
3. 浏览器验证 task

### Parallel Opportunities

- **Phase 1**: T001 ∥ T002(若 T001 走手动路径)
- **Phase 2**: T003 ∥ T004 ∥ T005 ∥ T006(4 组原语不同文件)+ T007(globals.css)∥ T008(button.tsx)
- **Phase 3**: T010 ∥ T011 ∥ T012(emoji-picker / category-form / category-manager 不同文件)
- **Phase 4**: 可与 Phase 3 完全并行(US3 改 bottom-nav.tsx,不冲突)
- **Phase 5**: T018 ∥ T019 ∥ T020 ∥ T021(4 个验证维度)

---

## Parallel Example: Phase 2 (US1) 全并行

```bash
# Phase 1 完成后,US1 的 6 个实施 task 全部不同文件,可同时启动:
Task: "T003 [US1] dialog.tsx + alert-dialog.tsx"
Task: "T004 [US1] select.tsx + popover.tsx"
Task: "T005 [US1] tabs.tsx + radio-group.tsx + checkbox.tsx"
Task: "T006 [US1] command.tsx + tooltip.tsx"
Task: "T007 [US1] globals.css 4 token"
Task: "T008 [US1] button.tsx destructive"

# 6 个完成后:
Task: "T009 [US1] 浏览器冒烟验证"
```

---

## Parallel Example: Phase 3 + Phase 4 并行

```bash
# US1 完成后,US2 和 US3 改不同文件,可同时启动:
Task: "T010 [US2] emoji-picker.tsx"
Task: "T011 [US2] category-form.tsx"
Task: "T012 [US2] category-manager.tsx"
Task: "T016 [US3] bottom-nav.tsx"

# 4 个完成后:
Task: "T013 [US2] 删 modal.tsx(依赖 T012)"
Task: "T014 [US2] 测试 selector(依赖 T010-T012)"
Task: "T017 [US3] 验证 US3"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1: T001 + T002(shadcn CLI + deps)~15 分钟
2. Phase 2: T003-T008(US1 沉淀)~1 小时(若 CLI 全成功,~15 分钟)
3. T009 验证 ~15 分钟
4. **STOP & VALIDATE**:9 原语 + components.json + token + destructive 就绪 → 可合并发版(MVP 阶段 1)
5. 025 可启动(消费 AlertDialog + Select)

### Incremental Delivery

1. Foundation → CLI + deps 就绪 ✅
2. + US1 → 9 原语 + token + destructive ✅(可独立合并)
3. + US2 → 023 迁移 + modal 删除 ✅(可独立合并)
4. + US3 → BottomNav 图标统一 ✅(可独立合并)
5. Polish → 全工程验证 + a11y + 跨平台 ✅

### Suggested Commit Cadence

- T001 + T002: 1 commit(`chore(024): shadcn CLI init + Radix deps`)
- T003-T008 + T009: 1 commit(`feat(024): US1 沉淀 9 原语 + token + destructive`)
- T010-T015: 1 commit(`feat(024): US2 023 迁移到 shadcn 原语 + 删 modal.tsx`)
- T016 + T017: 1 commit(`feat(024): US3 BottomNav 图标 lucide 化`)
- T018-T021: 1 commit(`chore(024): 全工程验证 + a11y + 跨平台收尾`)

共 5 个 commit。**或合并为 1 个大 PR**(scope 适中,~1500-2000 行 diff)。

---

## Notes

- **强依赖无**:024 不依赖其他 feature(025 反向依赖 024)。但 024 应**先于** 025 合并 main。
- **shadcn CLI 兼容性风险**:若 Next.js 16 / React 19 / Tailwind v4 导致 CLI 全失败,T003-T006 走手动复制路径(R1 决策树),时间从 ~15 分钟增加到 ~1 小时。
- **测试不新增**:023 已有 component tests 调整 selector(T014);US1 沉淀的原语由 US2 实际消费时验证(无独立单测)。
- **Radix a11y 是副产出**:迁移到 Radix 后自动获得 dialog/popover/select 等正确 ARIA role + 焦点陷阱 + 键盘导航,不需要额外 a11y 测试套件(T021 抽查即可)。
- **不动 server / 008-010 / category-select**:FR-017/018/019 + spec Out of Scope 锁定。
- **modal.tsx 必须删**:R7 + spec Edge Case 决议,**禁止**保留为兼容垫片。

## Format Validation

- ✅ 所有 task 含 `- [ ]` checkbox
- ✅ 所有 task 含 T001-T021 顺序 ID
- ✅ 所有 task 含精确文件路径(`src/...` 或 `components.json`)
- ✅ Setup / Polish 阶段无 [Story] label;US 阶段含 [US1]/[US2]/[US3]
- ✅ [P] 标记的 task 严格满足"不同文件 + 无未完成依赖"
- ✅ 最大并行度:Phase 2 内 6 task 并行(T003-T008),Phase 3+4 跨 US 4 task 并行(T010-T012 + T016)
