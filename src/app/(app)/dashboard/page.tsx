"use client";

import { trpc } from "@/lib/trpc/client";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data, isLoading } = trpc.dashboard.summary.useQuery();

  if (isLoading || !data) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="px-4 pb-2 pt-6 text-xl font-bold">首页</h1>
      <SummaryCards
        monthIncome={data.monthIncome}
        monthExpense={data.monthExpense}
        monthNet={data.monthNet}
      />
      <div className="mt-6">
        <h2 className="px-4 pb-2 text-sm font-semibold text-muted-foreground">最近交易</h2>
        <RecentTransactions transactions={data.recentTransactions} isLoading={false} />
      </div>
      <div className="mt-6 pb-4">
        <h2 className="px-4 pb-2 text-sm font-semibold text-muted-foreground">支出分类</h2>
        <CategoryBreakdown items={data.topExpenseCategories} />
      </div>
    </div>
  );
}
