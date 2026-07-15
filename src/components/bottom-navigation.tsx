"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Receipt,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { TransactionDrawer } from "@/components/transaction/transaction-drawer";
import { cn } from "@/lib/utils";

/**
 * BottomNavigation (027-mobile-home-revamp FR-007).
 *
 * 4 个一级页面(首页 / 明细 / 统计 / 我的)+ 中央上凸圆形 FAB(记一笔)。
 * FAB 独立悬浮在导航中央上方,不作为第 5 个普通导航项(设计 §3.3)。
 *
 * 026 是 5 入口(首页/账单/[记一笔 Drawer]/报表/我的);027 改为 4 入口
 * + 独立 FAB,文案对齐设计(账单→明细、报表→统计)。
 *
 * FAB 点击直接打开 TransactionDrawer(默认支出,不弹二级选项层 ——
 * clarify Q2 Option A;类型切换在表单内 mode-row)。
 *
 * 高度策略(沿用 026):minHeight = calc(4rem + env(safe-area-inset-bottom)),
 * 内部按钮容器固定 h-16。
 *
 * HeroUI v3:无原生 FAB/BottomNav;FAB 由 TransactionDrawer 内部渲染
 * (上凸圆形按钮),本组件只负责 4 个导航入口 + 中央 FAB 占位。
 */
type Entry = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

const ENTRIES: readonly Entry[] = [
  { href: "/dashboard", label: "首页", Icon: Home },
  { href: "/transactions", label: "明细", Icon: Receipt },
  { href: "/reports", label: "统计", Icon: BarChart3 },
  { href: "/settings", label: "设置", Icon: Settings },
] as const;

function isEntryActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-50 flex items-end border-t bg-background"
      style={{
        minHeight: "calc(4rem + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="relative flex h-16 w-full items-end">
        {/* 前 2 个入口(首页 / 明细) */}
        <NavEntry entry={ENTRIES[0]!} active={isEntryActive(pathname, ENTRIES[0]!.href)} />
        <NavEntry entry={ENTRIES[1]!} active={isEntryActive(pathname, ENTRIES[1]!.href)} />

        {/* 中央 FAB 占位(等宽 flex,内容为 FAB) */}
        <div className="flex h-16 flex-1 items-start justify-center">
          <TransactionDrawer />
        </div>

        {/* 后 2 个入口(统计 / 我的) */}
        <NavEntry entry={ENTRIES[2]!} active={isEntryActive(pathname, ENTRIES[2]!.href)} />
        <NavEntry entry={ENTRIES[3]!} active={isEntryActive(pathname, ENTRIES[3]!.href)} />
      </div>
    </nav>
  );
}

function NavEntry({ entry, active }: { entry: Entry; active: boolean }) {
  const { href, label, Icon } = entry;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: "var(--accent)" }}
        />
      )}
      <Icon className="h-5 w-5" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
