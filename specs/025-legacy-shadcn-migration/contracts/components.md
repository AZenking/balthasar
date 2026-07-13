# Component Contracts: 历史页面 shadcn 迁移 (025-legacy-shadcn-migration)

**Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 概述

本文档定义 5 个改造文件的契约:**改前 → 改后 → 行为差异 → a11y 提升 → 测试 selector 调整**。

每个契约遵循:
- **Path**: 文件路径
- **Migration scope**: 本次迁移触及的代码片段
- **Before**: 当前实现摘要
- **After**: 迁移后实现摘要
- **Behavior diff**: 用户感知差异(必须零回归 except 归档 UX 对齐)
- **a11y lift**: Radix 自带能力
- **Test selectors**: 既有 RTL 测试 selector 需调整项

---

## C1: transaction-form.tsx(008 transaction-ui)

**Path**: `src/components/transaction/transaction-form.tsx`(278 行)

**Migration scope**: 行 204-220 的账户选择 + 分类选择(2 处裸 `<select>` → 2 处 shadcn `<Select>`)。

**Before**(摘要):
```tsx
<select {...register("accountId")}>
  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
</select>
<select {...register("categoryId")}>
  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
</select>
```

**After**:
```tsx
<Controller control={control} name="accountId" render={({ field }) => (
  <Select value={field.value ?? ""} onValueChange={field.onChange}>
    <SelectTrigger><SelectValue placeholder="选择账户" /></SelectTrigger>
    <SelectContent>
      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
    </SelectContent>
  </Select>
)} />
<Controller control={control} name="categoryId" render={({ field }) => (
  <Select value={field.value ?? ""} onValueChange={field.onChange}>
    <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
    <SelectContent>
      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
    </SelectContent>
  </Select>
)} />
```

**Behavior diff**:
- ✅ 编辑模式预填行为不变(`Controller` 的 `field.value` 由 RHF 管理)
- ✅ 校验失败保留值不变(RHF 自动同步)
- ✅ 提交语义不变(`Controller` 的 `field.onChange` 写入 RHF)
- ⚠️ 货币 / 金额 / 备注 / 日期 / 类型字段**不动**

**a11y lift**: combobox role / aria-expanded / 键盘 ↓↑ Enter Esc / 焦点陷阱。

**Test selectors**:
- 既有 `screen.getByRole('combobox')`(若有)→ 保持(Select 也是 combobox role)
- `screen.getByLabelText('账户')` → 保持(`<Label>` 仍关联)
- 若用 `screen.getByRole('option', { name: '现金' })` → 需先 `await userEvent.click(trigger)` 打开浮层,再 query option(option 只在 Content 渲染时存在)

---

## C2: transaction-filters.tsx(009 transactions-list-ui)

**Path**: `src/components/transactions/transaction-filters.tsx`(105 行)

**Migration scope**: 行 77-100 的账户筛选 + 分类筛选(2 处裸 `<select>` → 2 处 shadcn `<Select>`)。

**Before**(摘要):
```tsx
<select value={filters.accountId ?? ""} onChange={e => onFilterChange({ accountId: e.target.value || undefined })}>
  <option value="">全部账户</option>
  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
</select>
<select value={filters.categoryId ?? ""} onChange={e => onFilterChange({ categoryId: e.target.value || undefined })}>
  <option value="">全部分类</option>
  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
</select>
```

**After**:
```tsx
<Select value={filters.accountId ?? "__all__"} onValueChange={v => onFilterChange({ accountId: v === "__all__" ? undefined : v })}>
  <SelectTrigger><SelectValue placeholder="全部账户" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="__all__">全部账户</SelectItem>
    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
  </SelectContent>
</Select>
<!-- 分类筛选同结构,sentinel 同 __all__ -->
```

**Behavior diff**:
- ✅ `filters.accountId === undefined`(全部)状态:Select 选中第一项 `<SelectItem value="__all__">全部账户</SelectItem>`(R4 024 实测修正,Radix Select 不允许空字符串 value)
- ✅ 切换 filter 触发 `onFilterChange` 不变(`v === "__all__" ? undefined : v` 转换)
- ✅ 跨页面 reset filter 不变
- ⚠️ 占位项必须用 `<SelectItem value="__all__">`(R4 决议),不能用 placeholder 替代 —— 因为用户需要能"显式回到全部"

