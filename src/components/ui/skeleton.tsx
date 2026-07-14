"use client";

import * as React from "react";
import {
  Skeleton as HeroUISkeleton,
  type SkeletonProps as HeroUISkeletonProps,
} from "@heroui/react";
import { cn } from "@/lib/utils";

/**
 * shadcn-compatible Skeleton, backed by HeroUI v3.
 *
 * HeroUI Skeleton signature (verified in
 * `@heroui/react/dist/components/skeleton/skeleton.d.ts`):
 * `<Skeleton className animationType />` where `animationType` is one of
 * `"none" | "pulse" | "shimmer"` (default `pulse`).
 *
 * The shadcn API (`<Skeleton className />`) is preserved verbatim — HeroUI's
 * default `pulse` animation matches shadcn's `animate-pulse`.
 */
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <HeroUISkeleton
      ref={ref}
      className={cn("rounded-md bg-muted", className)}
      {...props}
    />
  ),
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
