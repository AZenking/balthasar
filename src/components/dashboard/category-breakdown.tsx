interface CategoryItem {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  amount: number;
  percentage: number;
}

export function CategoryBreakdown({ items }: { items: CategoryItem[] }) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">暂无支出</p>;
  }

  const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-2 px-4">
      {items.map((c) => (
        <div key={c.categoryId}>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <span className="text-base">{c.categoryIcon}</span>
              {c.categoryName}
            </span>
            <span className="text-muted-foreground">
              {formatAmount(c.amount)} · {c.percentage}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${c.percentage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
