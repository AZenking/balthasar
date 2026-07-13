# Tasks: 历史页面 shadcn 迁移 (025-legacy-shadcn-migration)

**Input**: Design documents from `/specs/025-legacy-shadcn-migration/`(spec + plan + research + data-model + contracts/components + quickstart)

**Prerequisites**: plan.md ✅ / spec.md ✅ / research.md ✅ / data-model.md ✅ / contracts/components.md ✅ / quickstart.md ✅ / **024-ui-consistency 已合并 main**(强依赖)

**Tests**: ✅ 手动浏览器验证为主(与 008/009/010 模式一致,既有 5 改造文件均**无** component tests 需调整);0 自动化测试 task。

**Organization**: 7 处迁移点按 user story 分组(US1=008 / US2=009 / US3=010),Polish 阶段处理 3 个 quickstart 追加 + 全工程 gate。

## Format: `[ID] [P?] [Story?] Description (file path)`

- **[P]**: 可并行(不同文件,无未完成依赖)
- **[Story]**: US1-US3(Setup/Polish 阶段无此 label)
- 所有 task 含**精确文件路径**
- 实现遵循 Constitution v2.0.0(Feature-Sliced + tRPC client + react-query + react-hook-form + shadcn/ui)

---

## Phase 1: Setup (依赖 Gate)

**Purpose**: 验证 024-ui-consistency 已合并 main + 9 个 shadcn 原语(含 AlertDialog)沉淀就绪。**阻塞性**,所有 US 依赖此。

- [ ] T001 Verify 024 dependency gate — 执行 `ls src/components/ui/{select,alert-dialog,dialog,popover,tabs,radio-group,checkbox,command,tooltip}.tsx`(应返回 9 行)+ `cat components.json`(应合法)+ `pnpm type-check && pnpm lint && pnpm test`(全绿)。详见 [quickstart.md "前置条件 + 验证 Gate"](./quickstart.md)。若 gate 失败 → **阻塞本 feature**,回 024 修复后再启动。

**Checkpoint**: 024 依赖就绪,可进入 US 实施阶段。

---

## Phase 2: User Story 1 — 008 记账表单 Select 迁移 (Priority: P1) 🎯 MVP

**Goal**: 用户在 `/transaction/new`(或 `?id=` 编辑)填表时,账户 + 分类选择从原生 `<select>` 切换为 shadcn `Select`。

**Independent Test**: 浏览器打开 `/transaction/new` → 账户/分类字段弹出 shadcn Select 浮层(非原生 picker) → 键盘 ↓↑ Enter Esc 工作 → 编辑模式预填正确 → 008 quickstart 全部回归通过。

### Implementation

