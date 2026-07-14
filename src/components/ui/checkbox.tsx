"use client";

import * as React from "react";
import {
  Checkbox as HeroUICheckbox,
  type CheckboxProps as HeroUICheckboxProps,
} from "@heroui/react";
import { cn } from "@/lib/utils";

/**
 * shadcn `Checkbox` adapter → HeroUI v3 `Checkbox`.
 *
 * API mapping (HeroUI v3.2.2 verified, react-aria CheckboxField underneath):
 *
 * | shadcn prop              | HeroUI prop        | notes                              |
 * |--------------------------|--------------------|------------------------------------|
 * | `checked` / `"indeterminate"` | `isSelected` / `isIndeterminate` | boolean + dedicated flag |
 * | `onCheckedChange(checked)`   | `onChange(bool)`                 | signature differs; bridged |
 * | `disabled`               | `isDisabled`       | React Aria convention              |
 * | `defaultChecked`         | `defaultSelected`  | React Aria uncontrolled API        |
 * | `name` / `value`         | `name` / `value`   | identical                          |
 * | `id`                     | `id`               | identical                          |
 * | `className`              | `className`        | passed through                     |
 *
 * shadcn/Radix's `onCheckedChange` accepts a `boolean | "indeterminate"`
 * value; HeroUI's `onChange(boolean)` is fired only on actual boolean toggle,
 * so callers who set `isIndeterminate` programmatically can do so via the
 * `checked="indeterminate"` prop. The `onChange` bridge here converts
 * HeroUI's boolean into the shadcn union so existing callers don't change.
 *
 * HeroUI ships its own default checkmark / minus indicator (verified in
 * `@heroui/react/dist/components/checkbox/checkbox.js`), so the old lucide
 * icons are no longer rendered.
 */
export interface CheckboxProps
  extends Omit<
    HeroUICheckboxProps,
    | "isSelected"
    | "isIndeterminate"
    | "onChange"
    | "defaultSelected"
    | "isDisabled"
  > {
  /** shadcn / Radix compatible checked state. */
  checked?: boolean | "indeterminate";
  /** Initial uncontrolled state. */
  defaultChecked?: boolean;
  /** shadcn / Radix compatible change handler. */
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
  /** shadcn alias for HeroUI `isDisabled`. */
  disabled?: boolean;
}

const Checkbox = React.forwardRef<HTMLDivElement, CheckboxProps>(
  (
    {
      className,
      checked,
      defaultChecked,
      onCheckedChange,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <HeroUICheckbox
        ref={ref}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground",
          className,
        )}
        isSelected={
          checked === undefined ? undefined : checked === "indeterminate" ? false : checked
        }
        isIndeterminate={checked === "indeterminate"}
        defaultSelected={
          defaultChecked === undefined ? undefined : defaultChecked
        }
        isDisabled={disabled}
        onChange={(isSelected) => onCheckedChange?.(isSelected)}
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
