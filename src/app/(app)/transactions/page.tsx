"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { ReceiptText } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

// 027 US3 (FR-010): 按日分组 + 组头小计已抽取到 TransactionDayGroup 组件
// (src/components/transactions/transaction-day-group.tsx),含 groupByUtcDay /
// daySubtotal 纯函数(单测 T019)。本页只做装配。

// ── Build the human-readable filter description for the Card header ──
//
// Priority: month (from URL) > type > categoryId > account > 全部交易.
// Uses the categories/accounts list to resolve ids to display names.
function useFilterDescription(
  urlMonth: string | null,
  type: "income" | "expense" | "transfer" | undefined,
  categoryId: string | undefined,
  accountId: string | undefined
): string {
  const { data: categories } = trpc.category.list.useQuery(undefined);
  const { data: accounts } = trpc.account.list.useQuery();

  const parts: string[] = [];
  if (urlMonth) {
    const m = urlMonth.match(/^(\d{4})-(\d{2})$/);
    if (m) parts.push(`${Number(m[1])}年${Number(m[2])}月`);
  }
  if (type === "income") parts.push("仅收入");
  else if (type === "expense") parts.push("仅支出");
  else if (type === "transfer") parts.push("仅转账");

  if (categoryId) {
    const c = (categories ?? []).find((x) => x.id === categoryId);
    if (c) parts.push(`${c.icon ?? ""} ${c.name}`.trim());
  }
  if (accountId) {
    const a = (accounts ?? []).find((x) => x.id === accountId);
    if (a) parts.push(a.name);
  }

  return parts.length > 0 ? parts.join(" · ") : "全部交易";
}

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  // ── URL drill-down params (026 US6 / FR-C006) ──
  // Dashboard Top 2 category cards and reports page link here with:
  //   ?month=YYYY-MM&type=expense&categoryId=<uuid>
  // Invalid / out-of-range values are silently ignored so the page degrades
  // gracefully to the unfiltered list (FR-C006 acceptance 3).
  const urlFilters = useMemo(() => {
    const month = searchParams.get("month"); // "YYYY-MM" | null
    const type = searchParams.get("type"); // "income" | "expense" | null
    const categoryId = searchParams.get("categoryId"); // uuid | null

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

    // Narrow `type` to the union the procedure accepts.
    let validType: "income" | "expense" | undefined;
    if (type === "income" || type === "expense") validType = type;
    // categoryId: trust server to ignore cross-family ids (FR-C006 acc 3);
    // we only sanity-check the shape so a malformed value doesn't 400 the query.
    const validCategoryId =
      categoryId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)
        ? categoryId
        : undefined;

    return {
      type: validType,
      categoryId: validCategoryId,
      startDate,
      endDate,
      monthRaw,
    };
  }, [searchParams]);

  // ── Filter state (in-page dropdown, overrides URL) ──
  const [filters, setFilters] = useState<FilterValues>({
    type: undefined,
    accountId: undefined,
    categoryId: undefined,
  });

  // ── Delete confirm state (025: AlertDialog state-driven, replaces native confirm) ──
  const [confirmingTxId, setConfirmingTxId] = useState<string | null>(null);

  // ── Pagination state ──
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Query: fetches current page based on URL drill-down + in-page filters + cursor ──
  // URL params seed the initial filter; in-page filter dropdowns layer on top.
  // Both sources are merged here — `filters` overrides URL values when set so the
  // user can refine the drill-down result interactively.
  const { data, isLoading, isFetching } = trpc.transaction.list.useQuery({
    type: filters.type ?? urlFilters.type,
    accountId: filters.accountId,
    categoryId: filters.categoryId ?? urlFilters.categoryId,
    startDate: urlFilters.startDate,
    endDate: urlFilters.endDate,
    cursor,
    includeSummary: true,
  });

  // ── Merge fetched data into accumulated items ──
  useEffect(() => {
    if (!data) return;
    if (cursor === undefined) {
      // First page or filter change → replace
      setItems(data.items);
    } else {
      // Subsequent page → append
      setItems((prev) => [...prev, ...data.items]);
    }
    setNextCursor(data.nextCursor);
    setIsLoadingMore(false);
  }, [data, cursor]);

  // ── Filter change → reset pagination ──
  const handleFiltersChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setCursor(undefined);
    setNextCursor(null);
  };

  // ── Load more ──
  const handleLoadMore = () => {
    if (nextCursor) {
      setIsLoadingMore(true);
      setCursor(nextCursor);
    }
  };

  // ── Delete mutation (025: toast feedback added, AlertDialog-driven) ──
  const deleteMutation = trpc.transaction.delete.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("已删除");
      setConfirmingTxId(null);
    },
    onError: (err) =>
      toast.error(
        err instanceof TRPCClientError ? err.message : "删除失败"
      ),
  });

  const handleEdit = (id: string) => {
    // FR-B004: carry current URL filter params (month/type/categoryId) to the
    // edit page so transaction-form can restore them on the return navigation.
    const qs = searchParams.toString();
    router.push(qs ? `/transaction/new?id=${id}&${qs}` : `/transaction/new?id=${id}`);
  };

  // 025: open AlertDialog instead of native browser confirm
  const handleDelete = (id: string) => {
    setConfirmingTxId(id);
  };

  const confirmDelete = () => {
    if (!confirmingTxId) return;
    deleteMutation.mutate({ id: confirmingTxId });
  };

  const summary = data?.summary;
  const hasFilters =
    filters.type ||
    filters.accountId ||
    filters.categoryId ||
    urlFilters.type ||
    urlFilters.categoryId ||
    urlFilters.startDate;

  // Active filter resolution (in-page overrides URL).
  const effectiveType = filters.type ?? urlFilters.type;
  const effectiveCategoryId = filters.categoryId ?? urlFilters.categoryId;
  const filterDescription = useFilterDescription(
    urlFilters.monthRaw,
    effectiveType,
    effectiveCategoryId,
    filters.accountId
  );

  const isRefetching = isFetching && cursor === undefined && !isLoading;

  // ── First load skeleton ──
  // PageHeader(title="流水" + filterDescription + count)同步渲染不需要占位;
  // 这里复刻 SummaryCard (~h-10) + 流水列表项 (~h-16 × 6) 高度,降低加载完成跳动。
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 026 US6 + 026-switch:Header 用 PageHeader,Card 仅承载 summary */}
      <PageHeader
        title="明细"
        description={filterDescription}
        actions={
          <span className="text-xs text-muted-foreground">{items.length} 笔</span>
        }
      />

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

      <TransactionFilters filters={filters} onChange={handleFiltersChange} />

      <div className={`${isRefetching ? "opacity-50" : ""}`}>
        {items.length === 0 ? (
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
                <Button onClick={() => router.push("/transaction/new")}>
                  记一笔
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* 027 US3 (FR-010): 列表按 UTC 日历日分组 + 组头收支小计 */}
            <TransactionDayGroup
              items={items}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />

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

      {/* 025: shadcn AlertDialog destructive — replaces native browser confirm */}
      <AlertDialog
        open={confirmingTxId !== null}
        onOpenChange={(o) => !o && setConfirmingTxId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销,该交易记录将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={confirmDelete}
              >
                {deleteMutation.isPending ? "删除中..." : "确认删除"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
