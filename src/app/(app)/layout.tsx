import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  // AppShell 接管:
  //   - 桌面端 Sidebar(md+ fixed 240px)+ main md:pl-60
  //   - 移动端 BottomNavigation(fixed bottom + safe-area)
  //   - 统一 max-w-[1120px] 容器 + 内边距
  return <AppShell>{children}</AppShell>;
}
