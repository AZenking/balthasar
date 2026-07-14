import { formatBalance } from "@/server/domain/account/currency";
import { cn } from "@/lib/utils";

export function AccountItem({
  account,
  onEdit,
  onArchive,
  onUnarchive,
}: {
  account: {
    id: string;
    name: string;
    currency: string;
    initialBalance: number;
    archivedAt: Date | null;
  };
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
}) {
  const isArchived = account.archivedAt !== null;
  return (
    <div className={cn(
      "flex items-center justify-between border-b py-3",
      isArchived && "opacity-50"
    )}>
      <div>
        <p className="text-sm font-medium">{account.name}</p>
        <p className="text-xs text-muted-foreground">
          {account.currency} · {formatBalance(account.initialBalance, account.currency as any)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isArchived ? (
          <>
            <span className="text-xs text-muted-foreground">已归档</span>
            <button
              onClick={() => onUnarchive(account.id)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              取消归档
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onEdit(account.id)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              编辑
            </button>
            <button
              onClick={() => onArchive(account.id)}
              className="text-xs text-destructive hover:underline"
            >
              归档
            </button>
          </>
        )}
      </div>
    </div>
  );
}
