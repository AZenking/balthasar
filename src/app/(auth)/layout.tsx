import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/dashboard");
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]/50 px-0 md:px-4">
      {/* 手机全屏无外框;桌面 ≤420px 居中圆角面板 */}
      <div className="min-h-screen w-full bg-[var(--background)] md:min-h-0 md:max-w-[420px] md:rounded-[32px] md:border md:border-[var(--border)] md:shadow-sm">
        {children}
      </div>
    </div>
  );
}
