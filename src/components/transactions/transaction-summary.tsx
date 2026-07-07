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
    <div className="flex justify-between rounded-lg bg-muted/50 px-4 py-2 text-sm">
      <span className="text-green-600">收入 {formatAmount(income)}</span>
      <span className="text-red-500">支出 {formatAmount(expense)}</span>
      <span className={net >= 0 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
        结余 {formatAmount(net)}
      </span>
    </div>
  );
}
