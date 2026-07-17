import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { AppShell } from "@/components/layout/app-shell";
import { AccountScopeSync } from "@/components/pwa/account-scope-sync";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  if (requestHeaders.get("cookie")?.includes("balthasar.pwa.pending_logout=1")) {
    redirect("/login");
  }
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    redirect("/login");
  }
  // AppShell 接管:
  //   - 桌面端 Sidebar(md+ fixed 240px)+ main md:pl-60
  //   - 移动端 BottomNavigation(fixed bottom + safe-area)
  //   - 统一 max-w-[1120px] 容器 + 内边距
  // 服务器确认的 session.user.id 是账号 scope 的唯一真相;AccountScopeSync
  // 在客户端检测 A→B/A→null 变化时清除旧账号的草稿和私有缓存。
  return (
    <AccountScopeSync confirmedUserId={session.user.id}>
      <AppShell>{children}</AppShell>
    </AccountScopeSync>
  );
}
