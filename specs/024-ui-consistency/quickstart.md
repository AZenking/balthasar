# Quickstart: UI 一致性补齐 验证指南 (024-ui-consistency)

**Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 前置条件

- `pnpm install` + `pnpm type-check` + `pnpm lint` + `pnpm test` 全绿(024 落地前基线)
- `pnpm dev` 运行在 `http://localhost:3000`
- 浏览器:Chrome / Safari(桌面)+ Chrome(iPhone 13 模拟,DevTools)
- 至少 1 个已登录用户 + 该家庭有:
  - ≥ 1 个账户
  - ≥ 3 个分类(含 023 自定义分类,若有)
  - ≥ 2 笔交易(确保 dashboard + 流水页有数据)

## 验证 Gate(启动前自检)

```bash
# Gate 1: 既有 6 个原子组件 + modal.tsx(023 残留)
ls src/components/ui/
# 应该返回 6 个文件:button / card / input / label / modal / skeleton

# Gate 2: components.json 不存在(024 创建前)
ls components.json 2>&1 | grep -q "No such" && echo "OK: components.json 未创建"

# Gate 3: type-check / lint / test 全绿
pnpm type-check && pnpm lint && pnpm test
```

3 个 gate 全通过才能开始以下场景验证。

---

## 验证 US1: shadcn 原语沉淀 + token 补全

**对应 spec US1 + FR-001..FR-005 + C1-C12 契约**

### 场景 1.1: 9 个原语文件全部沉淀

```bash
ls src/components/ui/{dialog,select,tabs,popover,radio-group,checkbox,command,tooltip,alert-dialog}.tsx
```
**预期**:返回 9 行(每个文件存在)。

### 场景 1.2: components.json 创建

