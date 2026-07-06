# AGENTS

## 开发原则
1. 严格按照 MVP 范围开发。
2. 未经 PRD 允许不得新增功能。
3. 业务规则进入 tRPC server procedure / 纯领域函数,不进 React 组件。
4. 数据库访问只在 `src/server/db/` 内,通过 Drizzle 完成。
5. 所有 server procedure 内部调用走函数导入 (不引入消息队列/事件总线)。
6. 每完成一个功能：
   - 更新 Drizzle 迁移
   - 更新 tRPC router (类型自动派生,无需手写契约)
   - 更新 `docs/DOMAIN.md` / `docs/DATABASE.md`
   - 更新测试 (Vitest + testcontainers)

## 技术栈
- Next.js (App Router, 全栈)
- tRPC v11 (端到端类型安全 RPC)
- Better-Auth (认证)
- Drizzle ORM
- PostgreSQL
- Tailwind CSS
- shadcn/ui