**a11y lift**: 同 C1。

**Test selectors**: 同 C1。注意 sentinel value="__all__" 的 SelectItem 需 `await userEvent.click()` 后才能 query。

---

## C3: account-form.tsx(010 settings-ui)

**Path**: `src/components/settings/account-form.tsx`(112 行)

**Migration scope**: 行 74-85 的币种字段(1 处裸 `<select>` → 1 处 shadcn `<Select>`)。

**Import source**(既有,不修改):`SUPPORTED_CURRENCIES` from `@/server/domain/account/currency`(`src/components/settings/account-form.tsx:4` 已 import,迁移保持不变)。

**Before**(摘要):
```tsx
<select {...register("currency")}>
  {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
</select>
```

**After**:
```tsx
<Controller control={control} name="currency" render={({ field }) => (
  <Select value={field.value ?? ""} onValueChange={field.onChange}>
    <SelectTrigger><SelectValue placeholder="选择币种" /></SelectTrigger>
    <SelectContent>
      {SUPPORTED_CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
    </SelectContent>
  </Select>
)} />
```

**Behavior diff**:
- ✅ 编辑模式预填当前 currency 不变
- ✅ 新建模式 default value(若有)不变
- ⚠️ 账户名 / initialBalance 字段**不动**

**a11y lift**: 同 C1。

**Test selectors**: 同 C1。

---

## C4: transactions/page.tsx(009 删除确认 AlertDialog)

**Path**: `src/app/(app)/transactions/page.tsx`(171 行)

**Migration scope**: 行 93-96 的 `handleDelete`(`window.confirm` → AlertDialog + confirm state)。

**Before**(摘要):
```tsx
const handleDelete = (id: string) => {
  if (window.confirm("确认删除?")) {
    deleteMutation.mutate({ id });
  }
};

// JSX
<Button onClick={() => handleEdit(tx.id)}>编辑</Button>
<Button onClick={() => handleDelete(tx.id)}>删除</Button>
```

**After**:
```tsx
const [confirmingTxId, setConfirmingTxId] = useState<string | null>(null);
const deleteMutation = trpc.transaction.delete.useMutation({
  onSuccess: () => {
    utils.transaction.list.invalidate();
    utils.dashboard.summary.invalidate();
    toast.success("已删除");              // 补 toast(R6)
    setConfirmingTxId(null);              // reset dialog
  },
  onError: (err) => toast.error(err instanceof TRPCClientError ? err.message : "删除失败"),
});

// JSX
<Button onClick={() => handleEdit(tx.id)}>编辑</Button>
<Button onClick={() => setConfirmingTxId(tx.id)}>删除</Button>

<AlertDialog open={confirmingTxId !== null} onOpenChange={(o) => !o && setConfirmingTxId(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>确认删除?</AlertDialogTitle>
      <AlertDialogDescription>此操作不可撤销,该交易记录将被永久删除。</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
      <AlertDialogAction asChild>
        <Button variant="destructive" disabled={deleteMutation.isPending}
                onClick={() => confirmingTxId && deleteMutation.mutate({ id: confirmingTxId })}>
          {deleteMutation.isPending ? "删除中..." : "确认删除"}
        </Button>
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Behavior diff**:
- ✅ 删除 mutation 触发时机不变(确认按钮点击)
- ✅ 删除后 invalidate 不变
- ⚠️ 新增 toast 反馈"已删除"(R6,既有静默)
- ⚠️ 新增 onError toast(既有静默)
- ⚠️ 删除按钮视觉:destructive 红色 variant + pending 状态文案"删除中..."
- ⚠️ 取消按钮在 pending 时 disabled(防 mutation 进行中关闭 dialog)

**a11y lift**:
- alertdialog role / aria-labelledby(标题)/ aria-describedby(描述)
- 焦点陷阱(限制 Tab 在 dialog 内)
- 默认焦点在 AlertDialogCancel
- Esc / 点击遮罩 = 取消

**Test selectors**:
- 既有 `window.confirm` mock(`vi.spyOn(window, 'confirm').mockResolvedValue(true)`)→ **删除**
- 新:`await userEvent.click(screen.getByRole('button', { name: '删除' }))` → `await screen.findByRole('alertdialog')` → `await userEvent.click(screen.getByRole('button', { name: '确认删除' }))`
- mutation pending 状态: `screen.getByRole('button', { name: '删除中...' })`

---

## C5: settings/page.tsx(010 archive/unarchive UX 对齐)

**Path**: `src/app/(app)/settings/page.tsx`(200 行)

**Migration scope**: 行 78-85 的 `handleArchive` + `handleUnarchive` + 行 41-56 的 mutation hook(取消 confirm + 加 toast,对齐 023)。

**Before**(摘要):
```tsx
const archiveMutation = trpc.account.archive.useMutation({
  onSuccess: () => utils.account.list.invalidate(),  // 无 toast
});
const unarchiveMutation = trpc.account.unarchive.useMutation({
  onSuccess: () => utils.account.list.invalidate(),  // 无 toast
});

