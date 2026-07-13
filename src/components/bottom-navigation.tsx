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
import { buttonVariants } from "@heroui/react";
import { cn } from "@/lib/utils";

/**
 * BottomNavigation (026-cream-amber-revamp US2).
 *
 * Fixed 5-entry bottom nav: 首页 / 账单 / 记一笔(prominent) / 报表 / 我的.
 * - Active entry highlights by comparing `usePathname()` against each href
 *   (exact match for the 4 leaf routes; the prominent "记一笔" is its own
 *    leaf so it never collides).
 * - The prominent middle entry uses HeroUI v3 `buttonVariants` (primary,
 *   lg, icon-only) wrapped in a Next.js `<Link>` so it keeps client-side
 *   routing AND HeroUI styling. Visual prominence: circular accent button
 *   lifted slightly above the bar via negative top margin.
 * - Tap targets are >= 44x44px (per spec FR-A007).
 * - Cache invalidation (FR-B003) is intentionally NOT wired here — it is
 *   the responsibility of transaction mutations (Phase 8 US6).
 */
type Entry = {
  href: string;
  label: string;
  Icon: LucideIcon;
  prominent?: boolean;
};

const ENTRIES: readonly Entry[] = [
  { href: "/dashboard", label: "首页", Icon: Home },
  { href: "/transactions", label: "账单", Icon: Receipt },
  { href: "/transaction/new", label: "记一笔", Icon: Plus, prominent: true },
  { href: "/reports", label: "报表", Icon: BarChart3 },
  { href: "/settings", label: "我的", Icon: User },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-end border-t bg-background"
    >
      {ENTRIES.map(({ href, label, Icon, prominent }) => {
        const active = pathname === href;

        if (prominent) {
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center justify-center",
                "-mt-6", // lift the FAB above the bar
              )}
            >
              <span
                className={cn(
                  buttonVariants({
                    variant: "primary",
                    size: "lg",
                    isIconOnly: true,
                  }),
                  "h-14 w-14 rounded-full shadow-lg",
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="sr-only">{label}</span>
            </Link>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
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