- [ ] T002 [US1] Migrate accountId + categoryId `<select>` → shadcn `<Select>` in `src/components/transaction/transaction-form.tsx`(2 处,line 204-220 区域)—— 用 RHF `<Controller>` 包裹 + `SelectTrigger` + `SelectValue` + `SelectContent` + `SelectItem`;categoryId 的 SelectItem 渲染 `${icon} ${name}` 格式。详见 [contracts/components.md C1](./contracts/components.md#c1-transaction-formtsx008-transaction-ui) + [research.md R2](./research.md#r2-shadcn-select-prop-映射--标准-shadcn-api)。
- [ ] T003 [US1] Browser verify US1 — 跑 [quickstart.md "验证 US1" 场景 1.1-1.5](./quickstart.md#验证-us1-008-记账表单-select-迁移):Select 浮层渲染 / 键盘导航 / 编辑模式预填 / 校验失败保留值 / 008 既有 quickstart 回归 100% 通过(FR-006)。

**Checkpoint**: US1 完成,008 记账表单 Select 迁移就绪,无行为回归。

---

## Phase 3: User Story 2 — 009 流水筛选 + 删除 AlertDialog (Priority: P1) 🎯 MVP

**Goal**: `/transactions` 页的账户筛选 + 分类筛选换 shadcn Select;删除确认从 `window.confirm` 改 shadcn AlertDialog(destructive 红色 + confirm state + toast)。

**Independent Test**: 浏览器打开 `/transactions` → 筛选字段弹出 shadcn Select(含"全部账户/全部分类"占位) → 点删除按钮 → AlertDialog 弹出(标题"确认删除?" + 取消/确认删除红色按钮 + 默认焦点在取消) → 确认后 toast"已删除" → 009 既有 quickstart 回归通过。

### Implementation

- [ ] T004 [P] [US2] Migrate accountId + categoryId filter `<select>` → shadcn `<Select>` in `src/components/transactions/transaction-filters.tsx`(2 处,line 77-100 区域)—— 保留"全部账户/全部分类"`<SelectItem value="__all__">`(R4 sentinel,024 实测修正:Radix Select 不允许空字符串 value);onValueChange 中 `v === "__all__" ? undefined : v` 转换。详见 [contracts/components.md C2](./contracts/components.md#c2-transaction-filterstsx009-transactions-list-ui)。
- [ ] T005 [P] [US2] Replace `window.confirm` → shadcn `<AlertDialog>` + destructive + confirm state + toast in `src/app/(app)/transactions/page.tsx`(line 93-96 的 `handleDelete` + 新增 `confirmingTxId` state + import `AlertDialog*` + `Button variant="destructive"` + `toast.success("已删除")` + `toast.error` + mutation `isPending` 时禁用按钮)。详见 [contracts/components.md C4](./contracts/components.md#c4-transactionspagetsx009-删除确认-alertdialog) + [research.md R3](./research.md#r3-alertdialog-destructive-variant--alertdialogaction-aschild--button-variantdestructive) + [R6](./research.md#r6-010-反归档-toast-文案--对齐-023已恢复--恢复失败)。
- [ ] T006 [US2] Browser verify US2 — 跑 [quickstart.md "验证 US2" 场景 2.1-2.6](./quickstart.md#验证-us2-009-流水筛选--删除确认-alertdialog):2 处 Select 迁移 / AlertDialog 渲染 / Esc+遮罩取消 / 确认路径 + toast / 失败路径 toast / 009 既有 quickstart 回归(FR-010)。**依赖** T004 + T005 完成。

**Checkpoint**: US2 完成,009 流水页 Select + AlertDialog 迁移就绪。

---

## Phase 4: User Story 3 — 010 账户币种 + 归档 UX 对齐 (Priority: P2)

**Goal**: `/settings` 页的账户币种字段换 shadcn Select;归档/反归档按 clarify Q2 对齐 023(取消 confirm + 加 optimistic + toast)。

**Independent Test**: 浏览器打开 `/settings` → 新建账户表单中币种字段为 shadcn Select → 点归档按钮立即归档(无 confirm)+ toast"已归档" → 点反归档立即恢复 + toast"已恢复" → 失败路径 toast.error → 010 既有 quickstart 回归(归档步骤更新)。

### Implementation

- [ ] T007 [P] [US3] Migrate currency `<select>` → shadcn `<Select>` in `src/components/settings/account-form.tsx`(1 处,line 74-85 区域)—— RHF `<Controller>` 包裹;候选用既有 `SUPPORTED_CURRENCIES` 常量 from `@/server/domain/account/currency`(不修改清单,既有 import 保持)。详见 [contracts/components.md C3](./contracts/components.md#c3-account-formtsx010-settings-ui)。
- [ ] T008 [P] [US3] Align archive/unarchive UX with 023 in `src/app/(app)/settings/page.tsx`(line 41-56 的 archive/unarchive mutation hook + line 78-85 的 handleArchive/handleUnarchive)—— (a) 删除 `handleArchive` 中的 `window.confirm`;(b) archiveMutation onSuccess 补 `toast.success("已归档")` + `utils.dashboard.summary.invalidate()`;(c) archiveMutation 补 onError `toast.error`;(d) unarchiveMutation 同样补 toast + invalidate dashboard;(e) 文案对齐 R6 表。详见 [contracts/components.md C5](./contracts/components.md#c5-settingspagetsx010-archiveunarchive-ux-对齐) + [research.md R5](./research.md#r5-010-archiveunarchive-是否引入真正-onmutate-optimistic--不引入)。
- [ ] T009 [US3] Browser verify US3 — 跑 [quickstart.md "验证 US3" 场景 3.1-3.6](./quickstart.md#验证-us3-010-账户管理-select--归档-ux-对齐):币种 Select 渲染 + 预填 / 归档立即触发 + toast / 反归档补 toast / 失败 toast / 010 既有 quickstart 回归(归档步骤更新,FR-014)。**依赖** T007 + T008 完成。

**Checkpoint**: US3 完成,010 设置页迁移就绪。所有 7 处迁移点闭环。

---

## Phase 5: Polish & Cross-Cutting (文档 + 全工程验证)

**Purpose**: 3 个 quickstart 追加 + 全工程机器验证 + a11y/跨平台抽查 + 测试套件收尾。

### Documentation

- [ ] T010 [P] Append "shadcn 迁移回归验证 (025)" section to `specs/008-transaction-ui/quickstart.md`(末尾追加,checklist 表格格式,列出 Select 迁移点 + 键盘 / 预填 / 校验保留验证项)。详见 [research.md R7](./research.md#r7-历史-quickstart-末尾追加格式--checklist-表格--链接到本-feature-spec)。**禁止**修改既有内容(FR-016)。
- [ ] T011 [P] Append "shadcn 迁移回归验证 (025)" section to `specs/009-transactions-list-ui/quickstart.md`(末尾追加,checklist 含 Select 迁移 + AlertDialog 删除确认 destructive 视觉 + Esc/遮罩取消 + 确认/失败路径 toast)。
- [ ] T012 [P] Append "shadcn 迁移回归验证 (025)" section to `specs/010-settings-ui/quickstart.md`(末尾追加,checklist 含币种 Select 迁移 + **归档/反归档 UX 更新说明**(立即归档 + toast,无 confirm)+ 失败路径 toast)。

### Quality Gate

- [ ] T013 Verify FR-020 full-repo grep — 执行 `grep -rE '<select|<option|window\.confirm' src/components/ src/app/`,应返回 **0 匹配**。若发现新遗漏(本 feature scope 外的页面),记入 Complexity Tracking 并扩展迁移。详见 [quickstart.md "Gate A"](./quickstart.md#gate-a-全工程-grep-0-匹配fr-020)。
- [ ] T014 [P] Verify SC-003 a11y + SC-004 cross-platform — (a) macOS VoiceOver 抽查 `/transactions` 删除 AlertDialog 焦点行为;(b) macOS Safari / Windows Chrome / Android Chrome(DevTools 模拟)截图对比 Select 浮层 + AlertDialog 视觉一致。详见 [quickstart.md "Gate B + Gate C"](./quickstart.md#gate-b-跨平台视觉一致性sc-004)。
- [ ] T015 Final type-check + lint + test — 执行 `pnpm type-check && pnpm lint && pnpm test`,全绿后准备 PR。若 lint/test 失败,**禁止合并**,排查根因。
- [ ] T016 [P] Verify SC-005 US1 timing — 自我计时(因内部项目无 5 用户样本,research.md R5 区域已降级):迁移前基线 + 迁移后各跑 10 笔交易 `/transaction/new`,计时打开页面到提交的中位数,迁移后 ≤ 迁移前 + 10%(tolerance 放宽因样本量小)。记录在 PR description。详见 [spec.md SC-005](./spec.md#measurable-outcomes)。

**Checkpoint**: 全工程迁移闭环 + 文档同步 + 质量门通过 → 准备开 PR。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 阻塞所有后续;若 024 未合并 main → 全部暂停
- **US1 (Phase 2)**: T001 → T002 → T003(顺序,T003 依赖 T002)
- **US2 (Phase 3)**: T001 → (T004 ∥ T005) → T006(T004/T005 不同文件可并行,T006 依赖两者完成)
- **US3 (Phase 4)**: T001 → (T007 ∥ T008) → T009(T007/T008 不同文件可并行,T009 依赖两者完成)
- **Polish (Phase 5)**: 所有 US 完成后 → (T010 ∥ T011 ∥ T012) + (T013 → T014 ∥ T015)

### User Story Dependencies

| Story | 优先级 | 依赖 | 可并行? |
|---|---|---|---|
| US1 (008) | P1 🎯 MVP | Phase 1 | 是(基线) |
| US2 (009) | P1 🎯 MVP | Phase 1 | 是(可与 US1/US3 并行,改不同文件) |
| US3 (010) | P2 | Phase 1 | 是(可与 US1/US2 并行) |

US1/US2/US3 改造的文件**完全不重叠**(008:transaction-form / 009:transaction-filters + transactions-page / 010:account-form + settings-page),可全并行(若团队容量允许)。

### Within Each User Story

1. 实施 task(改造既有文件)
2. 浏览器手动验证(quickstart 场景)

### Parallel Opportunities

- **Phase 1**:无(T001 单 task)
- **Phase 2**:无(T002 单文件 2 处修改)
- **Phase 3**:T004 + T005(不同文件,可并行)
- **Phase 4**:T007 + T008(不同文件,可并行)
- **Phase 5**:T010 + T011 + T012(3 个不同 quickstart,可并行)+ T014 + T015 + T016(不同验证维度,可并行)

---

## Parallel Example: US2 + US3 并行

```bash
# Phase 1 完成后,US2/US3 可同时启动(不同文件):
Task: "T004 [US2] transaction-filters.tsx Select 迁移"
Task: "T005 [US2] transactions/page.tsx AlertDialog"
Task: "T007 [US3] account-form.tsx 币种 Select"
Task: "T008 [US3] settings/page.tsx archive UX 对齐"

# 等 4 个改造完成后:
Task: "T006 [US2] 浏览器验证 US2"
Task: "T009 [US3] 浏览器验证 US3"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1: T001(依赖 gate)~5 分钟
2. Phase 2: T002 + T003(US1)~1 小时
3. **STOP & VALIDATE**:008 记账表单 Select 迁移可见,无行为回归 → 可合并发版

### Incremental Delivery

1. Foundation → 024 依赖就绪 ✅
2. + US1 → 记账表单 Select 迁移 ✅
3. + US2 → 流水页 Select + 删除 AlertDialog ✅
4. + US3 → 设置页 Select + 归档 UX 对齐 ✅(全 7 处迁移点闭环)
5. Polish → 文档 + 全工程 grep gate + a11y 抽查 + 收尾 ✅

### Suggested Commit Cadence

- T001: 1 commit(可选,只是 gate 验证)
- T002 + T003: 1 commit(`feat(025): US1 transaction-form Select 迁移`)
- T004 + T005 + T006: 1 commit(`feat(025): US2 transactions-page Select + AlertDialog 删除`)
- T007 + T008 + T009: 1 commit(`feat(025): US3 settings-page Select + 归档 UX 对齐`)
- T010-T015: 1 commit(`docs(025): quickstart 追加 + 全工程 grep gate 收尾`)

共 4-5 个 commit。

---

## Notes

- **强依赖 024**:T001 失败时,本 feature 全部暂停,不能跳过 T001 启动 US
- **无新 npm 依赖**:所有 shadcn 原语 + `@radix-ui/*` 由 024 在其 US1 引入
- **无新文件**:5 个改造文件全部 UPDATE 既有路径;3 个 quickstart 在既有文件末尾追加
- **手动验证为主**:008/009/010 既有 quickstart + 本 feature quickstart 共 17 场景,均浏览器手动
- **Radix a11y 是副产出**:迁移后自动获得 combobox/alertdialog role + 键盘导航 + 焦点陷阱,不需要额外测试套件
- **023 文件不动**:FR-018 锁定,category-form / category-manager / category-item / emoji-picker 由 024 US2 处理
- **server 不动**:FR-017 锁定,纯前端重构

## Format Validation

- ✅ 所有 task 含 `- [ ]` checkbox
- ✅ 所有 task 含 T001-T015 顺序 ID
- ✅ 所有 task 含精确文件路径(`src/...` 或 `specs/...`)
- ✅ Setup / Polish 阶段无 [Story] label;US 阶段含 [US1]/[US2]/[US3]
- ✅ [P] 标记的 task 不同文件、无未完成依赖
