"use client";

import * as React from "react";
import {
  Select as HeroUISelect,
  ListBox as HeroUIListBox,
  ListBoxItem as HeroUIListBoxItem,
  type SelectProps as HeroUISelectProps,
  type ListBoxProps as HeroUIListBoxProps,
  type ListBoxItemProps as HeroUIListBoxItemProps,
} from "@heroui/react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * shadcn `Select` 5-subcomponent API adapter → HeroUI v3 `Select` +
 * `ListBox` combination.
 *
 * HeroUI v3.2.2 Select (verified in
 * `@heroui/react/dist/components/select/`):
 *   <Select
 *     selectedKey={Key|null}
 *     defaultSelectedKey={Key|null}
 *     onSelectionChange={(key: Key|null) => void}
 *     placeholder={string}
 *     isDisabled={boolean}
 *     name={string}
 *   >
 *     <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
 *     <Select.Popover>
 *       <ListBox>
 *         <ListBoxItem id={Key} textValue={string}>{label}</ListBoxItem>
 *       </ListBox>
 *     </Select.Popover>
 *   </Select>
 *
 * shadcn API → HeroUI prop mapping:
 *
 * | shadcn prop              | HeroUI prop           | notes                          |
 * |--------------------------|-----------------------|--------------------------------|
 * | `value`                  | `selectedKey`         | controlled selection           |
 * | `defaultValue`           | `defaultSelectedKey`  | uncontrolled initial selection |
 * | `onValueChange(string)`  | `onSelectionChange`   | bridged; string key passed     |
 * | `disabled`               | `isDisabled`          | React Aria convention          |
 * | `name`                   | `name`                | form field name                |
 * | `required`               | `isRequired`          | React Aria convention          |
 *
 * Implementation note: shadcn/Radix composes 5 children subcomponents.
 * This adapter preserves the 5-subcomponent public API so existing callers
 * stay unchanged; under the hood we forward each subcomponent to the closest
 * HeroUI equivalent. `SelectValue` and `SelectTrigger` cooperate via a small
 * React context so the `placeholder` declared inside `<SelectValue>` ends up
 * on the HeroUI `Select.Trigger`.
 */

// ─── internal: placeholder hand-off between SelectValue and SelectTrigger ───

interface SelectPlaceholderContextValue {
  placeholder: string | undefined;
  setPlaceholder: (p: string | undefined) => void;
}
const SelectPlaceholderContext = React.createContext<SelectPlaceholderContextValue>({
  placeholder: undefined,
  setPlaceholder: () => {},
});

// ─── internal: id hand-off so SelectTrigger can keep shadcn `id` working ───

interface SelectTriggerIdContextValue {
  triggerId: string | undefined;
  setTriggerId: (id: string | undefined) => void;
}
const SelectTriggerIdContext = React.createContext<SelectTriggerIdContextValue>({
  triggerId: undefined,
  setTriggerId: () => {},
});

// ─── Select (root) ──────────────────────────────────────────────────────

export interface SelectProps
  extends Omit<
    HeroUISelectProps<object, "single">,
    | "selectedKey"
    | "defaultSelectedKey"
    | "onSelectionChange"
    | "isDisabled"
    | "isRequired"
    | "children"
  > {
  /** shadcn controlled value. */
  value?: string;
  /** shadcn uncontrolled initial value. */
  defaultValue?: string;
  /** shadcn change handler — called with the new string value. */
  onValueChange?: (value: string) => void;
  /** shadcn alias for HeroUI `isDisabled`. */
  disabled?: boolean;
  /** shadcn alias for HeroUI `isRequired`. */
  required?: boolean;
  /** Children (composed subcomponents). */
  children?: React.ReactNode;
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      disabled,
      required,
      children,
      ...props
    },
    ref,
  ) => {
    const [placeholder, setPlaceholder] = React.useState<string | undefined>(
      undefined,
    );
    const [triggerId, setTriggerId] = React.useState<string | undefined>(
      undefined,
    );

    const handleSelectionChange = React.useCallback(
      (key: React.Key | null) => {
        // HeroUI react-aria fires `null` when nothing is selected. shadcn
        // callers expect an empty string in that case (see
        // transaction-filters.tsx ALL_SENTINEL pattern).
        onValueChange?.(key === null ? "" : String(key));
      },
      [onValueChange],
    );

    return (
      <SelectPlaceholderContext.Provider
        value={{ placeholder, setPlaceholder }}
      >
        <SelectTriggerIdContext.Provider
          value={{ triggerId, setTriggerId }}
        >
          <HeroUISelect
            ref={ref}
            selectedKey={value === undefined ? undefined : (value || null)}
            defaultSelectedKey={
              defaultValue === undefined ? undefined : (defaultValue || null)
            }
            onSelectionChange={handleSelectionChange}
            isDisabled={disabled}
            isRequired={required}
            placeholder={placeholder}
            {...props}
          >
            {children}
          </HeroUISelect>
        </SelectTriggerIdContext.Provider>
      </SelectPlaceholderContext.Provider>
    );
  },
);
Select.displayName = "Select";

