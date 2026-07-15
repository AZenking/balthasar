"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ReceiptText,
  Search,
  CalendarDays,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { getUtcMonthRange } from "@/lib/date-ranges";
import { Card } from "@heroui/react";
import {
  TransactionFilters,
  type FilterValues,
} from "@/components/transactions/transaction-filters";
import { TransactionSummary } from "@/components/transactions/transaction-summary";
import { TransactionDayGroup } from "@/components/transactions/transaction-day-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";

type TransactionItem = {
  id: string;
  type: string;
  amount: number;
  remark: string;
  occurredAt: string | Date;
  accountName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
};

// 触控目标 + 焦点环共用工具类:移动端 ≥44px、键盘 focus-visible ring。
const ICON_BTN_CLS =
  "flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── 单一数据源:所有筛选状态都从 URL 读取(month/type/categoryId/accountId)──
  // URL 既负责入站 drill-down(dashboard/reports 跳转),也负责页内筛选同步,
  // 保证刷新/分享/返回时筛选状态不丢。
  const urlFilters = useMemo(() => {
    const month = searchParams.get("month"); // "YYYY-MM" | null
    const type = searchParams.get("type"); // "income" | "expense" | "transfer" | null
    const categoryId = searchParams.get("categoryId"); // uuid | null
    const accountId = searchParams.get("accountId"); // uuid | null

    const parsed = month?.match(/^(\d{4})-(\d{2})$/);
    let startDate: string | undefined;
    let endDate: string | undefined;
    let monthRaw: string | null = null;
    if (parsed) {
      const y = Number(parsed[1]);
      const m = Number(parsed[2]);
      if (y >= 2020 && m >= 1 && m <= 12) {
        const { start, end } = getUtcMonthRange(y, m);
        startDate = start.toISOString();
        endDate = end.toISOString();
        monthRaw = month;
      }
    }

    const validType:
      | "income"
      | "expense"
      | "transfer"
      | undefined =
      type === "income" || type === "expense" || type === "transfer"
        ? type
        : undefined;
    const validCategoryId =
      categoryId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        categoryId,
      )
        ? categoryId
        : undefined;
    const validAccountId =
      accountId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        accountId,
      )
        ? accountId
        : undefined;

    return {
      type: validType,
      categoryId: validCategoryId,
      accountId: validAccountId,
      startDate,
      endDate,
      monthRaw,
    };
  }, [searchParams]);

  // ── 写入筛选到 URL(replace,避免历史堆积)──
  const applyFilter = useCallback(
    (patch: Partial<Pick<FilterValues, "type" | "accountId" | "categoryId">>) => {
      const qs = new URLSearchParams(searchParams.toString());
      // undefined → 删除该 key(清筛选)
      for (const [k, v] of Object.entries(patch)) {
        if (v) qs.set(k, v);
        else qs.delete(k);
      }
      router.replace(`/transactions?${qs.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  const filters: FilterValues = useMemo(
    () => ({
      type: urlFilters.type,
      accountId: urlFilters.accountId,
      categoryId: urlFilters.categoryId,
    }),
    [urlFilters],
  );

  const handleFiltersChange = useCallback(
    (next: FilterValues) => {
      applyFilter({
        type: next.type,
        accountId: next.accountId,
        categoryId: next.categoryId,
      });
    },
    [applyFilter],
  );

  const [expanded, setExpanded] = useState(true); // 筛选区常驻(线稿)

  // ── 分页:cursor 仅本地态(不进 URL,避免"加载更多"污染可分享链接)──
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading, isFetching, error } = trpc.transaction.list.useQuery({
    type: urlFilters.type,
    accountId: urlFilters.accountId,
    categoryId: urlFilters.categoryId,
    startDate: urlFilters.startDate,
    endDate: urlFilters.endDate,
    cursor,
    includeSummary: true,
  });

  // ── 合并分页结果 ──
  useEffect(() => {
    if (!data) return;
    if (cursor === undefined) {
      setItems(data.items); // 首页 / 筛选变化 → 替换
    } else {
      setItems((prev) => [...prev, ...data.items]); // 后续页 → 追加
    }
    setNextCursor(data.nextCursor);
    setIsLoadingMore(false);
  }, [data, cursor]);

  const handleLoadMore = () => {
    if (nextCursor) {
      setIsLoadingMore(true);
      setCursor(nextCursor);
    }
  };

  // ListItem 用 <Link> 渲染,需构造完整编辑 href(含筛选 qs)。
  const buildEditHref = (id: string) => {
    const qs = searchParams.toString();
    return qs ? `/transaction/new?id=${id}&${qs}` : `/transaction/new?id=${id}`;
  };

  const summary = data?.summary;
  const hasFilters = Boolean(
    urlFilters.type ||
      urlFilters.accountId ||
      urlFilters.categoryId ||
      urlFilters.startDate,
  );

  const isRefetching = isFetching && cursor === undefined && !isLoading;

  return (
    <div>
      {/* 线稿对齐:第一行 标题 + 搜索/日历 */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-medium">明细</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toast.info("搜索功能即将上线")}
            aria-label="搜索"
            className={ICON_BTN_CLS}
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => toast.info("日历视图即将上线")}
            aria-label="日历"
            className={ICON_BTN_CLS}
          >
            <CalendarDays className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 第二行:‹ 年月 › + 筛选 */}
      <div className="flex items-center justify-between py-3">
        <MonthSwitcher
          monthRaw={urlFilters.monthRaw}
          onMonthChange={(y, m) => {
            const qs = new URLSearchParams(searchParams.toString());
            qs.set("month", `${y}-${String(m).padStart(2, "0")}`);
            router.push(`/transactions?${qs.toString()}`);
          }}
        />
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="筛选"
        >
          <SlidersHorizontal className="h-4 w-4" />
          筛选
        </button>
      </div>

      {summary && (
        <Card className="mt-2">
          <Card.Content className="p-4">
            <TransactionSummary
              income={summary.income}
              expense={summary.expense}
              net={summary.net}
            />
          </Card.Content>
        </Card>
      )}

      {/* 筛选区(展开时显示) */}
      {expanded && (
        <TransactionFilters filters={filters} onChange={handleFiltersChange} />
      )}

      <div className={`${isRefetching ? "opacity-50" : ""}`}>
        {error ? (
          // #5 错误态:列表查询失败兜底
          <EmptyState
            icon={ReceiptText}
            title="加载失败"
            description="网络或服务异常,请稍后重试"
            action={
              <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                重试
              </Button>
            }
          />
        ) : isLoading ? (
          // #7 skeleton 只占位列表区,页头/筛选常驻(加载完不跳动、导航不中断)
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={ReceiptText}
              title="无符合条件的交易"
              description="试试调整筛选条件,或清除全部过滤"
            />
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="暂无交易"
              description="开始记账,记录每一笔收支"
              action={
                // #4 记一笔用 Link(可中键/⌘点击新标签、可右键复制链接)
                <Link href="/transaction/new" className={buttonVariants()}>
                  记一笔
                </Link>
              }
            />
          )
        ) : (
          <>
            {/* 027 US3 (FR-010): 列表按 UTC 日历日分组 + 组头收支小计 */}
            <TransactionDayGroup items={items} buildEditHref={buildEditHref} />

            {nextCursor !== null && (
              <div className="py-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "加载中..." : "加载更多"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** ‹ 2026 年 7 月 › 月份切换(线稿口径,非 Drawer)。 */
function MonthSwitcher({
  monthRaw,
  onMonthChange,
}: {
  monthRaw: string | null;
  onMonthChange: (year: number, month: number) => void;
}) {
  const now = new Date();
  const currentY = now.getUTCFullYear();
  const currentM = now.getUTCMonth() + 1;

  let y = currentY;
  let m = currentM;
  if (monthRaw) {
    const match = monthRaw.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      y = Number(match[1]);
      m = Number(match[2]);
    }
  }

  const isCurrent = y === currentY && m === currentM;
  const goPrev = () => {
    if (m === 1) onMonthChange(y - 1, 12);
    else onMonthChange(y, m - 1);
  };
  const goNext = () => {
    if (isCurrent) return;
    if (m === 12) onMonthChange(y + 1, 1);
    else onMonthChange(y, m + 1);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={goPrev}
        aria-label="上个月"
        className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-[5.5rem] text-center text-sm font-medium tabular-nums">
        {y} 年 {m} 月
      </span>
      <button
        type="button"
        onClick={goNext}
        disabled={isCurrent}
        aria-label="下个月"
        className={`flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isCurrent
            ? "cursor-not-allowed text-muted-foreground/40"
            : "text-muted-foreground hover:bg-[var(--muted)]"
        }`}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
