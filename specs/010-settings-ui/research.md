# Phase 0 Research: 010-settings-ui

**Date**: 2026-07-07

## Q1: 获取活跃+归档账户 — API 调用方式

### Decision
**`account.list({ includeArchived: true })` 单次调用**,客户端按 `archivedAt` 分区排序。

### Rationale
- 002 的 `list` procedure 接受 `{ includeArchived?: boolean }`。传 `true` 返回全部账户 (活跃+归档)。
- 客户端按 `archivedAt` 分区: `archivedAt === null` → 活跃区,`archivedAt !== null` → 归档区。
- 单次请求,无需两次 query (减少网络往返)。
- 账户数 < 20 (MVP 单成员),无需分页。

### Alternatives considered
- 两次调用 (活跃 + 归档各一次): 多一次网络往返,无实际收益。

---

## Q2: 创建表单 — 初始余额输入与转换

### Decision
**用户以元为单位输入 (如 "1000.50"),提交时转换为分 (cents) 传给 `account.create`。**

### Rationale
- spec FR-005: "初始余额 MUST 以元为单位输入,允许小数 (最多 2 位),默认 0"。
- 002 `create` procedure 的 `initialBalance` 是整数 (cents)。
- 转换公式: `Math.round(parseFloat(input) * 100)`。如 "1000.50" → 100050。
- JPY 特殊: `CURRENCY_MINOR_UNITS.JPY = 0`,但 spec 统一要求"最多 2 位小数",用户输入 "2000" → `2000 * 100 = 200000` 会有问题。

**修正**: 转换应使用 `CURRENCY_MINOR_UNITS`:
```typescript
const minorUnits = CURRENCY_MINOR_UNITS[currency];
const cents = Math.round(parseFloat(input) * Math.pow(10, minorUnits));
```
- CNY: `1000.50 * 100` = 100050 ✓
- JPY: `2000 * 1` = 2000 ✓

- `CURRENCY_MINOR_UNITS` 和 `formatBalance` 位于 `src/server/domain/account/currency.ts`,是纯常量/纯函数 (无 `server-only` import),客户端可直接 import。

### Alternatives considered
- 统一 `* 100`: JPY 会出错 (2000 yen 变 200000)。
- 服务端转换: 002 API 已定义为 cents,不改后端。

---

## Q3: 编辑表单 — 字段与预填

### Decision
**编辑表单仅含 name + currency 两个字段,不含 initialBalance。使用 `account.update` API。**

### Rationale
- 002 `update` procedure input schema: `{ id, name?, currency? }` (`.strict()`),不接受 `initialBalance`。
- clarify Q2 确认: 编辑表单仅名称 + 币种。
- 预填: 从 list 数据中取当前 name 和 currency,`react-hook-form` 的 `reset()` 填充。
- 已归档账户不可编辑 (002 FR-011: CONFLICT),编辑按钮仅对活跃账户显示 (FR-007)。

### Alternatives considered
- 含 initialBalance 字段: API 不接受,提交会失败。

---

## Q4: 归档确认 — window.confirm

### Decision
**`window.confirm("确认归档?此操作不影响已有交易")` (MVP 简化)。**

### Rationale
- spec FR-010 + assumptions: "归档确认用 window.confirm (MVP 简化,与 009 删除模式一致;V2 评估 → 1.0.0 已实现为 HeroUI AlertDialog,见 026-cream-amber-revamp)"。
- 一行代码,无需额外组件。
- 取消归档无需确认 (直接恢复,无数据损失风险)。
- 归档/取消归档成功后: `utils.account.list.invalidate()` 刷新列表。

### Alternatives considered
- AlertDialog: 更好 UX 但增加复杂度,YAGNI (V2)。1.0.0 已落地(026-cream-amber-revamp HeroUI AlertDialog)。

---

## Q5: 列表刷新策略 — invalidate vs 乐观更新

### Decision
**`utils.account.list.invalidate()` 强制 refetch (不用乐观更新)。**

### Rationale
- 账户数 < 20,refetch 延迟可忽略 (< 100ms)。
- 乐观更新需手动维护本地 cache,增加复杂度 (YAGNI)。
- invalidate 后 React Query 自动 refetch,列表立即更新 (SC-004)。
- create/update/archive/unarchive 四个 mutation 的 `onSuccess` 均调 `invalidate`。
- 同时 invalidate `dashboard.summary` (账户变更影响 Dashboard 统计)。

### Alternatives considered
- 乐观更新 (optimistic update): 复杂度高,MVP 不需要。

---

## Q6: 新建/编辑表单 — 共用组件 vs 独立组件

### Decision
**共用 `AccountForm` 组件,通过 `mode` prop 区分新建/编辑。**

### Rationale
- 新建表单: name + currency + initialBalance (3 字段)。
- 编辑表单: name + currency (2 字段,不含 initialBalance)。
- 共用 name + currency 字段的 UI 和校验逻辑。
- `mode: "create" | "edit"` 控制: 编辑模式隐藏 initialBalance 字段,提交调 `update` 而非 `create`。
- 与 008 TransactionForm 的 `editId` 模式一致。

### Alternatives considered
- 独立组件: 代码重复 (name/currency 字段 + 校验)。

---

## Q7: 币种选择 — 组件选型

### Decision
**原生 `<select>` 元素 (shadcn Select 组件未安装)。**

### Rationale
- 当前 shadcn/ui 仅安装了 button/card/input/label/skeleton,无 Select 组件。
- 008 TransactionForm 已使用原生 `<select>` 选账户/分类,保持一致。
- 9 种币种选项少,原生 `<select>` 足够。
- 安装 shadcn Select 需引入 @radix-ui/react-select 依赖,YAGNI。

### Alternatives considered
- 安装 shadcn Select: 增加依赖,原生 select 已够用。

---

## 总结

7 项决策: `list({ includeArchived: true })` 单次调用 + 元→分转换 (按币种 minor units) + 编辑仅 name+currency + window.confirm 归档 + invalidate 刷新 + 共用 AccountForm 组件 + 原生 select。