// ─── SelectGroup (no-op semantic wrapper) ────────────────────────────────

const SelectGroup = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);
SelectGroup.displayName = "SelectGroup";

// ─── SelectValue (registers placeholder via context, renders HeroUI Value) ─

export interface SelectValueProps {
  /** Placeholder text shown when nothing is selected. */
  placeholder?: string;
  /** Optional extra children (ignored — shadcn placeholder-only usage). */
  children?: React.ReactNode;
  /** Passthrough className. */
  className?: string;
}

const SelectValue = ({ placeholder, className }: SelectValueProps) => {
  const { setPlaceholder } = React.useContext(SelectPlaceholderContext);
  React.useEffect(() => {
    setPlaceholder(placeholder);
  }, [placeholder, setPlaceholder]);
  return <HeroUISelect.Value className={className} />;
};
SelectValue.displayName = "SelectValue";

// ─── SelectTrigger (HeroUI Select.Trigger + Indicator) ───────────────────

export interface SelectTriggerProps
  extends Omit<
    React.ComponentProps<typeof HeroUISelect.Trigger>,
    "children"
  > {
  /** shadcn passthrough — accepted for API parity, currently a no-op. */
  asChild?: boolean;
  /** Trigger label content (typically <SelectValue />). */
  children?: React.ReactNode;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, id, ...props }, ref) => {
    const { setTriggerId } = React.useContext(SelectTriggerIdContext);
    React.useEffect(() => {
      setTriggerId(id);
    }, [id, setTriggerId]);
    return (
      <HeroUISelect.Trigger
        ref={ref}
        // 不再覆盖 HeroUI 原生 .select__trigger(bg-field / rounded-field /
        // shadow-field)。仅保留 value 容器的防溢出辅助类,以及透传调用方 className。
        className={cn(
          "w-full [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate",
          className,
        )}
        id={id}
        {...props}
      >
        {children}
        <HeroUISelect.Indicator />
      </HeroUISelect.Trigger>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

// ─── SelectContent (HeroUI Select.Popover + ListBox) ─────────────────────

export interface SelectContentProps
  extends Omit<HeroUIListBoxProps<object>, "children"> {
  /** shadcn prop — accepted but ignored (HeroUI uses default popper). */
  position?: "popper" | "item-aligned";
  /** Passthrough className for the popover surface. */
  className?: string;
  /** Children: expected to be <SelectItem> elements. */
  children?: React.ReactNode;
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, position: _position, ...props }, ref) => {
    return (
      // 不再覆盖 HeroUI 原生 .select__popover(bg-overlay / overflow-y-auto /
      // box-shadow: var(--shadow-overlay) / min-w: --trigger-width)。Popover 由
      // React Aria 自动 portal 到 document.body,无需手写 z-50 / overflow-hidden。
      <HeroUISelect.Popover offset={4} className={className}>
        <HeroUIListBox
          ref={ref as React.Ref<HTMLDivElement>}
          {...props}
        >
          {children}
        </HeroUIListBox>
      </HeroUISelect.Popover>
    );
  },
);
SelectContent.displayName = "SelectContent";

// ─── SelectLabel (visual separator text) ──────────────────────────────────

export interface SelectLabelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const SelectLabel = React.forwardRef<HTMLDivElement, SelectLabelProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
      {...props}
    />
  ),
);
SelectLabel.displayName = "SelectLabel";

// ─── SelectItem (HeroUI ListBoxItem) ──────────────────────────────────────

export interface SelectItemProps
  extends Omit<HeroUIListBoxItemProps, "id" | "textValue"> {
  /** Unique option value (shadcn API; mapped to HeroUI `id`). */
  value: string;
  /** Optional display text used for type-ahead (defaults to children). */
  textValue?: string;
  /** Rendered label / content. */
  children?: React.ReactNode;
  /** shadcn alias for HeroUI `isDisabled`. */
  disabled?: boolean;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, value, textValue, disabled, children, ...props }, ref) => {
    return (
      // 不再覆盖 HeroUI 原生 list-box-item 样式,也不手写 absolute <Check>——
      // 原生 <ListBox.ItemIndicator> 已处理选中勾选(且在 trigger 中自动隐藏)。
      <HeroUIListBoxItem
        ref={ref}
        id={value}
        textValue={textValue}
        isDisabled={disabled}
        className={className}
        {...props}
      >
        {children}
        <HeroUIListBoxItem.Indicator />
      </HeroUIListBoxItem>
    );
  },
);
SelectItem.displayName = "SelectItem";

// ─── SelectSeparator (visual rule) ───────────────────────────────────────

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = "SelectSeparator";

// ─── SelectScrollUpButton / SelectScrollDownButton (no-op) ───────────────
// HeroUI ListBox handles virtual scrolling internally; these are kept as
// no-ops so any future shadcn consumer compiles without changes.

const SelectScrollUpButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    aria-hidden
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </div>
));
SelectScrollUpButton.displayName = "SelectScrollUpButton";

const SelectScrollDownButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    aria-hidden
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </div>
));
SelectScrollDownButton.displayName = "SelectScrollDownButton";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
