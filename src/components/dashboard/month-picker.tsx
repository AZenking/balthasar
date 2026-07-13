"use client";

/**
 * MonthPicker (026-cream-amber-revamp, spec US4 / FR-C002 / clarify Q2).
 *
 * **HeroUI v3 DatePicker 实现**(2026-07-13 修订):用户在日历选某天,
 * 组件 onChange 只取 year+month 给父组件(忽略 day)。DateField 显示
 * 年/月/日 3 段,但 day 通过 `[data-type="day"]` CSS 隐藏(让视觉只
 * 显示 YYYY/MM,符合"选月"语义)。
 *
 * 替代方案考量(已否决):
 * - HeroUI 无原生 MonthPicker
 * - React Aria granularity 仅支持到 'day',无 'month' level
 * - 自定义 Calendar month-only grid 复杂且破坏 react-aria 内部状态
 * - HeroUI Select + 24 月枚举(原方案):移动端 UX 优,但用户偏好 DatePicker
 *
 * 数据源:`{year, month}` ↔ `CalendarDate(year, month, 1)` 转换。
 *
 * 移动端命中区域 ≥ 44px(FR-A007):HeroUI DatePicker trigger 默认高度
 * ≥ 40px,padding 扩展触摸热区满足。
 */

import {
  DatePicker,
  Calendar,
  DateField,
  Label,
} from "@heroui/react";
import { CalendarDate } from "@internationalized/date";

interface MonthPickerProps {
  /** 当前选中年月(受控)。month 为 1-12。 */
  value: { year: number; month: number };
  /** 切换月份触发。父组件用于触发 dashboard.summary 重取。 */
  onChange: (year: number, month: number) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  // {year, month} → CalendarDate(该月第一天;DatePicker 必须有完整日期)。
  const calendarValue = new CalendarDate(value.year, value.month, 1);

  const handleChange = (date: CalendarDate | null) => {
    if (!date) return;
    // 只取 year + month,忽略 day(选月语义)。
    onChange(date.year, date.month);
  };

  return (
    <DatePicker
      value={calendarValue}
      onChange={handleChange}
      aria-label="选择月份"
      // 隐藏 DateField 的 day segment(只显示 YYYY/MM)
      className="month-picker-no-day w-full"
    >
      <Label className="sr-only">选择月份</Label>
      <DateField.Group fullWidth>
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover>
        <Calendar aria-label="月份选择日历">
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => <Calendar.Cell date={date} />}
            </Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>
              {({ year }) => <Calendar.YearPickerCell year={year} />}
            </Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}
