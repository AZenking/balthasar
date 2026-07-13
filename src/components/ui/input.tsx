"use client";

import * as React from "react";
import { Input as HeroUIInput } from "@heroui/react";
import { cn } from "@/lib/utils";

/**
 * `Input` — shadcn 兼容 wrapper,内部基于 HeroUI v3 Input
 * (react-aria-components/Input)。026-cream-amber-revamp Phase 3 US1。
 *
 * shadcn `<Input />` 的所有原生 props(placeholder / value / onChange / type / ref)
 * 直接透传,className 在 HeroUI 默认样式之上 override。
 */
const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <HeroUIInput
    ref={ref}
    type={type}
    className={cn(className)}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
