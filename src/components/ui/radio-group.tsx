"use client";

import * as React from "react";
import {
  RadioGroup as HeroUIRadioGroup,
  Radio as HeroUIRadio,
  type RadioGroupProps as HeroUIRadioGroupProps,
  type RadioProps as HeroUIRadioProps,
} from "@heroui/react";
import { cn } from "@/lib/utils";

/**
 * shadcn `RadioGroup` adapter → HeroUI v3 `RadioGroup`.
 *
 * API mapping (HeroUI v3.2.2 verified, react-aria RadioGroup underneath):
 *
 * | shadcn prop            | HeroUI prop    | notes                              |
 * |------------------------|----------------|------------------------------------|
 * | `value`                | `value`        | identical                          |
 * | `defaultValue`         | `defaultValue` | identical                          |
 * | `onValueChange(v)`     | `onChange(v)`  | signature identical (string|null)  |
 * | `disabled`             | `isDisabled`   | React Aria convention              |
 * | `name`                 | `name`         | identical                          |
 * | `className`            | `className`    | passed through                     |
 *
 * shadcn's `<RadioGroupItem value="x" id="..." />` maps to HeroUI `<Radio>`.
 * The native `<input type="radio">` is rendered inside `Radio` automatically
 * and surfaces the `id` prop onto the focusable label wrapper, matching the
 * shadcn usage pattern (Label htmlFor → RadioGroupItem id).
 *
 * The HeroUI `Radio` already ships an indicator (selected dot), so the manual
 * lucide `<Circle />` icon from the old Radix version is no longer rendered.
 */
export interface RadioGroupProps
  extends Omit<
    HeroUIRadioGroupProps,
    "onChange" | "isDisabled" | "value" | "defaultValue"
  > {
  /** Controlled value (shadcn API). */
  value?: string;
  /** Initial uncontrolled value. */
  defaultValue?: string;
  /** Fired with the new string value (shadcn API). */
  onValueChange?: (value: string) => void;
  /** shadcn alias for HeroUI `isDisabled`. */
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    {
      className,
      value,
      defaultValue,
      onValueChange,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <HeroUIRadioGroup
        ref={ref}
        className={cn("grid gap-2", className)}
        value={value}
        defaultValue={defaultValue}
        isDisabled={disabled}
        onChange={(v) =>
          onValueChange?.(v === null ? "" : (v as string))
        }
        {...props}
      />
    );
  },
);
RadioGroup.displayName = "RadioGroup";

/**
 * shadcn `RadioGroupItem` adapter → HeroUI v3 `Radio`.
 *
 * HeroUI Radio (react-aria `RadioField` underneath) renders the wrapper + an
 * internal RadioButton (label/indicator). The `value` prop uniquely
 * identifies the option inside the parent RadioGroup. `className` styles the
 * outer RadioField wrapper.
 */
export interface RadioGroupItemProps
  extends Omit<HeroUIRadioProps, "value" | "isDisabled"> {
  /** Unique option value (shadcn API; required). */
  value: string;
  /** shadcn alias for HeroUI `isDisabled`. */
  disabled?: boolean;
}

const RadioGroupItem = React.forwardRef<HTMLDivElement, RadioGroupItemProps>(
  ({ className, disabled, ...props }, ref) => {
    return (
      <HeroUIRadio
        ref={ref}
        className={cn(
          "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        isDisabled={disabled}
        {...props}
      />
    );
  },
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
