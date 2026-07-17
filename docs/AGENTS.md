# AGENTS

## 开发原则
1. 严格按照 MVP 范围开发。自宪章 v3.2.0 (spec 027-mobile-home-revamp) 起,转账、预算、资产聚合、退款已解锁纳入 MVP;AI、OCR、导入导出、投资、多币种仍属范围外。
2. 未经 PRD 允许不得新增功能 (上条解锁项除外)。
3. 业务规则进入 tRPC server procedure / 纯领域函数,不进 React 组件。
4. 数据库访问只在 `src/server/db/` 内,通过 Drizzle 完成。
5. 所有 server procedure 内部调用走函数导入 (不引入消息队列/事件总线)。
6. 每完成一个功能：
   - 更新 Drizzle 迁移
   - 更新 tRPC router (类型自动派生,无需手写契约)
   - 更新 `docs/DOMAIN.md` / `docs/DATABASE.md`
   - 更新测试 (Vitest + testcontainers)
7. UI 调整纪律 (宪章原则七): 任何触及 `src/components/**/*.tsx`、`src/app/**/*.tsx` 的 JSX/className 改动,实现前 MUST 先 `/heroui-react` skill 查询 HeroUI v3 API/variant/theming。
8. Server/Client 边界 (025-perf-code-optimization): 默认 Server Component;仅在需要 `useState`/`useEffect`/event handler/Browser API/`useRouter`/tRPC client hook 时加 `"use client"`。内部路由跳转用 `<Link>` 而非 `useRouter().push()`(原生 a11y + prefetch)。大型第三方库(如 recharts)用 `next/dynamic({ ssr:false, loading: Skeleton })` 懒加载。

## 技术栈
- Next.js (App Router, 全栈)
- tRPC v11 (端到端类型安全 RPC)
- Better-Auth (认证)
- Drizzle ORM
- PostgreSQL
- Tailwind CSS v4
- HeroUI v3 (@heroui/react + @heroui/styles)
