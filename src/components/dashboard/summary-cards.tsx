import { Card, CardContent } from "@/components/ui/card";

export function SummaryCards({
  monthIncome,
  monthExpense,
  monthNet,
}: {
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
}) {
  const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
  return (
    <div className="grid grid-cols-3 gap-2 px-4 pt-4">
      <Card>
        <CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">收入</p>
          <p className="text-sm font-bold text-[var(--success)]">{formatAmount(monthIncome)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">支出</p>
          <p className="text-sm font-bold text-[var(--danger)]">{formatAmount(monthExpense)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">结余</p>
          <p className={`text-sm font-bold ${monthNet >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {formatAmount(monthNet)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
