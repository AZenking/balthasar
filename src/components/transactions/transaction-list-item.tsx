import { cn } from "@/lib/utils";

const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
const formatDate = (date: string | Date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
};

export function TransactionListItem({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: {
    id: string;
    type: string;
    amount: number;
    remark: string;
    occurredAt: string | Date;
    accountName: string | null;
    categoryName: string | null;
    categoryIcon: string | null;
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b py-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">{transaction.categoryIcon}</span>
        <div>
          <p className="text-sm font-medium">{transaction.categoryName || "?"}</p>
          <p className="text-xs text-muted-foreground">
            {transaction.accountName} · {transaction.remark || "—"} · {formatDate(transaction.occurredAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className={cn(
          "text-sm font-semibold",
          transaction.type === "income" ? "text-green-600" : "text-red-500"
        )}>
          {transaction.type === "income" ? "+" : "-"}{formatAmount(transaction.amount)}
        </p>
        <button
          onClick={() => onEdit(transaction.id)}
          className="text-xs text-blue-500 hover:underline"
        >
          编辑
        </button>
        <button
          onClick={() => onDelete(transaction.id)}
          className="text-xs text-destructive hover:underline"
        >
          删除
        </button>
      </div>
    </div>
  );
}
