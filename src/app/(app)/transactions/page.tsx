"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  TransactionFilters,
  type FilterValues,
} from "@/components/transactions/transaction-filters";
import { TransactionSummary } from "@/components/transactions/transaction-summary";
import { TransactionListItem } from "@/components/transactions/transaction-list-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

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
  const utils = trpc.useUtils();

  // ── Filter state ──
  const [filters, setFilters] = useState<FilterValues>({
    type: undefined,
    accountId: undefined,
    categoryId: undefined,
  });

  // ── Pagination state ──
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Query: fetches current page based on filters + cursor ──
  const { data, isLoading, isFetching } = trpc.transaction.list.useQuery({
    type: filters.type,
    accountId: filters.accountId,
    categoryId: filters.categoryId,
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

  // ── Delete mutation ──
  const deleteMutation = trpc.transaction.delete.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.dashboard.summary.invalidate();
    },
  });

  const handleEdit = (id: string) => {
    router.push(`/transaction/new?id=${id}`);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("确认删除?")) {
      deleteMutation.mutate({ id });
    }
  };

  const summary = data?.summary;
  const hasFilters = filters.type || filters.accountId || filters.categoryId;
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
    </div>
  );
}
