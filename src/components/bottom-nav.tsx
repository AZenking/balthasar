"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  PencilLine,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BottomNav (024-ui-consistency US3: emoji → lucide-react icons).
 *
 * Replaces 4 emoji chars (📊 📋 ✏️ ⚙️) with lucide-react line icons for
 * cross-platform visual consistency and screen-reader predictability.
 * Active state colors and ≥ 44×44px tap targets are preserved.
 */
const tabs: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/dashboard", label: "首页", Icon: LayoutDashboard },
  { href: "/transactions", label: "流水", Icon: ReceiptText },
  { href: "/transaction/new", label: "记账", Icon: PencilLine },
  { href: "/settings", label: "设置", Icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 border-t bg-background">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
