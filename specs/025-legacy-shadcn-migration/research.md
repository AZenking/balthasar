# Research: 历史页面 shadcn 迁移 (025-legacy-shadcn-migration)

**Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 决策清单

### R1: 024 依赖验证 —— 阻塞 gate,本 feature 启动前必须确认

**Decision**: 本 feature 启动前必须执行 `ls src/components/ui/alert-dialog.tsx src/components/ui/select.tsx src/components/ui/dialog.tsx` + `cat components.json` + `pnpm type-check` 全部通过,否则**阻塞**。024 必须先合并到 main。

**Rationale**:
- 025 spec FR-001..FR-003 明确依赖 024 沉淀的 9 个原语(含 AlertDialog,Q1 决议)。
- 024 spec 自身 US2 是迁移路径参考(023 → shadcn),证明 Select / Dialog / Popover / Tabs / RadioGroup / Checkbox 可用。
- AlertDialog 由 024 沉淀后**未被 024 消费**,因此本 feature 是 AlertDialog 的**首个消费者**,需要在 Phase 0 验证其导出符合 shadcn 官方 API(`AlertDialog` / `AlertDialogTrigger` / `AlertDialogContent` / `AlertDialogHeader` / `AlertDialogFooter` / `AlertDialogTitle` / `AlertDialogDescription` / `AlertDialogAction` / `AlertDialogCancel`)。

**Alternatives Rejected**:
- ❌ 在 024 未合并时基于 `feat/024-ui-consistency` 分支接力:增加 merge conflict 风险,违反"单一权威"。
- ❌ 在 025 内独立沉淀 AlertDialog:违反 clarify Q1 决议(单一权威沉淀归 024)。

**Blocking Condition**: 若 024 合并后实测发现 AlertDialog 未沉淀 / 不符合 shadcn 官方 API,本 feature **暂停**,先回 024 修复。

---

### R2: shadcn `Select` prop 映射 —— 标准 shadcn API

**Decision**: 裸 `<select>` + `<option>` → shadcn `Select` + 子组件:

```tsx
// BEFORE (裸)
<select value={v} onChange={e => setV(e.target.value)}>
  <option value="">全部账户</option>
  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
</select>

// AFTER (shadcn)
<Select value={v ?? ""} onValueChange={setV}>
  <SelectTrigger className="w-full"><SelectValue placeholder="全部账户" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="__all__">全部账户</SelectItem>
    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
  </SelectContent>
</Select>
```

**Rationale**:
- shadcn `Select` 基于 Radix `@radix-ui/react-select`,内置 a11y(`role="listbox"` / `aria-activedescendant` / 键盘 ↓↑ Enter Esc / 焦点陷阱)。
- `SelectValue` 的 `placeholder` 显示当 value 为 falsy 时;若用户主动选"全部",需要 `<SelectItem value="__all__">` 作为第一项 —— **Radix Select 不允许空字符串 value(024 实测)**,必须用非空 sentinel(详见 R4)。
- shadcn Select 在移动端**不**调用原生 picker,而是渲染自定义浮层(通过 Popover 实现),保证跨平台一致。

**已知差异(需在迁移时注意)**:
- 裸 `<select>` 的 `onChange` event 是 `ChangeEvent<HTMLSelectElement>`;Select 的 `onValueChange` 是 `(value: string) => void`。RHF 的 `Controller` 需要 `onChange={field.onChange}` 适配(`field.value` 是 string)。
- 裸 `<select>` 的 value 可以 `undefined`;Select 的 value 必须**非空 `string`**(Radix Select 不允许 `""` 空字符串,024 实测;需用 sentinel 如 `"__all__"`,详见 R4)。

**Alternatives Rejected**:
- ❌ shadcn `Command`(cmdk-based Combobox):更适合"搜索 + 复杂数据结构"场景(如 023 的 CategorySelect);本 feature 的 5 处 select 都是简单列表,Command over-engineering。
- ❌ 自建 select:违反宪章原则六 YAGNI,024 已沉淀 Select 原语。

---

### R3: AlertDialog destructive variant —— `AlertDialogAction asChild` + `Button variant="destructive"`