```bash
cat components.json | head -5
```
**预期**:合法 JSON,含 `$schema` / `style` / `tailwind.css: "src/app/globals.css"` / `aliases.ui: "@/components/ui"`(详见 [data-model.md §二](./data-model.md#二componentsjsonus1-前置配置))。

### 场景 1.3: globals.css token 补全

```bash
grep -E "^\s*--color-(popover|secondary)" src/app/globals.css
```
**预期**:返回 ≥4 行(`popover` / `popover-foreground` / `secondary` / `secondary-foreground`)。

### 场景 1.4: button.tsx destructive variant

```bash
grep "destructive" src/components/ui/button.tsx
```
**预期**:返回 ≥1 行(`destructive: "bg-destructive ..."` in buttonVariants)。

### 场景 1.5: type-check + lint + test 全绿

```bash
pnpm type-check && pnpm lint && pnpm test
```
**预期**:0 错误,既有 6 个原子组件测试 0 回归(FR-005)。

### 场景 1.6: 浏览器冒烟测试(任意页面渲染无错)

1. 打开 `/dashboard`(或任意 app 路由)
2. **预期**:页面正常渲染,无 console error / warning 关于 missing Radix provider 或 token
3. 打开 `/settings/categories`(023 路由,US2 迁移前)
4. **预期**:页面正常,023 仍能工作(US2 还没改,但 ui/ 新原语不影响)

**Checkpoint**: US1 完成 = 9 个原语 + components.json + token + destructive 全部就绪,但 US2 还没消费它们。**此处可独立 commit/PR**(MVP 阶段 1)。

---

## 验证 US2: 023 分类管理 UI 迁移

**对应 spec US2 + FR-006..FR-014 + C13-C16 契约**

### 场景 2.1: 新增分类 Dialog(shadcn,非自造 Modal)

1. 打开 `/settings/categories`
2. 点"新增分类"按钮
3. **预期**:弹出 shadcn `Dialog`:
   - DOM 检查:`<div role="dialog">`(而非自造 div)
   - 标题"新增分类"在 DialogHeader / DialogTitle
   - 焦点自动落到表单首字段(name Input)
   - Esc 关闭
   - 点击遮罩关闭
   - body 滚动锁定

### 场景 2.2: emoji-picker Popover + Tabs

1. 在新增分类表单中,点击 emoji 触发器(显示"选图标"或当前 emoji)
2. **预期**:弹出 shadcn `Popover`:
   - DOM 检查:`<div role="dialog">`(Popover non-modal)
   - 内含搜索 Input + shadcn `Tabs`(role="tablist")+ grid
   - Tab 切换:点"食物" → 显示食物 emoji;点"交通" → 显示交通 emoji
   - 键盘 ←→ 在 Tabs 间切换
   - Esc 关闭 popover(不影响 Dialog)

### 场景 2.3: RadioGroup type 字段

1. 在新增分类表单中,查看 type 字段(支出/收入)
2. **预期**:shadcn `RadioGroup`:
   - DOM 检查:`<div role="radiogroup">` 含 2 个 `<button role="radio">`
   - 键盘 Tab 聚焦后,↓↑ 在两个 radio 间切换
   - Space 选中当前聚焦的 radio

### 场景 2.4: Select parent 字段

1. 在新增分类表单中,点击 parent 字段
2. **预期**:shadcn `Select`:
   - DOM 检查:`<button role="combobox">`
   - 点击后弹出 `<div role="listbox">` 含 `<option role="option">` × N
   - 键盘 ↓↑ Enter Esc 工作
   - 选择后 SelectTrigger 显示已选值

### 场景 2.5: Checkbox "显示已归档"

1. 在 CategoryManager 顶部,勾选"显示已归档"
2. **预期**:shadcn `Checkbox`:
   - DOM 检查:`<button role="checkbox" aria-checked="true|false">`
   - 点击切换 checked 状态
   - 列表过滤(已归档分类显示/隐藏)
   - 键盘 Space 切换

### 场景 2.6: modal.tsx 删除验证

```bash
ls src/components/ui/modal.tsx 2>&1 | grep -q "No such" && echo "OK: modal.tsx 已删除"
grep -rE 'from "@/components/ui/modal"|import.*Modal' src/components/settings/
```
**预期**:第 1 行输出 `OK: modal.tsx 已删除`;第 2 行返回 0 匹配。

### 场景 2.7: 023 6 US quickstart 回归

跑 `specs/023-category-ui/quickstart.md` 全部 6 US Acceptance Scenario:
- US1 列表查看 + type/includeArchived 切换
- US2 新增分类(含重名 / 200 上限)
- US3 编辑分类(含 FR-008..014 限制)
- US4 归档/反归档(级联 + optimistic + toast)
- US5 拖拽排序
- US6 交易表单 categoryId 下拉(008 transaction-form,不动)

**预期**:100% 通过(FR-012 行为零回归)。

### 场景 2.8: a11y tree 抽查

1. 打开 `/settings/categories`,Chrome DevTools → Elements → Accessibility 树
2. 点"新增分类"
3. **预期**:Accessibility 树显示 `dialog` / `form` / `radiogroup` / `radio` / `combobox` / `checkbox` 等正确 role,而非裸 `button` / 杂散 `radio`(FR-013)

**Checkpoint**: US2 完成 = 023 全部 6 US 行为零回归 + shadcn 原语消费 + modal.tsx 删除。**此处可独立 commit/PR**(MVP 阶段 2)。

---

## 验证 US3: BottomNav 图标统一

**对应 spec US3 + FR-015..FR-019 + C17 契约**

### 场景 3.1: 4 个图标 DOM 检查

1. 打开任意 `(app)` 路由(如 `/dashboard`)
2. DevTools Elements 检查 BottomNav
3. **预期**:4 个 tab 的图标均为 `<svg>` 元素(lucide-react 渲染),无 emoji 字符(📊 📋 ✏️ ⚙️)
4. 验证 class:`<svg class="h-5 w-5 ... lucide-*" aria-hidden="true">`

### 场景 3.2: active state 颜色不变

1. 在 `/dashboard`(active tab)
2. **预期**:`首页` tab 文字 + 图标为 `text-primary`(深色)
3. 其他 3 个 tab 为 `text-muted-foreground hover:text-foreground`
4. 点击"流水" → active 切换到 `/transactions`,`流水` tab 变 primary,首页变 muted

### 场景 3.3: 跨平台视觉一致(SC-004)

1. macOS Safari 打开 `/dashboard`,截图 BottomNav
2. Windows Chrome(或 DevTools 模拟)打开同页,截图
3. Android Chrome(DevTools iPhone 13 模拟)打开同页,截图
4. **预期**:3 个截图的 BottomNav 图标视觉一致(无 emoji 字体回退差异)

### 场景 3.4: a11y 抽查(VoiceOver / NVDA)

1. macOS VoiceOver(⌘F5)打开 `/dashboard`
2. 焦点移到 BottomNav
3. **预期**:VoiceOver 读出"首页,链接 / 流水,链接 / 记账,链接 / 设置,链接"(因 `<span>{label}</span>` + 图标 `aria-hidden`),**不读**"图形"或 emoji 名

### 场景 3.5: 全工程功能性 emoji 检查

```bash
grep -rE '[📊📋✏️⚙️🔑💸💰]' src/components/ src/app/
```
**预期**:0 匹配(全工程功能性 UI 不再含 emoji 字符;分类数据中的 emoji 如 `category.icon` 是用户内容,可能在 `lib/constants/` 等出现,不计入)。

> 注:`src/lib/constants/category-emojis.ts`(023 分类 emoji 白名单)是**数据**,不在 grep 范围(`src/components/` + `src/app/`)。

**Checkpoint**: US3 完成 = BottomNav 4 图标 lucide 化 + 跨平台一致 + a11y 正确。**此处可独立 commit/PR**(MVP 阶段 3)。

---

## 验证 Gate(收尾自检)

### Gate A: 023 既有 component tests 全绿

```bash
pnpm test:unit -- src/tests/unit/components/settings/
```
**预期**:全部通过(若 selector 调整正确;FR-014)。

### Gate B: 全工程 grep 验证

```bash
# 024 自身不要求 grep 0(025 才要求),但可抽查
grep -rE '<input type="radio"|<input type="checkbox"' src/components/settings/
```
**预期**:0 匹配(023 4 组件已迁移;024 完成时,settings slice 不再含裸 radio/checkbox)。

> 注:全工程 0 匹配 `<select>` / `window.confirm` 是 025 的 FR-020,不是 024 的硬指标。

### Gate C: type-check + lint + test 全绿

```bash
pnpm type-check && pnpm lint && pnpm test
```
**预期**:0 错误(含 023 既有 procedure / integration tests 不动)。

### Gate D: 宪章 v2.0.0 第二章对齐

```bash
ls src/components/ui/{dialog,select,tabs,popover,radio-group,checkbox,command,tooltip,alert-dialog}.tsx
cat components.json | grep -E "aliases.*ui"
```
**预期**:9 个原语文件全部存在 + components.json aliases 配置正确(FR-021 + FR-022 宪章对齐)。

---

## 验证总结

| 场景 | 用户故事 | 验证类型 |
|---|---|---|
| 1.1-1.6 | US1 沉淀 9 原语 + token + destructive | 文件系统 + 浏览器冒烟 |
| 2.1-2.6 | US2 023 4 组件迁移(Dialog/Popover/Tabs/RadioGroup/Select/Checkbox) | 浏览器手动 + a11y 树 |
| 2.7 | US2 023 6 US quickstart 回归 | 浏览器手动(关键) |
| 2.8 | US2 a11y tree 抽查 | DevTools Accessibility |
| 3.1-3.5 | US3 BottomNav 图标 + 跨平台 + a11y | DOM 检查 + 截图 + VoiceOver |
| Gate A | FR-014 既有测试全绿 | Vitest |
| Gate B | settings slice 0 裸 radio/checkbox | grep |
| Gate C | type-check + lint + test | 命令行 |
| Gate D | FR-021/022 宪章对齐 | 文件系统 + 配置 |

**通过标准**:全部 19 个场景(17 浏览器/系统 + 2 gate)+ 4 个 gate A/B/C/D 通过 = feature 验收通过。

---

## 失败处理

- 若 **Gate 1**(024 落地前基线)失败:**阻塞本 feature**,先修复既有 issue。
- 若 **场景 2.7**(023 回归失败):说明迁移引入回归,**必须修复后再验证**(FR-012)。
- 若 **场景 2.6**(modal.tsx 未删除):违反 clarify Edge Case 决议 + FR-006,**必须删除**。
- 若 **场景 3.5**(BottomNav 仍含 emoji):违反 FR-015,**必须修复**。
- 若 **Gate D**(宪章对齐失败):**禁止合并**,9 个原语清单必须完整。
