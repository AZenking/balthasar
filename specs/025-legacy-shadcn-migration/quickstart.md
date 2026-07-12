# Quickstart: 历史页面 shadcn 迁移验证指南 (025-legacy-shadcn-migration)

**Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 前置条件

- **024-ui-consistency 已合并到 main**(本 feature 强依赖,FR-001..FR-003)
- `pnpm install` + `pnpm type-check` + `pnpm test` 全绿
- `pnpm dev` 运行在 `http://localhost:3000`
- 浏览器:Chrome / Safari(桌面)+ Chrome(iPhone 13 模拟,DevTools)
- 至少 1 个已登录用户 + 该家庭有:
  - ≥ 2 个账户(1 个活跃 + 1 个已归档)
  - ≥ 3 笔交易(支出 + 收入,涉及不同账户 / 分类)
  - 分类(含 023 自定义分类,若已迁移到 024)

## 验证 Gate(启动前自检)

```bash
# Gate 1: 024 沉淀就绪
ls src/components/ui/{select,alert-dialog,dialog,popover,tabs,radio-group,checkbox,command,tooltip}.tsx
# 应该返回 9 行(024 FR-002 清单)

# Gate 2: components.json 存在
cat components.json | head -5

# Gate 3: type-check / lint / test 全绿
pnpm type-check && pnpm lint && pnpm test
```

3 个 gate 全通过才能开始以下场景验证。

---

## 验证 US1: 008 记账表单 Select 迁移

**对应 spec US1 + FR-004..FR-006 + C1 契约**

### 场景 1.1: 新建记账 — 账户 / 分类 Select 渲染

1. 打开 `/transaction/new`
2. 点击"账户"字段
3. **预期**:弹出 shadcn `Select` 浮层(非浏览器原生 picker),含全部 active 账户列表,每项为账户名
4. 点击"分类"字段
5. **预期**:弹出 shadcn `Select` 浮层,每项为 `${icon} ${name}` 格式(如 `🍔 餐饮`)

### 场景 1.2: 键盘导航

1. 打开账户 Select 浮层
2. 按 `↓` `↑` 键
3. **预期**:高亮在选项间移动(蓝色背景)
4. 按 `Enter`
5. **预期**:选中当前高亮项 + 关闭浮层 + 触发表单 onChange
6. 重新打开浮层,按 `Esc`
7. **预期**:关闭浮层,值保持上一次选中

### 场景 1.3: 编辑模式预填

1. 从 `/transactions` 点某笔交易的"编辑"按钮 → 跳转 `/transaction/new?id=xxx`
2. **预期**:账户 / 分类 Select 显示该交易既有值(SelectValue 渲染)

### 场景 1.4: 校验失败保留值

1. 新建记账表单,选择账户 + 分类,但不填金额
2. 点"保存"
3. **预期**:金额字段红字提示"请输入金额";账户 + 分类 Select 保持已选状态

### 场景 1.5: 008 既有 quickstart 回归

跑 `specs/008-transaction-ui/quickstart.md` 全部既有 Acceptance Scenario,所有步骤 100% 通过(除"原生 select picker"相关步骤按 R2 自动更新)。

---

## 验证 US2: 009 流水筛选 + 删除确认 AlertDialog

**对应 spec US2 + FR-007..FR-010 + C2 + C4 契约**

### 场景 2.1: 流水筛选 Select 迁移

1. 打开 `/transactions`
2. 点击"账户筛选"字段
3. **预期**:shadcn `Select` 浮层,首项为"全部账户"(value=`""`)+ 各 active 账户
4. 选某个账户 → 列表过滤
5. 重新打开,看到该账户被 `✓` 标记(选中状态)
6. 选"全部账户" → 列表恢复全量

### 场景 2.2: 分类筛选同上

重复 2.1 流程于"分类筛选"字段。

### 场景 2.3: 删除确认 AlertDialog 渲染

1. 在某笔交易行点"删除"按钮
2. **预期**:弹出 shadcn `AlertDialog`(非浏览器原生 confirm),含:
   - 标题:"确认删除?"
   - 描述:"此操作不可撤销,该交易记录将被永久删除。"
   - 两个按钮:"取消"(default 灰)+ "确认删除"(destructive 红色)
3. 检查默认焦点:按 Tab 应在"取消"按钮上(Radix 默认行为)
4. 按 `Esc`:关闭 dialog,无 mutation 触发
5. 点击遮罩(对话框外部):关闭 dialog,无 mutation 触发

### 场景 2.4: 删除确认 — 确认路径

1. 点"删除"→ AlertDialog 弹出
2. 点"确认删除"
3. **预期**:
   - 按钮文案变为"删除中..." + 禁用状态
   - "取消"按钮同时禁用(防关闭)
   - mutation 完成后:dialog 自动关闭 + 交易从列表消失 + toast"已删除"

### 场景 2.5: 删除失败 — toast 错误

(需 mock 后端失败,或在 staging 环境用受限账户测试)

1. 点"删除"→ AlertDialog 弹出
2. 点"确认删除"
3. **预期**:mutation 失败 → dialog 保持打开 + "确认删除"恢复可点击 + toast.error 显示后端错误信息

### 场景 2.6: 009 既有 quickstart 回归

跑 `specs/009-transactions-list-ui/quickstart.md` 全部既有 Acceptance Scenario,除"window.confirm 弹窗"相关步骤按本 feature 更新,其余 100% 通过。

