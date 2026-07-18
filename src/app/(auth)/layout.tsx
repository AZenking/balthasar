import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { AccountScopeSync } from "@/components/pwa/account-scope-sync";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const pendingLogout = requestHeaders.get("cookie")?.includes("balthasar.pwa.pending_logout=1");
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session && !pendingLogout) {
    redirect("/dashboard");
  }
  // 公开 auth 流(登录/注册/完成退出)的 scope 一律为 null。AccountScopeSync
  // 在客户端检测 A→null 变化时清除旧账号的草稿和私有缓存。
  return (
    <AccountScopeSync confirmedUserId={null}>
      <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]/50 px-0 md:px-4">
        {/* 手机全屏无外框;桌面 ≤420px 居中圆角面板 */}
        <div className="min-h-screen w-full bg-[var(--background)] md:min-h-0 md:max-w-[420px] md:rounded-[32px] md:border md:border-[var(--border)] md:shadow-sm">
          {children}
        </div>
      </div>
    </AccountScopeSync>
  );
}
