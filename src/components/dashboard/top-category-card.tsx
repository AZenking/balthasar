"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/category/category-icon";

/**
 * TopCategoryCard (026-cream-amber-revamp, spec FR-C006).
 *
 * Renders the Top 2 expense categories for the selected month as two
 * side-by-side tappable cards. Tapping a card drills down into the
 * transactions page filtered by `month + type=expense + categoryId`,
 * matching the report-page category-block drill-down (FR-D003) so users
 * learn one interaction.
 *
 * Layout: a single grid with two `<Card>` children (`minmax(140px, 1fr)`)
 * — on 375 px the two cards sit side-by-side and never collapse to a
 * single column, satisfying the mobile-first IA requirement.
 *
 * Privacy: every amount is rendered with `data-amount` so the global
 * `.privacy-on [data-amount]` CSS rule (research.md R5) hides it when
 * privacy mode is on. The inline script in `layout.tsx` primes the
 * `<html>.privacy-on` class pre-hydration, so there is no flash of real
 * amounts (FR-C009).
 */

export interface TopCategory {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  /** Expense amount in cents (DB storage unit). */
  amount: number;
  /** Share of the month's total expense, 0–100, rounded to integer. */
  percentage: number;
}

export interface TopCategoryCardProps {
  /** Top expense categories, length ≤ 2 (caller responsibility). */
  items: TopCategory[];
  /** The year/month the figures belong to — used to build the drill-down URL. */
  yearMonth: { year: number; month: number };
  /**
   * Optional click handler. When provided, the parent owns the drill-down
   * (e.g. for prefetch or analytics). Falls back to `router.push(url)`.
   */
  onCategoryClick?: (categoryId: string) => void;
}

function formatAmount(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function buildDrillDownUrl(
  yearMonth: { year: number; month: number },
  categoryId: string,
): string {
  const month = `${yearMonth.year}-${String(yearMonth.month).padStart(2, "0")}`;
  const params = new URLSearchParams({
    month,
    type: "expense",
    categoryId,
  });
  return `/transactions?${params.toString()}`;
}

export function TopCategoryCard({
  items,
  yearMonth,
  onCategoryClick,
}: TopCategoryCardProps) {
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="px-4 py-4">
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            本月无支出
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleClick = (categoryId: string) => {
    if (onCategoryClick) {
      onCategoryClick(categoryId);
      return;
    }
    router.push(buildDrillDownUrl(yearMonth, categoryId));
  };

  return (
    <div
      className="grid gap-2 px-4 pt-4"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(140px, 1fr))` }}
    >
      {items.map((c) => (
        <Card
          key={c.categoryId}
          role="button"
          tabIndex={0}
          /**
           * HeroUI Card forwards unknown DOM props onto the root element; we
           * rely on that for `onClick` / `onKeyDown`. The card is focusable
           * (`tabIndex=0`) and keyboard-activatable (Enter / Space) so it
           * meets the ≥ 44 px tap target + keyboard-nav a11y bar (FR-G003).
           */
          onClick={() => handleClick(c.categoryId)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick(c.categoryId);
            }
          }}
          aria-label={`查看「${c.categoryName}」分类的支出明细`}
          className={cn(
            "cursor-pointer transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-sm">
              {c.categoryIcon ? (
                <CategoryIcon name={c.categoryIcon} size={18} />
              ) : null}
              <span className="truncate font-medium">{c.categoryName}</span>
            </div>
            <p
              data-amount
              className="mt-1 text-base font-bold text-[var(--danger)]"
            >
              {formatAmount(c.amount)}
            </p>
            <p className="text-xs text-muted-foreground">占比 {c.percentage}%</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
