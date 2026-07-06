# Contracts: 001-auth-family

**状态**: v2.0.0 T3 Stack —— **本目录不再维护 REST 契约文件**。

## 为什么没有 .md 契约文件?

迁移至 T3 Stack 后,前后端通过 **tRPC 类型推断** 共享契约:

```typescript
// 前端 (RSC 或客户端组件)
'use client';
import { trpc } from '@/lib/trpc/client';

export function RegisterForm() {
  const register = trpc.auth.register.useMutation();
  // register.mutate 的入参类型、register.data 的返回类型,
  // 都从 src/server/api/routers/auth.ts 自动推断。
}
```

```typescript
// 后端 (src/server/api/routers/auth.ts)
export const authRouter = router({
  register: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      // ...
      return { user, family, member };
    }),
});
```

类型即契约,改 schema 编译器立刻在前端报错。

## 入口端点 (旧 REST 类比)

| 功能 | tRPC 路径 | 类型 |
|---|---|---|
| 注册 | `trpc.auth.register.useMutation()` | mutation |
| 登录 | `trpc.auth.login.useMutation()` | mutation |
| 登出 | `trpc.auth.logout.useMutation()` | mutation |
| 查询当前会话 | `trpc.auth.me.useQuery()` | query |
| 查询审计事件 (最近 30 天) | `trpc.auth.auditEvents.useQuery()` | query (protected) |

## Better-Auth 直接端点

Better-Auth 的内部 API 挂在 `/api/auth/*`,通常**不**直接调用 (走 tRPC procedure 包装)。仅以下情况直接访问:
- Better-Auth client SDK 在浏览器内调用的端点 (如自动 fetch session)
- Webhook 配置 (V2)

## 详细 procedure schema

见 `src/server/api/routers/auth.ts`。输入/输出 schema 在该文件用 zod 声明,自动派生到 client。

研究决策见 [research.md](../research.md) Q13。