**Decision**: 用 shadcn 官方 destructive pattern(clarify Q3 决议):

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>确认删除?</AlertDialogTitle>
      <AlertDialogDescription>此操作不可撤销,该交易记录将被永久删除。</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>取消</AlertDialogCancel>
      <AlertDialogAction asChild>
        <Button variant="destructive" onClick={() => deleteMutation.mutate({ id })}>确认删除</Button>
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Rationale**:
- shadcn `AlertDialogAction` 默认是 primary 色;通过 `asChild` + `Button variant="destructive"` 渲染为红色 destructive variant。
- `AlertDialogCancel` 自动关闭 dialog 且**阻止 onClick 冒泡**(Radix 设计),无需手写 `onClick={() => setOpen(false)}`。
- `AlertDialogDescription` 文案补"此操作不可撤销"加强风险提示(行业惯例)。
- 默认焦点在 `AlertDialogCancel`(Radix 自动行为),防误触 Enter 删除。

**Alternatives Rejected**:
- ❌ 自定义 `className="bg-destructive ..."`:破坏 shadcn 主题 token 流转;应优先用 `variant="destructive"`。
- ❌ 标题区也用红色文字 + 警告 icon:过度强调(Q3 option C 已拒绝);destructive 按钮已足够。

---

### R4: "全部账户/全部分类" sentinel value —— `"__all__"`(024 实测修正)

**Decision**: 用字符串 `"__all__"` 作为 sentinel,**onValueChange 中转换为 `undefined`**(024 实测发现 Radix Select 不允许 `<SelectItem value="">` 空字符串 value)。

**Rationale**:
- **024 实测**:Radix Select 渲染空字符串 value 时 console 报错且无法稳定选中。024 PR `category-form.tsx` 已用 `PARENT_ROOT_SENTINEL = "__root__"` 修正(双下划线包裹的 sentinel 模式)。
- 025 沿用相同模式,用 `__all__`(语义:"全部账户/全部分类")。
- onValueChange: `v === "__all__" ? undefined : v` → 调用既有 procedure 时 `undefined` 表示"不筛选"(与既有 filter state `accountId?: string` 一致)。
- sentinel 不与现有账户/分类 id 冲突(它们是 uuid/cuid,不含 `__` 前缀)。
- tRPC procedure 的 input schema(既有)`accountId: z.string().optional()` —— `undefined` 直接通过 zod optional;旧逻辑中"`""` 需 filter 为 undefined"被新 sentinel 转换取代。

**Alternatives Rejected**:
- ❌ 空字符串 `""`:Radix Select 不允许(024 实测)。
- ❌ `"all"`(无双下划线):可能与人名/分类名冲突,弱保护。
- ❌ `undefined` value:Radix Select 不支持 `<SelectItem value={undefined}>`(必填 string)。

---

### R5: 010 archive/unarchive 是否引入真正 `onMutate` optimistic —— **不引入**

**Decision**: 010 archive/unarchive mutation 保持当前 **server-first** 实现(`onSuccess` 触发 invalidate + toast),**不**引入 react-query `onMutate`/`onError` rollback。spec 中"optimistic + toast"是 UX 表述,实现层等价于 server-first + 即时 toast 反馈。

**Rationale**:
- **023 实际实现也是 server-first**(`category-manager.tsx` 的 `archiveMutation` 用 `onSuccess: () => { invalidate; toast.success }`,无 `onMutate`)。本 feature 对齐 023 即"server-first + toast"。
- **真正 optimistic(onMutate + rollback)的收益场景**:用户感知到"瞬时反应"。但 archive mutation 在家庭账本场景:
  - 后端响应通常 < 100ms(本地 / 同区域 PG)
  - 用户预期"点了就会成功",失败概率低(server validation 失败 / 网络中断 < 1%)
  - 失败时 toast.error + 自动 invalidate 数据回滚已足够,不需要视觉 rollback
- **YAGNI 原则**:引入 `onMutate` 需要 cache 写入 + rollback 逻辑(~30 行/mutation × 2 mutation = 60 行),收益 < 成本。
- spec SC 中无"必须 optimistic"硬指标,SC-002"行为零回归"是相对迁移前,迁移前 010 archive 是 server-first + 静默,迁移后 server-first + toast,**已经是 UX 提升**。

**迁移前后对比**:
| 维度 | 迁移前(010) | 迁移后(010) | 023(对齐基线) |
|---|---|---|---|
| archive confirm | `window.confirm` | **无 confirm** | 无 confirm |
| archive 反馈 | 静默 | `toast.success("已归档")` | `toast.success("已归档(含 N 个子分类)")` |
| unarchive 反馈 | 静默 | `toast.success("已恢复")` | `toast.success("已恢复(含 N 个子分类)")` |
| error 反馈 | 静默 | `toast.error(err.message)` | `toast.error(err.message)` |
| mutation 模式 | server-first | server-first | server-first |

