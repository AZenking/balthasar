"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Bell } from "lucide-react";
import { toast } from "sonner";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { cn } from "@/lib/utils";

/**
 * DashboardTopNav (027-mobile-home-revamp FR-002).
 *
 * 首页顶部导航:账本名称 + 年月 + 上月/下月箭头 + 左右滑动手势 +
 * 消息占位 + 隐私开关。
 *
 * 设计文档 §3.1-1:"账本名称;当前年月;上月、下月切换入口;消息入口"。
 * §4.1:"用户可以点击箭头或左右滑动切换月份;未来月份不可选择"。
 *
 * 与 026 的差异:026 用 PageHeader(标题"首页"+问候)+ MonthSelect
 * (Calendar Drawer)。027 改为本组件:账本名 + 箭头切月 + 滑动手势,
 * 符合设计稿的 `‹ 2026 年 7 月 ›` 形态。
 *
 * HeroUI v3:用原生 button + tailwind;无 HeroUI 原生 MonthNav。
 * 滑动手势:轻量 touchstart/touchend X 位移判定(无新依赖,research R7
 * 同款降级路径)。
 */

/** 当前 UTC 年月(边界判断用)。 */
function currentUtcYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/** 上一月(跨年自动回滚)。 */
function prevMonth(y: number, m: number): { year: number; month: number } {
  if (m === 1) return { year: y - 1, month: 12 };
  return { year: y, month: m - 1 };
}

/** 下一月(跨年自动前进)。 */
function nextMonth(y: number, m: number): { year: number; month: number } {
  if (m === 12) return { year: y + 1, month: 1 };
  return { year: y, month: m + 1 };
}

export function DashboardTopNav({
  yearMonth,
  onChange,
  ledgerName = "我的账本",
}: {
  yearMonth: { year: number; month: number };
  onChange: (year: number, month: number) => void;
  /** 账本名称;默认"我的账本"(单成员 MVP 暂无多账本,取固定文案)。 */
  ledgerName?: string;
}) {
  const touchStartX = useRef<number | null>(null);
  const now = currentUtcYearMonth();
  // 未来月份不可选(FR-002 / §4.1):当前月 = 边界,下月按钮在当前月时禁用。
  const isCurrentMonth =
    yearMonth.year === now.year && yearMonth.month === now.month;
  const isFuture =
    yearMonth.year > now.year ||
    (yearMonth.year === now.year && yearMonth.month > now.month);

  const goPrev = () => onChange(prevMonth(yearMonth.year, yearMonth.month).year, prevMonth(yearMonth.year, yearMonth.month).month);
  const goNext = () => {
    if (isCurrentMonth || isFuture) return; // 边界禁用
    const n = nextMonth(yearMonth.year, yearMonth.month);
    onChange(n.year, n.month);
  };

  // 左右滑动:touchstart 记 X,touchend 比 X 位移 > 阈值则切月。
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    const threshold = 40;
    if (dx > threshold) goPrev(); // 右滑 = 上月
    else if (dx < -threshold) goNext(); // 左滑 = 下月
    touchStartX.current = null;
  };

  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      {/* 左:账本名称(点击预留进账本管理,V2) */}
      <button
        type="button"
        className="min-w-0 truncate text-sm font-medium text-foreground"
        aria-label={`账本:${ledgerName}`}
      >
        <span className="truncate">{ledgerName}</span>
      </button>

      {/* 中:月份切换 ‹ 2026 年 7 月 › + 滑动手势 */}
      <div
        className="flex items-center gap-1"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          onClick={goPrev}
          aria-label="上个月"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="min-w-[5.5rem] text-center text-sm font-medium tabular-nums">
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
            (isCurrentMonth || isFuture)
              ? "cursor-not-allowed text-muted-foreground/40"
              : "text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground",
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 右:消息占位 + 隐私开关 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => toast.info("暂无消息")}
          aria-label="消息"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
        </button>
        <PrivacyToggle />
      </div>
    </div>
  );
}
