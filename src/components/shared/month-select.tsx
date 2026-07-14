"use client";

/**
 * MonthSelect (026-switch 第一期 6: 统一 MonthSelect)。
 *
 * Dashboard 首页与报表页共用的"最近 24 个月"月份选择器。HeroUI v3
 * Select 组合式 API(`Select` + `Select.Trigger`/`Value`/`Indicator`/
 * `Popover` + `ListBox`/`ListBox.Item`)。
 *
 * 替代历史实现:
 * - `src/components/dashboard/month-picker.tsx`(DatePicker + 隐藏 day
 *   segment hack)——语义不清(日期与月份冲突),已删除。
 * - `src/app/(app)/reports/page.tsx` 内联 shadcn-style Select——与
 *   dashboard 不一致,已替换为本组件。
 *
 * 接口:`{value: {year, month}, onChange: (year, month) => void}`,
 * 与原 MonthPicker 完全兼容,call site 只需换名字。
 *
 * selectedKey 用 `${year}-${month}`(无前导零,与 ListBox.Item.id 对齐)。
 * `onSelectionChange` 拿到 key 后 split 还原 year/month。
 */

import { Select, ListBox } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { getLast24Months } from "@/lib/date-ranges";

interface MonthSelectProps {
  /** 当前选中年月(受控)。month 为 1-12。 */
  value: { year: number; month: number };
  /** 切换月份触发。 */
  onChange: (year: number, month: number) => void;
  /** 可选项:自定义月份列表(默认调用 getLast24Months())。 */
  months?: ReturnType<typeof getLast24Months>;
  /** 可访问性标签(默认"选择月份")。 */
  ariaLabel?: string;
  /** passthrough className(用于 PageHeader actions 限宽等场景)。 */
  className?: string;
}

export function MonthSelect({
  value,
  onChange,
  months,
  ariaLabel = "选择月份",
  className,
}: MonthSelectProps) {
  const items = months ?? getLast24Months();
  const selectedKey = `${value.year}-${value.month}`;

  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key == null) return;
        const [y, m] = String(key).split("-").map(Number);
        if (Number.isFinite(y) && Number.isFinite(m)) {
          onChange(y, m);
        }
      }}
      className={className}
      fullWidth
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Select.Indicator>
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map((m) => {
            const key = `${m.year}-${m.month}`;
            return (
              <ListBox.Item key={key} id={key} textValue={m.label}>
                {m.label}
              </ListBox.Item>
            );
          })}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
