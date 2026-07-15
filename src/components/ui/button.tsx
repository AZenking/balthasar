"use client";

import * as React from "react";
import {
  Button as HeroUIButton,
  type ButtonProps as HeroUIButtonProps,
} from "@heroui/react";
import { cn } from "@/lib/utils";

/**
 * shadcn-compatible ButtonVariants — static class map (no cva dependency).
 *
 * Phase 10 cleanup: removed `class-variance-authority` per spec FR-A002.
 * Consumers (e.g. `alert-dialog.tsx`) call `buttonVariants()` /
 * `buttonVariants({ variant: "outline" })` to obtain shadcn Tailwind class
 * strings for raw `<button>` elements. The {@link Button} component delegates
 * rendering to HeroUI v3 under the hood, but this function still returns
 * shadcn classes so other primitives that compose `buttonVariants` directly
 * keep working.
 */
type ShadcnVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link";
type ShadcnSize = "default" | "sm" | "lg" | "icon";

const BASE_CLASSES =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const VARIANT_CLASSES: Record<ShadcnVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",
  outline:
    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};

const SIZE_CLASSES: Record<ShadcnSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
};

interface ButtonVariantsProps {
  variant?: ShadcnVariant;
  size?: ShadcnSize;
  className?: string;
}

function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: ButtonVariantsProps = {}): string {
  return cn(
    BASE_CLASSES,
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
}

/**
 * shadcn -> HeroUI v3 variant mapping.
 *
 * HeroUI variants (verified in
 * `@heroui/styles/dist/components/button/button.styles.d.ts`):
 * `primary | secondary | danger | danger-soft | ghost | outline | tertiary`.
 */
const heroVariantMap: Record<ShadcnVariant, HeroUIButtonProps["variant"]> = {
  default: "primary",
  secondary: "secondary",
  destructive: "danger",
  outline: "outline",
  ghost: "ghost",
  link: "tertiary",
};

/**
 * shadcn -> HeroUI size mapping.
 *
 * HeroUI sizes: `sm | md | lg`. The shadcn `icon` size becomes a square
 * `isIconOnly` button at `sm` size.
 */
const heroSizeMap: Record<ShadcnSize, HeroUIButtonProps["size"]> = {
  default: "md",
  sm: "sm",
  lg: "lg",
  icon: "sm",
};

/**
 * shadcn-compatible Button props.
 *
 * Built on top of HeroUI v3's `ButtonProps` (so DOM/event typing is fully
 * compatible with react-aria) and extended with the shadcn-style knobs:
 * - `variant`  : shadcn variant set (`default | secondary | destructive |
 *                outline | ghost | link`) — mapped to HeroUI internally.
 * - `size`     : shadcn size set (`default | sm | lg | icon`) — mapped to
 *                HeroUI; `icon` enables `isIconOnly`.
 * - `onClick`  : shadcn click handler — bridged onto HeroUI's `onPress`.
 *
 * NOTE: shadcn 的 `asChild` 在此适配器上**不支持**(HeroUI Button 无法把
 * 渲染委托给单一子元素)。需要"按钮样式的链接"等场景请用原生 `<Link>`/
 * `<a>` + `buttonVariants(...)`(见 categories/page.tsx)。
 *
 * The HeroUI props `variant`, `size`, `onPress`, `onClick`, `children` are
 * shadowed/re-defined here so the shadcn API surface stays clean.
 *
 * Callers can also pass any native prop HeroUI/react-aria understands
 * (`type`, `aria-*`, `form*`, `name`, `value`, etc.).
 */
export interface ButtonProps
  extends Omit<
      HeroUIButtonProps,
      | "variant"
      | "size"
      | "onPress"
      | "onClick"
      | "isDisabled"
      | "isIconOnly"
      | "children"
    > {
  /** shadcn variant set, mapped to HeroUI internally. */
  variant?: ShadcnVariant;
  /** shadcn size set, mapped to HeroUI internally. `icon` enables `isIconOnly`. */
  size?: ShadcnSize;
  /** Mirrors the native `disabled` attribute (alias for HeroUI `isDisabled`). */
  disabled?: boolean;
  /** shadcn click handler — bridged onto HeroUI's `onPress`. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Allow function-form children from HeroUI's render-prop API. */
  children?: HeroUIButtonProps["children"];
  /** Native HTML `title` (tooltip) — not modelled by react-aria. */
  title?: string;
  /** Tab index override. */
  tabIndex?: number;
  /** Inline style passthrough. */
  style?: React.CSSProperties;
  /** Test-id passthrough. */
  "data-testid"?: string;
}

/**
 * Adapter component: shadcn Button API, HeroUI v3 implementation.
 *
 * Prop translation:
 * - `disabled`  -> HeroUI `isDisabled`
 * - `onClick`   -> HeroUI `onPress` (event signature differs; cast — all
 *                  current callers ignore the event arg)
 * - `variant`   -> mapped via {@link heroVariantMap}
 * - `size`      -> mapped via {@link heroSizeMap}; `icon` also sets `isIconOnly`
 *
 * All other DOM props (`className`, `type`, `aria-*`, `form*`, `name`, etc.)
 * flow through untouched.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      disabled,
      onClick,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <HeroUIButton
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        variant={heroVariantMap[variant ?? "default"]}
        size={heroSizeMap[size ?? "default"]}
        isIconOnly={size === "icon" ? true : undefined}
        isDisabled={disabled}
        onPress={
          onClick
            ? (onClick as unknown as HeroUIButtonProps["onPress"])
            : undefined
        }
        {...rest}
      >
        {children}
      </HeroUIButton>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
