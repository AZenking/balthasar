"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Plus,
  Receipt,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import packageJson from "@/../package.json";

/**
 * Sidebar(026-switch 第一期 1:App Shell 响应式)。
 *
 * 桌面端(md+,≥768px)固定左侧 240px 宽侧栏。与移动端 BottomNavigation
 * 共用同一组入口,但渲染为竖排 Link 列表;中间"记一笔"在桌面端通过深链
 * `/transaction/new` 跳页(移动端走 BottomNavigation 中间凸起按钮 →
 * TransactionDrawer 弹层)。理由:
 *   - TransactionDrawer 内置的凸起 FAB 按钮形态与侧栏列表不兼容;
 *   - 任务规范明确"不动 TransactionDrawer",不强行套壳;
 *   - `/transaction/new` 路由被保留可深链(见 TransactionDrawer 注释),
 *     桌面端直接利用此路径,等于免费获得"键盘 / 鼠标用户的全屏表单页"。
 *
 * - 顶部品牌区"BALTHASAR"(任务规范 §1 要求)
 * - 入口高亮:`usePathname()` 按嵌套路由前缀匹配
 *   - /dashboard 精确(目前无子路由)
 *   - /transactions 前缀(覆盖 /transactions/[id])
 *   - /transaction/new 精确(否则 /transaction/[id]/edit 会误高亮"记一笔")
 *   - /reports、/settings 前缀(预留 /reports/... 与 /settings/categories)
 * - 版本号从 package.json 读(与 settings/page.tsx 一致)
 * - 整体 `fixed inset-y-0 left-0 w-60`,由 AppShell 用 `md:pl-60` 让出空间
 *   (本组件不直接 fixed —— fixed 由 AppShell 的 className 注入,保持本组件
 *   可被多种布局复用)
 */

type Entry = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** 精确匹配 vs 前缀匹配。默认前缀;/transaction/new 必须精确。 */
  exact?: boolean;
};

const ENTRIES: readonly Entry[] = [
  { href: "/dashboard", label: "首页", Icon: Home, exact: true },
  { href: "/transactions", label: "账单", Icon: Receipt },
  { href: "/transaction/new", label: "记一笔", Icon: Plus, exact: true },
  { href: "/reports", label: "报表", Icon: BarChart3 },
  { href: "/settings", label: "我的", Icon: User },
] as const;

function isEntryActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="主导航"
      className={cn(
        "flex w-60 flex-col border-r bg-background",
        className,
      )}
    >
      {/* 品牌区 */}
      <div className="px-5 py-5">
        <Link
          href="/dashboard"
          className="text-lg font-bold tracking-tight text-foreground"
        >
          BALTHASAR
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">家庭记账</p>
      </div>

      {/* 入口列表 */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {ENTRIES.map(({ href, label, Icon, exact }) => {
          const active = isEntryActive(pathname, href, exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 底部签名(版本号从 package.json 读,保持与 settings/page.tsx 一致) */}
      <div className="px-5 py-4 text-xs text-muted-foreground">
        v{packageJson.version}
      </div>
    </aside>
  );
}
