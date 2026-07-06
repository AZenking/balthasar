import Link from "next/link";

/**
 * Home page placeholder.
 *
 * Phase 2 Foundational only sets up auth + tRPC infrastructure. The actual
 * home flow (redirect to /login or /dashboard based on session) is
 * implemented in feature `007-onboarding-ui`.
 *
 * For now this page shows a debug summary of what's been built.
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">BALTHASAR · 家庭记账</h1>
      <p className="mt-2 text-sm text-gray-600">
        Phase 2 Foundational 已就位。登录/注册/Dashboard UI 在后续 feature 中实现。
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
        <li>
          Better-Auth 挂载于{" "}
          <code className="rounded bg-gray-100 px-1">/api/auth/*</code>
        </li>
        <li>
          tRPC 挂载于{" "}
          <code className="rounded bg-gray-100 px-1">/api/trpc/*</code>
        </li>
        <li>Drizzle schema + 客户端单例就绪</li>
        <li>Lockout / Password / Email 三大领域纯函数就绪</li>
      </ul>
      <p className="mt-6 text-xs text-gray-500">
        <Link href="#" className="underline">
          下一步: US1 注册 procedure
        </Link>
      </p>
    </main>
  );
}
