"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Bell, UserRound, ChevronRight as ChevronRightSmall } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { cn } from "@/lib/utils";

/**
 * DashboardTopNav (027-mobile-home-revamp,线稿对齐)。
 *
 * 线稿两行结构:
 *   第一行:[头像 下午好,昵称 / 我的账本 ›]          [🔔 消息]
 *   第二行:[‹ 2026 年 7 月 ›]                       [👁 隐私]
 *
 * 原实现把 5 组信息压一行(390px 拥挤);改回线稿两行。
 */
function greetingByUtcHour(hour: number): string {
  if (hour >= 6 && hour < 12) return "早上好";
  if (hour >= 12 && hour < 18) return "下午好";
  return "晚上好";
}

function prevMonth(y: number, m: number) {
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

export function DashboardTopNav({
  yearMonth,
  onChange,
  ledgerName = "我的账本",
}: {
  yearMonth: { year: number; month: number };
  onChange: (year: number, month: number) => void;
  ledgerName?: string;
}) {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);
  const meQuery = trpc.auth.me.useQuery();
  const displayName = meQuery.data?.member?.displayName ?? "";

  const now = new Date();
  const nowYm = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  const isCurrentMonth =
    yearMonth.year === nowYm.year && yearMonth.month === nowYm.month;
  const isFuture =
    yearMonth.year > nowYm.year ||
    (yearMonth.year === nowYm.year && yearMonth.month > nowYm.month);

  const goPrev = () => {
    const p = prevMonth(yearMonth.year, yearMonth.month);
    onChange(p.year, p.month);
  };
  const goNext = () => {
    if (isCurrentMonth || isFuture) return;
    const n =
      yearMonth.month === 12
        ? { year: yearMonth.year + 1, month: 1 }
        : { year: yearMonth.year, month: yearMonth.month + 1 };
    onChange(n.year, n.month);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    if (dx > 40) goPrev();
    else if (dx < -40) goNext();
    touchStartX.current = null;
  };

  const greeting = greetingByUtcHour(now.getUTCHours());

  return (
    <div className="pt-2">
      {/* 第一行:头像 + 问候 + 账本 | 消息 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="flex min-w-0 items-center gap-2"
          aria-label="进入设置"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--muted)]">
            <UserRound className="h-5 w-5 text-muted" aria-hidden />
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-medium text-foreground">
              {greeting}
              {displayName ? `，${displayName}` : ""}
            </span>
            <span className="block truncate text-xs text-muted">
              {ledgerName} <ChevronRightSmall className="inline h-3 w-3" aria-hidden />
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => toast.info("暂无消息")}
          aria-label="消息"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-[var(--muted)]"
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>

      {/* 第二行:‹ 年月 › | 隐私 */}
      <div
        className="mt-2 flex items-center justify-between"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            aria-label="上个月"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-[var(--muted)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[5.5rem] whitespace-nowrap text-center text-sm font-medium tabular-nums">
            {yearMonth.year} 年 {yearMonth.month} 月
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={isCurrentMonth || isFuture}
            aria-label="下个月"
            aria-disabled={isCurrentMonth || isFuture}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md",
              isCurrentMonth || isFuture
                ? "cursor-not-allowed text-muted/40"
                : "text-muted hover:bg-[var(--muted)]",
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="[&>button]:h-9 [&>button]:w-9">
          <PrivacyToggle />
        </div>
      </div>
    </div>
  );
}
