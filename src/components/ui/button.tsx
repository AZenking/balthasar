"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Button as HeroUIButton,
  type ButtonProps as HeroUIButtonProps,
} from "@heroui/react";
import { cn } from "@/lib/utils";

/**
 * shadcn-style buttonVariants — retained verbatim for backward compatibility.
 *
 * Consumers (e.g. `alert-dialog.tsx`) call `buttonVariants()` /
 * `buttonVariants({ variant: "outline" })` to obtain shadcn Tailwind class
 * strings. The {@link Button} component delegates rendering to HeroUI v3
 * under the hood, but this function still returns shadcn classes so other
 * shadcn primitives that compose `buttonVariants` directly keep working.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ShadcnVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type ShadcnSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

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
 * - `asChild`  : accepted for API parity (currently a no-op).
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
    >,
    VariantProps<typeof buttonVariants> {
  /** shadcn passthrough — accepted for API parity, currently a no-op. */
  asChild?: boolean;
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
      asChild = false,
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
        className={cn(buttonVariants({ variant, size, className }))}
        variant={heroVariantMap[variant ?? "default"]}
        size={heroSizeMap[size ?? "default"]}
        isIconOnly={size === "icon" ? true : undefined}
        isDisabled={disabled}
        onPress={
          onClick
            ? (onClick as unknown as HeroUIButtonProps["onPress"])
            : undefined
        }
        data-aschild={asChild ? "true" : undefined}
        {...rest}
      >
        {children}
      </HeroUIButton>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
