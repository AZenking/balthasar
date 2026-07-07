# Contracts: 007-onboarding-ui

**状态**: 纯前端 feature,无新 API 端点。复用 001-006 后端。

## 页面路由

| 路由 | 组件 | 鉴权 | 数据 |
|---|---|---|---|
| `/` | redirect | N/A | 检查 session → /login 或 /dashboard |
| `/login` | LoginForm | 仅未认证 | Better-Auth signInEmail |
| `/register` | RegisterForm | 仅未认证 | Better-Auth signUpEmail |
| `/dashboard` | DashboardPage | 已认证 | trpc.dashboard.summary |
| `/transactions` | Placeholder | 已认证 | 无 ("即将上线") |
| `/transaction/new` | Placeholder | 已认证 | 无 |
| `/settings` | SettingsPage | 已认证 | authClient.signOut |

## Better-Auth Client 调用

```typescript
// 登录
const { error } = await authClient.signInEmail({ email, password });
// error.status: 401 (凭证错) | 423 (锁定) | undefined (成功)

// 注册
const { error } = await authClient.signUpEmail({ email, password, name });
// error.status: 409 (已注册) | undefined (成功)

// 登出
await authClient.signOut();
```

## tRPC Client 调用

```typescript
// Dashboard
const { data, isLoading, error } = trpc.dashboard.summary.useQuery();
// data: { monthIncome, monthExpense, monthNet, recentTransactions, topExpenseCategories }
```