---

## 验证 US3: 010 账户管理 Select + 归档 UX 对齐

**对应 spec US3 + FR-011..FR-014 + C3 + C5 契约**

### 场景 3.1: 新建账户 — 币种 Select

1. 打开 `/settings`
2. 点"新建账户"
3. **预期**:账户表单中币种字段为 shadcn `Select`(占位"选择币种")
4. 点击币种字段 → 浮层含 CNY / USD / EUR 等候选
5. 选 CNY → 提交 → 列表出现新账户

### 场景 3.2: 编辑账户 — 币种预填

1. 点既有账户的"编辑"按钮
2. **预期**:币种 Select 预填该账户当前币种

### 场景 3.3: 归档 — 立即触发 + toast(Q2 关键变化)

1. 找一个 active 账户,点"归档"按钮
2. **预期**:
   - **不弹**任何 confirm 对话框(取消 `window.confirm`,Q2 决议)
   - 账户立即从"活跃"区移到"已归档"区
   - toast.success"已归档"(顶部居中,绿色)
3. 同时检查 `/dashboard`:该账户余额仍计入总资产(归档不删除)

### 场景 3.4: 反归档 — 立即触发 + toast(R6 补 toast)

1. 找一个"已归档"区账户,点"反归档"按钮
2. **预期**:
   - **不弹** confirm
   - 账户立即移回"活跃"区
   - toast.success"已恢复"
3. 对比迁移前:迁移前反归档**完全静默**(无 toast),迁移后有 toast

### 场景 3.5: 归档失败 — toast 错误

(需 mock 后端失败,如 server validation)

1. 点"归档"
2. **预期**:账户保持原位 + toast.error 显示后端错误信息(不出现"半归档"中间态)

### 场景 3.6: 010 既有 quickstart 回归

跑 `specs/010-settings-ui/quickstart.md` 全部既有 Acceptance Scenario,**除"确认归档? dialog"相关步骤外** 100% 通过;归档相关步骤按本 feature 更新为"点归档按钮立即归档 + toast 显示"。

---

## 验证 Gate(收尾自检)

### Gate A: 全工程 grep 0 匹配(FR-020)

```bash
grep -rE '<select|<option|window\.confirm' src/components/ src/app/
```

**预期**:返回 0 行匹配(全工程功能性 UI 不再含裸 select / window.confirm)。

> **注**:`grep -E 'window\.confirm' src/` 可能在某些 `lib/` 或测试文件中仍有匹配(非功能性 UI);若发现,需评估是否在 scope 内。本 gate 只检 `src/components/` + `src/app/`。

### Gate B: 跨平台视觉一致性(SC-004)

1. macOS Safari 打开 `/transactions` → 截图筛选 + 删除 AlertDialog
2. Windows Chrome(或 DevTools 模拟)打开同页 → 截图
3. Android Chrome(DevTools iPhone 13 模拟)打开同页 → 截图
4. **预期**:三个平台 Select 浮层 / AlertDialog 视觉一致(无 emoji 字体回退,无 OS 原生 picker)

### Gate C: a11y 抽查(SC-003)

1. macOS VoiceOver(⌘F5)打开 `/transactions`
2. 点击删除按钮
3. **预期**:VoiceOver 读出"对话框,确认删除? 此操作不可撤销..." + 焦点移到 dialog 内
4. 按 Tab 在 dialog 内循环
5. 按 Esc 关闭,VoiceOver 焦点回到删除按钮

### Gate D: 历史 quickstart 追加验证

```bash
tail -50 specs/008-transaction-ui/quickstart.md
tail -50 specs/009-transactions-list-ui/quickstart.md
tail -50 specs/010-settings-ui/quickstart.md
```

**预期**:每个文件末尾含 `## shadcn 迁移回归验证 (025-legacy-shadcn-migration)` 小节,内容为 checklist 表格(R7 格式),既有内容**未修改**(FR-016)。

---

## 验证总结

| 场景 | 用户故事 | 验证类型 |
|---|---|---|
| 1.1-1.5 | US1 记账 Select | 浏览器手动 + 008 quickstart 回归 |
| 2.1-2.6 | US2 流水筛选 + 删除 AlertDialog | 浏览器手动 + 009 quickstart 回归 |
| 3.1-3.6 | US3 账户币种 + 归档 UX 对齐 | 浏览器手动 + 010 quickstart 回归(归档步骤更新) |
| Gate A | FR-020 | 机器验证(grep 0 匹配) |
| Gate B | SC-004 | 跨平台视觉 |
| Gate C | SC-003 | a11y 抽查(VoiceOver) |
| Gate D | FR-015/FR-016 | 文档追加验证 |

**通过标准**:全部 17 个场景(15 浏览器 + 2 机器/文档 gate)+ 3 个 gate A/B/C 通过 = feature 验收通过。

---

## 失败处理

- 若 **Gate 1**(024 沉淀未就绪):**阻塞本 feature**,回 024 补齐。
- 若 **场景 1.5/2.6/3.6**(既有 quickstart 回归失败):说明迁移引入回归,**必须修复后再验证**(FR-006/FR-010/FR-014)。
- 若 **Gate A**(grep 非零):**禁止合并**,排查遗漏迁移点。
- 若 **场景 3.3/3.4**(归档/反归档未对齐 023):违反 clarify Q2 决议,**必须修复**。