**Alternatives Rejected**:
- ❌ 引入 `onMutate` + rollback:YAGNI,增加 ~60 行代码,无 measurable UX 提升。
- ❌ 改用 Dialog confirm(保持迁移前行为):违反 clarify Q2 决议(归档=可逆=无 confirm)。

---

### R6: 010 反归档 toast 文案 —— 对齐 023("已恢复" / "恢复失败")

**Decision**: 文案锁定:

| 场景 | toast.success | toast.error |
|---|---|---|
| 010 archive | "已归档" | err.message 或 "归档失败" |
| 010 unarchive | "已恢复" | err.message 或 "恢复失败" |
| 009 delete(AlertDialog 确认后) | "已删除" | err.message 或 "删除失败" |

**Rationale**:
- 023 category-manager.tsx 已有等价文案("已归档" / "已恢复" / "归档失败" / "恢复失败");025 对齐 023 提升全工程文案一致性。
- 010 archive 不含子分类(账户无 children),toast 文案不需"含 N 个子分类"后缀;023 archive 涉及分类层级才有。
- 009 delete 当前是 `window.confirm` 后 mutate,**无 toast**;迁移后补 `toast.success("已删除")` 与归档/反归档对齐。

**Alternatives Rejected**:
- ❌ 不补 toast(保持 009 静默):违反 Q2 "UX 一致性"决议。
- ❌ 文案加 emoji(已删除 ❌):与 023 风格不符(023 无 emoji)。

---

### R7: 历史 quickstart 末尾追加格式 —— Checklist 表格 + 链接到本 feature spec

**Decision**: 在 `specs/008/009/010-*/quickstart.md` **末尾**追加"## shadcn 迁移回归验证(025)"小节,格式:

```markdown
## shadcn 迁移回归验证 (025-legacy-shadcn-migration)

> 本节由 025-legacy-shadcn-migration 追加(2026-07-12),用于验证 shadcn 原语迁移后行为零回归。
> 既有验收场景保持不变;本节仅追加迁移相关检查项。

### 迁移点

| 控件 | 迁移前 | 迁移后 | 验证点 |
|---|---|---|---|
| ... | ... | ... | ... |

### 验证 Checklist

- [ ] 控件 1 在浏览器渲染为 shadcn 浮层(非原生 picker)
- [ ] 键盘 ↓↑ Enter Esc 工作
- [ ] ...
```

**Rationale**:
- **Checklist 表格** + **可勾选项**比散文更易验证,与 023 quickstart 风格一致。
- **末尾追加**(不修改既有内容)符合 FR-016"保留历史可追溯"。
- **链接到本 feature spec** 让读者一键回溯决策依据。
- **既有 quickstart 不重写** —— 既有截图可能展示原生 `<select>`,迁移后失效,但保留作为"迁移前状态"历史快照。

**Alternatives Rejected**:
- ❌ 重写既有 quickstart:破坏历史可追溯(FR-016 禁止)。
- ❌ 单独新建 `quickstart-migration.md`:增加文件数,违反"末尾追加"明示意图。
- ❌ 散文描述:验证者难执行,checklist 更可操作。

---

## 决策摘要表

| # | 决策 | 选项 | 影响 |
|---|---|---|---|
| R1 | 024 依赖 gate | 阻塞 until 024 main | Phase 0 启动前验证 |
| R2 | Select prop 映射 | 标准 shadcn Select API | 5 处 `<select>` 迁移基础 |
| R3 | AlertDialog destructive | `AlertDialogAction asChild` + destructive Button | 009 删除视觉 |
| R4 | "全部" sentinel | `"__all__"`(024 实测修正)| Radix Select 不允许空字符串 value |
| R5 | 010 mutation 模式 | server-first + toast(不引入 onMutate) | YAGNI |
| R6 | toast 文案 | 对齐 023 | 全工程文案一致 |
| R7 | quickstart 追加格式 | Checklist 表格 + 链接 spec | 易验证 + 可追溯 |

**所有 NEEDS CLARIFICATION 已在 spec 阶段闭合**;本 research 是对 clarify 决议的实现细节填充,无新决策点引入。
