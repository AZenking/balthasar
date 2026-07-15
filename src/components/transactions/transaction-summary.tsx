const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

/**
 * TransactionSummary — 线稿式三列卡片(收入/支出/结余)。
 * 大金额 + 列分隔,移除嵌套背景条。
 */
export function TransactionSummary({
  income,
  expense,
  net,
}: {
  income: number;
  expense: number;
  net: number;
}) {
  const netColor = net >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  return (
    <div className="grid grid-cols-3 text-center">
      <div className="border-r border-[var(--border)] py-2">
        <p className="text-xs text-muted-foreground">收入</p>
        <p data-amount className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--success)]">
          {formatAmount(income)}
        </p>
      </div>
      <div className="border-r border-[var(--border)] py-2">
        <p className="text-xs text-muted-foreground">支出</p>
        <p data-amount className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--danger)]">
          {formatAmount(expense)}
        </p>
      </div>
      <div className="py-2">
        <p className="text-xs text-muted-foreground">结余</p>
        <p data-amount className={`mt-0.5 text-sm font-semibold tabular-nums ${netColor}`}>
          {formatAmount(net)}
        </p>
      </div>
    </div>
  );
}
