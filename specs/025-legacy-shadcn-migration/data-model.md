# Data Model: 历史页面 shadcn 迁移 (025-legacy-shadcn-migration)

**Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 概述

本 feature **不引入新数据实体**(纯前端重构,FR-019 锁定)。本文档记录:
1. **复用的 024 ui/ 原语清单**(Phase 1 依赖)
2. **UI 状态机**(AlertDialog open/close + confirm state + mutation lifecycle)
3. **既有数据契约**(filters / account / currency 等不变项的快照)

## 一、复用 024 ui/ 原语清单(本 feature import 不修改)

| 原语文件 | 主组件 | 本 feature 消费位置 |
|---|---|---|
| `src/components/ui/select.tsx` | `Select` / `SelectTrigger` / `SelectValue` / `SelectContent` / `SelectItem` | 008 transaction-form(accountId / categoryId)+ 009 transaction-filters(accountId / categoryId)+ 010 account-form(currency) |
| `src/components/ui/alert-dialog.tsx` | `AlertDialog` / `AlertDialogTrigger` / `AlertDialogContent` / `AlertDialogHeader` / `AlertDialogFooter` / `AlertDialogTitle` / `AlertDialogDescription` / `AlertDialogAction` / `AlertDialogCancel` | 009 transactions/page(删除确认) |

**注**:024 沉淀的其他 7 个原语(dialog / tabs / popover / radio-group / checkbox / command / tooltip)由 024 自身消费(023 迁移),本 feature **不消费**。

## 二、UI 状态机

### 2.1 009 transactions/page 删除确认 AlertDialog

**State shape**:
```ts
type DeleteConfirmState = {
  confirmingTxId: string | null;  // null = dialog closed;string = open with target
};
```

**State transitions**:

```
[init] confirmingTxId = null
   │
   │ 用户点击交易行的"删除"按钮(id=X)
   ▼
[open] confirmingTxId = X
   │            │
   │ 用户点     │ 用户点
   │ "取消"     │ "确认删除"
   │            ▼
   │       [pending] deleteMutation.isPending = true
   │            │
   │            │ onSuccess
   │            ▼
   │       [success] invalidate list + dashboard
   │            │ toast.success("已删除")
   │            ▼
   │       [reset] confirmingTxId = null
   │
   ▼
[reset] confirmingTxId = null
```

**关键约束**:
- **单一 dialog,多目标**:用 `confirmingTxId` state 而非"每个交易行一个 dialog",避免渲染 N 个 AlertDialog 实例(YAGNI)。
- **Esc / 点击遮罩 = 取消**:Radix `AlertDialog` 默认行为,无需手写。
- **默认焦点在"取消"**:Radix 默认行为(R3)。
- **mutation pending 时禁用"取消"按钮**:防止用户在 mutation 进行中关闭 dialog 导致状态混乱(`disabled={deleteMutation.isPending}`)。

### 2.2 010 settings/page archive/unarchive(server-first + toast)

**State shape**: 无新增 state(沿用既有 mutation hook)。

**Lifecycle**:
```
用户点"归档"(id=X)
   │
   ▼
archiveMutation.mutate({ id: X })   // server-first,无 onMutate
   │
   ├─ onSuccess → invalidate account.list + dashboard.summary
   │             toast.success("已归档")
   │
   └─ onError → toast.error(err.message ?? "归档失败")
                // 不 invalidate,数据保持原位(server validation 失败时)
```

**与 023 archive 的一致性**:023 archive 也是 server-first + onSuccess toast,本 feature 对齐。

### 2.3 RHF + Select 表单状态(008 transaction-form / 010 account-form)

**Controller 包裹模式**(RHF 与 Select 桥接):

```tsx
<Controller
  control={control}
  name="accountId"
  render={({ field }) => (
    <Select value={field.value ?? ""} onValueChange={field.onChange}>
      <SelectTrigger><SelectValue placeholder="选择账户" /></SelectTrigger>
      <SelectContent>
        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )}
/>
```

**注**:既有 008/010 用裸 `<select>` 时是直接 `register("accountId")` 迁移到 shadcn Select 必须用 `Controller`(因为 `register` 期望 `onChange` event,而 Select 的 `onValueChange` 是 `(value: string) => void`)。

## 三、既有数据契约快照(本 feature 不变)

### 3.1 008 transaction-form 字段(既有,zod schema 在 src/lib/validators/transaction.ts)

| 字段 | 类型 | Select 迁移影响 |
|---|---|---|
| accountId | `string`(必填) | 裸 `<select>` → shadcn `Select`,值不变 |
| categoryId | `string`(可空) | 同上,sentinel `"__all__"` 表示"全部"(R4 024 实测修正,Radix Select 不允许空字符串 value) |
| type | `'expense' \| 'income'` | **不迁移**(当前用 Button toggle,非 select) |
| amount / remark / occurredAt | number / string / Date | **不迁移**(Input / DatePicker 不在 scope) |

### 3.2 009 transaction-filters 字段(既有)

```ts
type FilterValues = {
  type?: 'expense' | 'income';
  accountId?: string;   // undefined = 全部
  categoryId?: string;  // undefined = 全部
};
```

迁移后 `accountId === ""` 与 `accountId === undefined` 等价(由既有 handleFiltersChange 中的 `setFilters({ accountId: v || undefined })` 转换)。

### 3.3 010 account-form 字段(既有)

| 字段 | 类型 | Select 迁移影响 |
|---|---|---|
| name | string | **不迁移** |
| currency | `'CNY' \| 'USD' \| 'EUR' \| ...`(枚举) | 裸 `<select>` → shadcn `Select`,候选列表沿用既有 constants |
| initialBalanceCents | number | **不迁移** |

**货币枚举来源**:`src/components/settings/account-form.tsx` 当前硬编码候选(读取既有代码,plan 不修改清单)。

## 四、a11y 提升(迁移副产出,非强制 SC)

迁移到 Radix Select / AlertDialog 后,**自动获得**(无需手写):
- Select: `role="combobox"` / `aria-expanded` / `aria-controls` / 键盘 ↓↑ Enter Esc / 焦点陷阱。
- AlertDialog: `role="alertdialog"` / `aria-labelledby` / `aria-describedby` / 焦点陷阱 / Esc 关闭 / 默认焦点在 Cancel。

这些是 023 既有手写 popover/select 缺失的 a11y,迁移自然修复(spec Assumption "副产出")。

## 五、不变项确认

- **不动 server**:`src/server/api/routers/{account,transaction}.ts` + `src/server/db/schema/*` + `src/server/domain/*` 全部不变。
- **不动 023 文件**:`src/components/settings/{category-form,category-manager,category-item,emoji-picker}.tsx`(024 US2 已迁移完成)。
- **不动其他 ui/ 文件**:既有 5 个原子(button / card / input / label / skeleton)由 024 决定是否替换,本 feature 不参与。
- **不动 i18n**:中文硬编码沿用现状。
