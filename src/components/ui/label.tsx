"use client";

import * as React from "react";
import { Label as HeroUILabel } from "@heroui/react";
import { cn } from "@/lib/utils";

/**
 * `Label` — shadcn 兼容 wrapper,内部基于 HeroUI v3 Label
 * (react-aria-components/Label)。026-cream-amber-revamp Phase 3 US1。
 */
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <HeroUILabel ref={ref} className={cn(className)} {...props} />
));
Label.displayName = "Label";

export { Label };
