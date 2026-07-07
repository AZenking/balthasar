# Phase 0 Research: 007-onboarding-ui

**Date**: 2026-07-07

## Q1: 认证守卫 — middleware vs RSC getSession

### Decision
**RSC layout 内 `auth.api.getSession()`**。Next.js middleware 不用。

### Rationale
- middleware 在 Edge Runtime 运行,Better-Auth 的 `auth.api` 需要 Node.js runtime (Drizzle adapter 连 DB)。
- RSC layout `(app)/layout.tsx` 中 `await auth.api.getSession({ headers: await headers() })`,无 session → `redirect('/login')`。
- 与 001 `createContext` 同一模式 (Next 16 async headers)。
- 性能: RSC 在服务端渲染,无客户端 JS 开销。

### Alternatives
- **middleware**: 拒绝。Edge Runtime 不兼容 Drizzle。
- **客户端 useEffect 检查**: 拒绝。闪烁 (先渲染页面再跳转),UX 差。

---

## Q2: 表单管理 — react-hook-form vs plain useState

### Decision
**react-hook-form + @hookform/resolvers/zod**。

### Rationale
- 注册/登录表单有 2-3 个字段,RHF 管理简洁。
- zod schema 复用 (后端 001 已有 NIST 密码策略)。
- RHF 非受控,性能优于 useState (不每次 keypress re-render)。
- 社区标准。

### Alternatives
- **plain useState**: 拒绝。2 个字段还行,但注册 3 字段 + 校验逻辑写起来啰嗦。

---

## Q3: Dashboard 数据获取 — RSC server caller vs 客户端 useQuery

### Decision
**客户端 `trpc.dashboard.summary.useQuery()`**。

### Rationale
- dashboard.summary 需要 session cookie,RSC server caller 需要手动传 headers (复杂)。
- 客户端 useQuery 自动处理 loading/error/refetch,UX 更好 (骨架屏)。
- tRPC client hooks 已配置好 (`src/lib/trpc/client.ts`),直接用。
- 首屏用 RSC layout 检查 auth,数据加载用客户端 hook —— 标准模式。

### Alternatives
- **RSC server caller**: 拒绝。session 传递复杂,且无法自动 refetch。
- **SWR / react-query 直接调 fetch**: 拒绝。已有 tRPC,重复造轮子。

---

## Q4: shadcn/ui 组件清单

### Decision
通过 `npx shadcn@latest add` 安装以下组件:
- `button` — 按钮基础
- `input` — 输入框
- `label` — 标签
- `card` — 卡片 (Dashboard 收支卡)
- `skeleton` — 骨架屏
- `sonner` — toast 通知 (错误提示)

### Rationale
- MVP 最小组件集,覆盖认证表单 + Dashboard 卡片 + 错误提示。
- shadcn/ui 是 copy-paste 模式,组件代码在 `src/components/ui/`,可自定义。
- 不用 dialog/select/tabs 等复杂组件 (MVP 不需要)。

---

## Q5: 错误处理 — Better-Auth error 映射

### Decision
Better-Auth client 返回 `{ error }` 对象 (非 throw),前端检查 `error` 字段映射到中文提示。

```typescript
const { error } = await authClient.signInEmail({ email, password });
if (error?.status === 423) {
  // locked
} else if (error) {
  // invalid credentials
}
```

### Rationale
- Better-Auth client 返回 `{ data, error }` 而非 throw (与 tRPC 不同)。
- 423 Locked → "账户已锁定,请 N 分钟后重试"。
- 401 → "邮箱或密码错误"。
- 409 → "该邮箱已注册"。
- 网络/500 → "服务器开小差了,请稍后重试"。

---

## 总结

5 项决策: RSC auth guard + RHF + 客户端 useQuery + shadcn/ui 最小组件集 + Better-Auth error 映射。
