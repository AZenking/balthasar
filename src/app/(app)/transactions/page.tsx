"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { getUtcMonthRange } from "@/lib/date-ranges";
import {
  TransactionFilters,
  type FilterValues,
} from "@/components/transactions/transaction-filters";
import { TransactionSummary } from "@/components/transactions/transaction-summary";
import { TransactionListItem } from "@/components/transactions/transaction-list-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
    if (parsed) {
      const y = Number(parsed[1]);
      const m = Number(parsed[2]);
      if (y >= 2020 && m >= 1 && m <= 12) {
        const { start, end } = getUtcMonthRange(y, m);
        startDate = start.toISOString();
        endDate = end.toISOString();
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
  const isRefetching = isFetching && cursor === undefined && !isLoading;

  // ── First load skeleton ──
  if (isLoading) {
    return (
      <div className="space-y-4 p-4 pt-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <div className="p-4 pt-6">
        <h1 className="text-xl font-bold">流水</h1>
      </div>

      <TransactionFilters filters={filters} onChange={handleFiltersChange} />

      {summary && (
        <div className="px-4 py-2">
          <TransactionSummary
            income={summary.income}
            expense={summary.expense}
            net={summary.net}
          />
        </div>
      )}

      <div className={`px-4 ${isRefetching ? "opacity-50" : ""}`}>
        {items.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-muted-foreground">
              {hasFilters ? "无符合条件的交易" : "暂无交易"}
            </p>
          </div>
        ) : (
          <>
            {items.map((t) => (
              <TransactionListItem
                key={t.id}
                transaction={t}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}

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