const handleArchive = (id: string) => {
  if (window.confirm("确认归档?此操作不影响已有交易")) return;  // 有 confirm
  archiveMutation.mutate({ id });
};

const handleUnarchive = (id: string) => {
  unarchiveMutation.mutate({ id });  // 静默
};
```

**After**(摘要):
```tsx
const archiveMutation = trpc.account.archive.useMutation({
  onSuccess: () => {
    utils.account.list.invalidate();
    utils.dashboard.summary.invalidate();
    toast.success("已归档");                              // R6
  },
  onError: (err) => toast.error(err instanceof TRPCClientError ? err.message : "归档失败"),
});

const unarchiveMutation = trpc.account.unarchive.useMutation({
  onSuccess: () => {
    utils.account.list.invalidate();
    utils.dashboard.summary.invalidate();
    toast.success("已恢复");                              // R6
  },
  onError: (err) => toast.error(err instanceof TRPCClientError ? err.message : "恢复失败"),
});

const handleArchive = (id: string) => archiveMutation.mutate({ id });   // 无 confirm
const handleUnarchive = (id: string) => unarchiveMutation.mutate({ id });
```

**Behavior diff**:
- ⚠️ **取消** `window.confirm`(Q2 决议):点击"归档"立即触发 mutation
- ⚠️ **新增** `toast.success("已归档")` / `toast.success("已恢复")`(R6)
- ⚠️ **新增** `onError toast.error`(既有静默失败)
- ⚠️ **新增** `utils.dashboard.summary.invalidate()`(归档影响 dashboard 账户余额汇总,既有遗漏)
- ✅ mutation 触发时机不变(点击按钮)
- ✅ onSuccess invalidate account.list 不变

**a11y lift**: 无(Radix 未引入;但取消 confirm 提升了流程连贯性,toast 是 ARIA live region 自带 a11y)。

**Test selectors**:
- 既有 `window.confirm` mock → **删除**
- 新:`await userEvent.click(screen.getByRole('button', { name: '归档' }))` → 直接断言 mutation 调用 + `await screen.findByText('已归档')`
- unarchive:类似,断言 `findByText('已恢复')`

---

## 测试 selector 调整汇总

| 文件 | 既有 selector 模式 | 新 selector 模式 |
|---|---|---|
| transaction-form.test.tsx(若存在) | `screen.getByRole('combobox', { name: '账户' })` 后 `userEvent.selectOptions` | `userEvent.click(trigger)` → `screen.getByRole('option', { name: '现金' })` |
| transaction-filters.test.tsx(若存在) | 同上 | 同上 |
| account-form.test.tsx(若存在) | 同上 | 同上 |
| transactions/page.test.tsx(若存在) | `vi.spyOn(window, 'confirm')` + `getByRole('button', { name: '删除' })` | `findByRole('alertdialog')` + `getByRole('button', { name: '确认删除' })` |
| settings/page.test.tsx(若存在) | `vi.spyOn(window, 'confirm')` + `getByRole('button', { name: '归档' })` | `getByRole('button', { name: '归档' })` 直接触发 + `findByText('已归档')` |

**注**:若上述 component test 文件不存在,本 feature **不新增**(spec Constitution Check 原则四"手动 quickstart 回归为主",与 008/009/010 既有模式一致);若存在,必须按本表调整,**禁止删除或 skip**(spec FR-014 等价的 025 版本约束)。
