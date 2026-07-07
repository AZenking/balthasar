# Data Model: 010-settings-ui

**Date**: 2026-07-07

不新增表/迁移。纯前端,复用 002-account 的 Account 实体。

## Account 实体 (复用 002)

```typescript
interface Account {
  id: string;               // uuid
  familyId: string;         // uuid
  name: string;             // 1-50 字
  currency: Currency;       // CNY|USD|EUR|JPY|HKD|GBP|AUD|CAD|SGD
  initialBalance: number;   // 整数 (分),可负
  archivedAt: Date | null;  // null = 活跃
  createdAt: Date;
  updatedAt: Date;
}
```

## 页面状态

```typescript
interface SettingsPageState {
  // 账户列表
  accounts: Account[];           // account.list({ includeArchived: true }) 结果
  isLoading: boolean;            // 首次加载
  error: string | null;          // 加载错误

  // 新建表单
  showCreateForm: boolean;       // 内联表单展开/收起
  createForm: {
    name: string;
    currency: string;            // 默认 "CNY"
    initialBalance: string;      // 文本输入 (元),默认 "0"
  };
  createError: string | null;

  // 编辑表单
  editingAccountId: string | null;  // null = 无编辑表单展开
  editForm: {
    name: string;
    currency: string;
  };
  editError: string | null;

  // mutation loading
  isCreating: boolean;
  isUpdating: boolean;
  isArchiving: string | null;    // account id being archived, null = none
}
```

## 数据流

```
页面加载
  └─ trpc.account.list.useQuery({ includeArchived: true })
       → Account[] (活跃 + 归档, 按 createdAt DESC)
       → 客户端分组: active (archivedAt === null) + archived (archivedAt !== null)

新建账户
  ├─ 点"新建账户" → 展开内联表单
  ├─ 填写 name + currency + initialBalance (元)
  ├─ 提交 → Math.round(parseFloat(initialBalance) * 10^minorUnits) → 分
  ├─ trpc.account.create.useMutation({ name, currency, initialBalance })
  └─ onSuccess → utils.account.list.invalidate() → 列表刷新 + 表单收起

编辑账户
  ├─ 点活跃账户行"编辑" → 展开内联表单 (预填 name + currency)
  ├─ 修改 name/currency → 提交
  ├─ trpc.account.update.useMutation({ id, name, currency })
  └─ onSuccess → utils.account.list.invalidate() → 列表刷新 + 表单收起

归档账户
  ├─ 点活跃账户行"归档" → window.confirm("确认归档?此操作不影响已有交易")
  ├─ 确认 → trpc.account.archive.useMutation({ id })
  └─ onSuccess → utils.account.list.invalidate() → 账户移到归档区域

取消归档
  ├─ 点已归档账户行"取消归档" (无确认)
  ├─ trpc.account.unarchive.useMutation({ id })
  └─ onSuccess → utils.account.list.invalidate() → 账户移到活跃区域

登出
  └─ authClient.signOut() → router.push("/login")
```

## 组件结构

```
/settings (page.tsx) — 列表逻辑 (活跃/归档分区/空状态/骨架屏) 直接在页面内
├── 活跃账户区域
│   ├── AccountItem × N (活跃)
│   │   ├── 名称 + 币种 + 初始余额
│   │   ├── "编辑"按钮 → 展开 AccountForm (edit 模式)
│   │   └── "归档"按钮 → window.confirm → archive
│   └── AccountForm (create 模式, 内联新建表单)
├── 分隔线
├── 已归档账户区域
│   └── AccountItem × N (归档, 灰色)
│       ├── 名称 + 币种 + 初始余额 + "已归档"标记
│       └── "取消归档"按钮 → unarchive
├── 空状态 ("暂无账户,请先创建")
├── AccountForm (共享组件, src/components/settings/account-form.tsx)
│   ├── mode: "create" → name + currency + initialBalance
│   └── mode: "edit"   → name + currency (无 initialBalance)
└── 登出按钮 (保留现有, 移到页面底部)
```
