import { PieChart } from "lucide-react";
import { Meter } from "@heroui/react";
import { EmptyState } from "@/components/feedback/empty-state";
import { CategoryIcon } from "@/components/category/category-icon";

interface CategoryItem {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  amount: number;
  percentage: number;
}

export function CategoryBreakdown({ items }: { items: CategoryItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={PieChart}
        title="暂无支出"
        description="本月还没有支出记录"
        className="min-h-[16vh]"
      />
    );
  }

  const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-2 px-4">
      {items.map((c) => (
        <div key={c.categoryId}>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <CategoryIcon name={c.categoryIcon} size={18} />
              {c.categoryName}
            </span>
            <span className="text-muted-foreground">
              {formatAmount(c.amount)} · {c.percentage}%
            </span>
          </div>
          <Meter
            value={c.percentage}
            minValue={0}
            maxValue={100}
            color="accent"
            size="sm"
            aria-hidden="true"
            className="mt-1"
          >
            <Meter.Track>
              <Meter.Fill />
            </Meter.Track>
          </Meter>
        </div>
      ))}
    </div>
  );
}
