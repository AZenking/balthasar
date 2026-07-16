import { Card } from "@heroui/react";

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
        <Card.Content className="p-3 text-center">
          <p className="text-xs text-muted">收入</p>
          <p className="text-sm font-bold text-[var(--success)]">{formatAmount(monthIncome)}</p>
        </Card.Content>
      </Card>
      <Card>
        <Card.Content className="p-3 text-center">
          <p className="text-xs text-muted">支出</p>
          <p className="text-sm font-bold text-[var(--danger)]">{formatAmount(monthExpense)}</p>
        </Card.Content>
      </Card>
      <Card>
        <Card.Content className="p-3 text-center">
          <p className="text-xs text-muted">结余</p>
          <p className={`text-sm font-bold ${monthNet >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {formatAmount(monthNet)}
          </p>
        </Card.Content>
      </Card>
    </div>
  );
}
