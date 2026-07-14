"use client";

/**
 * MonthSelect (026-dashboard-ui-refinement:mobile Drawer + desktop Select)。
 *
 * 改造动机:
 * - Dashboard 首页 MonthSelect 此前为 HeroUI Select 下拉,语义与"选月份"
 *   不完全匹配(Select 是离散 enum,月份其实是 CalendarDate 维度的子集)。
 * - 与 TransactionDrawer 一致的"底部弹出"语义,移动端更顺手(单手拇指可
 *   触达),且能复用 Calendar 年/月切换(选历史月份比滚动 24 行列表快)。
 * - 桌面端(≥768px)Select popover 下拉枚举 24 月,鼠标用户更顺手(无需
 *   点开 Calendar),保留原 Select 体验。
 *
 * 设计:
 * - `useIsDesktop` hook:SSR 默认 false(BALTHASAR mobile-first,375 是主场景),
 *   hydration 后 useEffect 检测 matchMedia("(min-width: 768px)")并监听变化。
 *   保证首屏 SSR HTML 与 mobile hydration 一致,无 mismatch warning。
 * - `MonthSelectDrawer`(mobile,默认):外层 HeroUI `<Button variant="outline">`
 *   作为触发器,onPress 开 Drawer。`<Drawer placement="bottom">` 弹出
 *   `<DatePicker>` + `<Calendar>`(日期选择但只取 year+month,忽略 day)。
 * - `MonthSelectSelect`(desktop,≥768px):HeroUI `<Select>` + popover +
 *   `<ListBox>` 枚举最近 24 月,`<ListBoxItem id="YYYY-MM" textValue>`。
 *
 * 接口零变更:dashboard/page.tsx + reports/page.tsx 调用点不动。
 *
 * 注:reports 页也是 mobile-first,在桌面会切到 Select;若 reports 需要保持
 * 全 Drawer,可改本组件加 `forceDrawer` prop(目前无此需求)。
 */

import { useEffect, useState } from "react";
import {
  Button,
  Drawer,
  DatePicker,
  DateField,
  Calendar,
  Label,
  Select,
  ListBox,
  ListBoxItem,
} from "@heroui/react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { CalendarDate } from "@internationalized/date";
import { getLast24Months } from "@/lib/date-ranges";

interface MonthSelectProps {
  /** 当前选中年月(受控)。month 为 1-12。 */
  value: { year: number; month: number };
  /** 切换月份触发。 */
  onChange: (year: number, month: number) => void;
  /** 可选项:自定义月份列表(默认调用 getLast24Months())。
   *  - Drawer 模式:约束 Calendar 可选范围(minValue/maxValue)。
   *  - Select 模式:作为下拉枚举源(降序,当前月在顶)。 */
  months?: ReturnType<typeof getLast24Months>;
  /** 可访问性标签(默认"选择月份")。 */
  ariaLabel?: string;
  /** passthrough className(用于 PageHeader actions 限宽等场景)。 */
  className?: string;
}

/**
 * viewport 检测 hook。
 *
 * SSR 阶段(及首次客户端渲染)默认返回 false,与 mobile-first 的服务端
 * HTML 对齐;`useEffect` 跑完后切换到真实 viewport 状态,React 会 reconciliation
 * 而非 hydration mismatch(因为第一次客户端 render 也走的 false 分支)。
 *
 * 不直接用 useMediaQuery 库:本 hook 4 行足够,无需新增依赖。
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => setIsDesktop(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export function MonthSelect(props: MonthSelectProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) return <MonthSelectSelect {...props} />;
  return <MonthSelectDrawer {...props} />;
}

// ─── mobile:Drawer + DatePicker(单手拇指可达) ──────────────────────────

function MonthSelectDrawer({
  value,
  onChange,
  months,
  ariaLabel = "选择月份",
  className,
}: MonthSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  // {year, month} → CalendarDate(该月第一天,DatePicker value 用)
  const calendarValue = new CalendarDate(value.year, value.month, 1);

  // 从 months prop 推导可选范围(保留 24 月窗口语义)
  // months 数组是降序(当前月在前),最早月在数组末尾。
  const items = months ?? getLast24Months();
  const latest = items[0]; // 最新月(当前月)
  const earliest = items[items.length - 1]; // 最早月(24 月前)
  // maxValue:最新月最后一日;minValue:最早月第一天
  // 用最后一日避免选最后一天被裁掉(Calendar 范围是闭区间)
  const maxValue = new CalendarDate(latest.year, latest.month, 1);
  const minValue = new CalendarDate(earliest.year, earliest.month, 1);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onPress={() => setIsOpen(true)}
        aria-label={ariaLabel}
        className={className}
      >
        {/* HeroUI Button 继承 RAC Button(无 startContent/endContent slot),
            图标作为内联 children + flex gap 排列。 */}
        <CalendarIcon className="h-4 w-4 opacity-70" aria-hidden />
        <span>
          {value.year}年{value.month}月
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" aria-hidden />
      </Button>

      <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Backdrop>
          <Drawer.Content placement="bottom">
            <Drawer.Dialog>
              <Drawer.Handle />
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>{ariaLabel}</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                <DatePicker
                  value={calendarValue}
                  onChange={(date) => {
                    if (!date) return;
                    // 只取 year + month,忽略 day(月份选择语义)
                    onChange(date.year, date.month);
                    setIsOpen(false);
                  }}
                  minValue={minValue}
                  maxValue={maxValue}
                  aria-label={ariaLabel}
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
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}

// ─── desktop:HeroUI Select popover + ListBox 24 月枚举 ───────────────────

function MonthSelectSelect({
  value,
  onChange,
  months,
  ariaLabel = "选择月份",
  className,
}: MonthSelectProps) {
  // 降序枚举(当前月在顶),与 Drawer 的"最近在前"一致。
  const items = months ?? getLast24Months();
  // selectedKey 用 "YYYY-MM" 串(稳定且唯一),onChange 解析回数字。
  const selectedKey = `${value.year}-${String(value.month).padStart(2, "0")}`;

  return (
    <Select
      // 受控:React Aria 用 selectedKey + onSelectionChange
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key === null) return;
        const k = String(key);
        const [yStr, mStr] = k.split("-");
        const y = Number(yStr);
        const m = Number(mStr);
        if (Number.isFinite(y) && Number.isFinite(m)) {
          onChange(y, m);
        }
      }}
      aria-label={ariaLabel}
      className={className}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator>
          <ChevronDown className="h-4 w-4 opacity-50" aria-hidden />
        </Select.Indicator>
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map((m) => (
            <ListBoxItem
              key={`${m.year}-${String(m.month).padStart(2, "0")}`}
              id={`${m.year}-${String(m.month).padStart(2, "0")}`}
              textValue={m.label}
            >
              {m.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
