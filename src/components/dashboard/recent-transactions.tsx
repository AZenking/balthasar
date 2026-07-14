import { ReceiptText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  remark: string;
  occurredAt: string | Date;
  accountName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
}

export function RecentTransactions({
  transactions,
  isLoading,
}: {
  transactions: Transaction[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 px-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="暂无交易"
        description="记一笔,流水会显示在这里"
        className="min-h-[20vh]"
      />
    );
  }

  const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
  const formatTime = (date: string | Date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  return (
    <div className="divide-y px-4">
      {transactions.map((t) => (
        <div key={t.id} className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{t.categoryIcon}</span>
            <div>
              <p className="text-sm font-medium">{t.categoryName || "?"}</p>
              <p className="text-xs text-muted-foreground">
                {t.accountName} · {t.remark || "—"} · {formatTime(t.occurredAt)}
              </p>
            </div>
          </div>
          <p
            data-amount
            className={`text-sm font-semibold tabular-nums ${t.type === "income" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
          >
            {t.type === "income" ? "+" : "-"}
            {formatAmount(t.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}
