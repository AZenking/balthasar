"use client";

/**
 * Tooltip — shadcn-compatible adapter over HeroUI v3 Tooltip.
 *
 * shadcn surface (preserved for callers):
 *   <TooltipProvider>                                    // no-op (HeroUI manages state internally)
 *     <Tooltip delayDuration={300} defaultOpen={false}>
 *       <TooltipTrigger asChild>…</TooltipTrigger>      // asChild merges into child
 *       <TooltipContent side="top" sideOffset={4}>…</TooltipContent>
 *     </Tooltip>
 *   </TooltipProvider>
 *
 * HeroUI v3 / react-aria surface we map to:
 *   <Tooltip delay={300} closeDelay={…} placement="top"> // root is TooltipTrigger in react-aria
 *     <TooltipTrigger>…</TooltipTrigger>
 *     <TooltipContent offset={4}>…</TooltipContent>
 *   </Tooltip>
 *
 * Notes:
 *  - shadcn `<Tooltip>` is the trigger container; HeroUI/react-aria models the trigger on `<Tooltip>` itself.
 *    We bridge by making our shadcn `<Tooltip>` wrap children in HeroUI's `<Tooltip.Root>` (a TooltipTrigger)
 *    so the shadcn tree shape (trigger sibling + content sibling) works unchanged.
 *  - shadcn `side` ("top"|"bottom"|"left"|"right") maps 1:1 to react-aria `placement` (same string values).
 *  - shadcn `delayDuration` (ms) maps to react-aria `delay` (ms). default 700 in shadcn, 1000 in react-aria.
 *  - shadcn `sideOffset` (px) maps to react-aria `offset` (HeroUI Content prop).
 *  - `<TooltipProvider>` is a no-op stub for shadcn call-site compatibility (react-aria has no provider concept).
 */

import * as React from "react";
import { Tooltip as HeroUITooltip } from "@heroui/react";

import { cn } from "@/lib/utils";

// react-aria Placement literal union. Imported type-only so the assert below is type-safe.
type Placement = NonNullable<
  React.ComponentPropsWithoutRef<typeof HeroUITooltip.Content>["placement"]
>;

// ---------------------------------------------------------------------------
// <TooltipProvider> — no-op in react-aria. Kept for shadcn call-site compatibility.
// ---------------------------------------------------------------------------

export interface TooltipProviderProps {
  children: React.ReactNode;
  /** shadcn `delayDuration` (provider-level); ignored. Kept for API parity. */
  delayDuration?: number;
  /** shadcn `skipDelayDuration`; ignored. */
  skipDelayDuration?: number;
  /** shadcn provider `disableHoverableContent`; ignored. */
  disableHoverableContent?: boolean;
}

export const TooltipProvider = ({
  children,
}: TooltipProviderProps): React.ReactElement => {
  // react-aria manages tooltip state via its internal overlay system — no provider needed.
  // We render children untouched so existing shadcn trees keep working.
  return <>{children}</> as React.ReactElement;
};

// ---------------------------------------------------------------------------
// <Tooltip> — shadcn "Root". Wraps children in HeroUI's Tooltip.Root (TooltipTrigger).
// ---------------------------------------------------------------------------

export interface TooltipProps {
  children: React.ReactNode;
  /** Open state (controlled). shadcn name for react-aria `isOpen`. */
  open?: boolean;
  /** Initial open state (uncontrolled). shadcn name for react-aria `defaultOpen`. */
  defaultOpen?: boolean;
  /** Open change handler. shadcn name for react-aria `onOpenChange`. */
  onOpenChange?: (open: boolean) => void;
  /** Delay (ms) before the tooltip shows. shadcn name; default 700 in shadcn, we mirror. */
  delayDuration?: number;
}

export const Tooltip = ({
  children,
  open,
  defaultOpen,
  onOpenChange,
  delayDuration,
}: TooltipProps): React.ReactElement => {
  return (
    <HeroUITooltip.Root
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      delay={delayDuration}
    >
      {children}
    </HeroUITooltip.Root>
  );
};
Tooltip.displayName = "Tooltip";

// ---------------------------------------------------------------------------
// <TooltipTrigger> — the hover/focus target.
// shadcn `asChild` is accepted for API parity; react-aria merges props onto a child element
// automatically, so it's a no-op here.
// ---------------------------------------------------------------------------

export interface TooltipTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export const TooltipTrigger = React.forwardRef<
  HTMLDivElement,
  TooltipTriggerProps
>(({ children, asChild: _asChild, ...props }, ref) => (
  <HeroUITooltip.Trigger ref={ref} {...props}>
    {children}
  </HeroUITooltip.Trigger>
));
TooltipTrigger.displayName = "TooltipTrigger";

// ---------------------------------------------------------------------------
// <TooltipContent> — the floating content. Maps shadcn `side`/`sideOffset` -> react-aria placement/offset.
// ---------------------------------------------------------------------------

export interface TooltipContentProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof HeroUITooltip.Content>,
    "placement" | "offset"
  > {
  /** shadcn `side` ("top"|"right"|"bottom"|"left"); maps 1:1 to react-aria `placement`. */
  side?: "top" | "right" | "bottom" | "left";
  /** shadcn `sideOffset` (px); maps to react-aria `offset`. Default 4 (shadcn default). */
  sideOffset?: number;
  /** shadcn `align` ("start"|"center"|"end"); react-aria uses `placement` like "top start".
   *  When supplied, we suffix it onto `placement`. */
  align?: "start" | "center" | "end";
}

export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  TooltipContentProps
>(({ className, side = "top", sideOffset = 4, align, ...props }, ref) => {
  // Compose placement from side + align (e.g. "top start"). Template strings widen to `string`,
  // but react-aria expects the `Placement` literal union — assert at the boundary after construction.
  const placement = (align ? `${side} ${align}` : side) as Placement;
  return (
    <HeroUITooltip.Content
      ref={ref}
      placement={placement}
      offset={sideOffset}
      className={cn(className)}
      {...props}
    />
  );
});
TooltipContent.displayName = "TooltipContent";

export { Tooltip as TooltipRoot, TooltipTrigger as Trigger, TooltipContent as Content };
