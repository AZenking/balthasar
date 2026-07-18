import { Card } from "@heroui/react";

/**
 * SummaryHeroCard (027-mobile-home-revamp FR-001 + 030-home-trend-area-today US1)。
 *
 * 主数字 = 本月支出(反转 026 的"结余"主数字)。收入与结余为辅助行。
 *
 * 设计文档 §3.1-2:"本月支出作为主数字;本月收入和结余作为辅助数据"。
 * 026 实现以 monthNet(结余)为主数字,本组件反转语义。
 *
 * 030 US1:在本月支出右侧并排新增"本日支出"次级数字(主从层级)。
 * Clarification Q1:本月支出保持主大数字(027 FR-001 语义不变),本日支出
 * 为右侧次级较小数字(视觉权重低于主数字)。dayExpense=null(查询失败降级)
 * 显示 ¥--.--;0(无交易)是合法值显示 ¥0.00。
 *
 * HeroUI v3:Card 组合式 API(Card.Content)。金额节点挂 data-amount
 * 走全局 .privacy-on 遮蔽。
 */
function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

/**
 * 本日支出展示字符串(030 US1)。
 * - number → formatCents(分转元,两位小数)
 * - null   → ¥--.--(查询失败降级占位,FR-003)
 * 导出供组件测试锁定行为(T007)。
 */
export function formatDayExpense(dayExpense: number | null): string {
  return dayExpense === null ? "¥--.--" : formatCents(dayExpense);
}

export function SummaryHeroCard({
  monthIncome,
  monthExpense,
  monthNet,
  dayExpense,
}: {
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  dayExpense: number | null;
}) {
  const netColor = monthNet >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  return (
    <section aria-label="本月收支概览" className="pt-4">
      <Card>
        <Card.Content className="p-4">
          {/* 主从层级:本月支出(主大数字)+ 本日支出(右侧次级,030 US1) */}
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-xs text-muted">本月支出</p>
              <p
                data-amount
                className="mt-1 text-2xl font-semibold tabular-nums text-[var(--danger)] sm:text-3xl"
              >
                {formatCents(monthExpense)}
              </p>
            </div>
            <div className="flex flex-col items-end">
              <p className="text-xs text-muted">本日支出</p>
              <p
                data-amount
                className="mt-1 text-sm font-semibold tabular-nums text-[var(--danger)]"
              >
                {formatDayExpense(dayExpense)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted">收入</span>
              <span
                data-amount
                className="font-semibold tabular-nums text-[var(--success)]"
              >
                {formatCents(monthIncome)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted">结余</span>
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
