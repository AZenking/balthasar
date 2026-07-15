"use client";

import { Tabs } from "@heroui/react";

/**
 * StatsPeriodToggle (027-mobile-home-revamp US3 FR-011).
 *
 * 统计页月/年周期切换。月=本月维度(支出/日均/较上月);年=全年维度
 * (支出/月均/较去年)。标签由 periodLabels 派生(供 T020 单测)。
 *
 * HeroUI v3:Tabs 组合式(Tabs.List + Tabs.Tab),selectedKey + onSelectionChange。
 */

export type StatsPeriod = "month" | "year";

export interface PeriodLabels {
  total: string;
  average: string;
  comparison: string;
}

/** 月/年周期对应的摘要标签(导出供 T020 单测)。 */
export function periodLabels(period: StatsPeriod): PeriodLabels {
  if (period === "year") {
    return { total: "全年支出", average: "月均支出", comparison: "较去年" };
  }
  return { total: "本月支出", average: "日均支出", comparison: "较上月" };
}

export function StatsPeriodToggle({
  period,
  onChange,
}: {
  period: StatsPeriod;
  onChange: (period: StatsPeriod) => void;
}) {
  return (
    <Tabs
      aria-label="统计周期"
      selectedKey={period}
      onSelectionChange={(key) => {
        if (key === "month" || key === "year") onChange(key);
      }}
    >
      <Tabs.List>
        <Tabs.Tab id="month">月</Tabs.Tab>
        <Tabs.Tab id="year">年</Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
}
