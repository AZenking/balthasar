const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export function TransactionSummary({
  income,
  expense,
  net,
}: {
  income: number;
  expense: number;
  net: number;
}) {
  return (
    <div className="flex justify-between rounded-lg bg-[var(--surface-secondary)] px-4 py-2 text-sm tabular-nums">
      <span data-amount className="text-[var(--success)]">
        收入 {formatAmount(income)}
      </span>
      <span data-amount className="text-[var(--danger)]">
        支出 {formatAmount(expense)}
      </span>
      <span
        data-amount
        className={
          net >= 0
            ? "font-semibold text-[var(--success)]"
            : "font-semibold text-[var(--danger)]"
        }
      >
        结余 {formatAmount(net)}
      </span>
    </div>
  );
}
