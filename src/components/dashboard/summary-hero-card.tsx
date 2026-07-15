"use client";

import { Card } from "@heroui/react";

/**
 * SummaryHeroCard (027-mobile-home-revamp FR-001).
 *
 * 主数字 = 本月支出(反转 026 的"结余"主数字)。收入与结余为辅助行。
 *
 * 设计文档 §3.1-2:"本月支出作为主数字;本月收入和结余作为辅助数据"。
 * 026 实现以 monthNet(结余)为主数字,本组件反转语义。
 *
 * HeroUI v3:Card 组合式 API(Card.Content)。金额节点挂 data-amount
 * 走全局 .privacy-on 遮蔽。
 */
function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export function SummaryHeroCard({
  monthIncome,
  monthExpense,
  monthNet,
}: {
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
}) {
  const netColor = monthNet >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  return (
    <section aria-label="本月收支概览" className="pt-4">
      <Card>
        <Card.Content className="p-4">
          <p className="text-xs text-muted-foreground">本月支出</p>
          <p
            data-amount
            className="mt-1 text-2xl font-semibold tabular-nums text-[var(--danger)] sm:text-3xl"
          >
            {formatCents(monthExpense)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">收入</span>
              <span
                data-amount
                className="font-semibold tabular-nums text-[var(--success)]"
              >
                {formatCents(monthIncome)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">结余</span>
              <span
                data-amount
                className={`font-semibold tabular-nums ${netColor}`}
              >
                {formatCents(monthNet)}
              </span>
            </div>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}
