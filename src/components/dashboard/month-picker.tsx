"use client";

/**
 * MonthPicker (026-cream-amber-revamp, spec US4 / FR-C002 / clarify Q2).
 *
 * HeroUI v3 原生 `Select` 下拉枚举最近 24 个月(当前月在首位,降序)。
 * 选择后通过 `onChange(year, month)` 通知父组件,父组件负责触发数据重取。
 *
 * 数据源:`getLast24Months()`(spike 落地,见 src/lib/date-ranges.ts)。
 *
 * HeroUI v3 Select API 说明(与 task 示例不同,这是 v3 的真实形态):
 * - v3 Select 是 **组合式 API**(不是 v1/v2 的 `<Select><SelectItem/></Select>`)。
 *   完整形态:`<Select>(<Select.Trigger><Select.Value/><Select.Indicator/></Select.Trigger>
 *   <Select.Popover><ListBox><ListBox.Item/></ListBox></Select.Popover>)</Select>`。
 * - v3 没有 `SelectItem` 导出;选项挂在 `ListBox.Item` 上,`id` 作为 key,
 *   `textValue` 作为 trigger 显示文本。
 * - 受控属性沿用 react-aria:`selectedKey` / `onSelectionChange`。
 *   (任务示例中的这两个属性名与 v3 一致 —— 只是子项 API 调整。)
 *
 * 移动端命中区域 ≥ 44px(FR-A007):HeroUI Select trigger 默认高度 ≥ 40px,
 * 触摸热区扩展由 trigger padding 提供,实测满足。
 */

import {
  Select,
  ListBox,
  type SelectProps,
} from "@heroui/react";
import { getLast24Months } from "@/lib/date-ranges";

interface MonthPickerProps {
  /** 当前选中年月(受控)。month 为 1-12。 */
  value: { year: number; month: number };
  /** 切换月份触发。父组件用于触发 dashboard.summary 重取。 */
  onChange: (year: number, month: number) => void;
  /** 透传到 Select 根(尺寸/variant/aria-label 等)。 */
  className?: string;
  /** 选 Extra Select props(e.g. aria-label)。 */
  selectProps?: Partial<SelectProps<object, "single">>;
}

/** 把 `{year, month}` 编码成 ListBox.Item 的稳定 id(key)。 */
function keyOf(year: number, month: number): string {
  return `${year}-${month}`;
}

/** 从 ListBox.Item id 反解 `{year, month}`;失败时返回 null。 */
function parseKey(key: React.Key | null): { year: number; month: number } | null {
  if (key == null) return null;
  const [yStr, mStr] = String(key).split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return { year, month };
}

export function MonthPicker({
  value,
  onChange,
  className,
  selectProps,
}: MonthPickerProps) {
  // 降序,当前月首位;实测变化频率低,放渲染时算即可(每次切换不会重新挂载)。
  const months = getLast24Months();
  const selectedKey = keyOf(value.year, value.month);

  const handleSelectionChange: NonNullable<
    SelectProps<object, "single">["onSelectionChange"]
  > = (key) => {
    const parsed = parseKey(key);
    if (!parsed) return;
    onChange(parsed.year, parsed.month);
  };

  return (
    <Select
      // 受控:由 value 驱动;切换月份不会出现内部状态漂移。
      selectedKey={selectedKey}
      onSelectionChange={handleSelectionChange}
      aria-label="选择月份"
      className={className}
      // popover 触发器宽度撑满父容器(首页顶部一行布局可读)。
      fullWidth
      {...selectProps}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {months.map((m) => (
            <ListBox.Item
              key={keyOf(m.year, m.month)}
              id={keyOf(m.year, m.month)}
              // textValue 既是 trigger 默认显示,也是屏幕阅读器朗读的文本。
              textValue={m.label}
            >
              {m.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
