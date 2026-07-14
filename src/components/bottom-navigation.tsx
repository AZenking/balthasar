"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Receipt,
  User,
  type LucideIcon,
} from "lucide-react";
import { TransactionDrawer } from "@/components/transaction/transaction-drawer";

/**
 * BottomNavigation (026-cream-amber-revamp US2 + 026-switch 第一期 1)。
 *
 * Fixed 5-entry bottom nav: 首页 / 账单 / 记一笔(prominent Drawer) / 报表 / 我的.
 * - Active entry highlights by comparing `usePathname()` against each href
 *   (exact match for the 4 leaf routes).
 * - 中间"记一笔"用 TransactionDrawer(底部弹出 sheet),不再跳 /transaction/new
 *   页面。理由:记账是高频操作,Drawer 无页面跳转,更接近主流记账 App UX。
 * - /transaction/new 路由保留(可深链),但 BottomNavigation 不再用它。
 * - 026-switch:由 AppShell 在 mobile 分支渲染(md:hidden),safe-area
 *   通过 `env(safe-area-inset-bottom)` 注入到 nav 自身底部 padding,确保
 *   iPhone home indicator 不挡按钮。
 */
type Entry = {
  href: string;
  label: string;
  Icon: LucideIcon;
  isDrawer?: boolean; // 中间"记一笔"开 Drawer,不用 Link
};

const ENTRIES: readonly Entry[] = [
  { href: "/dashboard", label: "首页", Icon: Home },
  { href: "/transactions", label: "账单", Icon: Receipt },
  { href: "#drawer", label: "记一笔", Icon: Home, isDrawer: true }, // href 仅作 key,isDrawer=true 时不用 Link
  { href: "/reports", label: "报表", Icon: BarChart3 },
  { href: "/settings", label: "我的", Icon: User },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-end border-t bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {ENTRIES.map(({ href, label, Icon, isDrawer }) => {
        // 中间"记一笔":渲染 Drawer 触发器(替代 Link)
        if (isDrawer) {
          return <TransactionDrawer key={href} />;
        }

        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors ${
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
