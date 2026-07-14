"use client";

/**
 * Popover — shadcn API on top of HeroUI v3 <Popover>.
 *
 * 026 Phase 3 US1: shadcn → HeroUI v3 adapter. External API unchanged
 * (Radix-style compound: `<Popover open onOpenChange>` with `PopoverTrigger`
 * / `PopoverContent` / `PopoverAnchor`). Internally renders HeroUI's
 * `<Popover>` compound (`.Root .Trigger .Content`).
 *
 * API translation:
 *   shadcn `open`         → HeroUI `isOpen`
 *   shadcn `onOpenChange` → HeroUI `onOpenChange`
 *
 * `PopoverContent` accepts shadcn's `align` / `sideOffset` props. HeroUI's
 * Popover uses react-aria positioning (`placement` + `offset`); we forward
 * `sideOffset` as `offset` and `side` as `placement`. `align` is accepted
 * for API compatibility (center/start/end has no exact equivalent in
 * react-aria's placement union at this level).
 *
 * `PopoverAnchor` is a pass-through: HeroUI uses the trigger as anchor by
 * default, which matches the dominant shadcn usage.
 */

import * as React from "react";
import { Popover } from "@heroui/react";

import { cn } from "@/lib/utils";

type PopoverProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  children?: React.ReactNode;
};

/** Root: shadcn `open` → HeroUI `isOpen`. */
const PopoverRoot = ({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: PopoverProps) => (
  <Popover.Root
    isOpen={open}
    defaultOpen={defaultOpen}
    onOpenChange={onOpenChange}
  >
    {children}
  </Popover.Root>
);

const PopoverTrigger = ({
  children,
  asChild: _asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) => <Popover.Trigger>{children as React.ReactElement}</Popover.Trigger>;

/**
 * PopoverAnchor: shadcn exposes this for advanced positioning. HeroUI's
 * Popover positions off the trigger; we accept the API but render the child
 * unchanged so consumers compile.
 */
const PopoverAnchor = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);

const PopoverContent = ({
  className,
  children,
  align: _align = "center",
  sideOffset = 4,
  side,
  // shadcn escape hatches — react-aria handles internally.
  onEscapeKeyDown: _onEscapeKeyDown,
  onPointerDownOutside: _onPointerDownOutside,
  onInteractOutside: _onInteractOutside,
}: {
  className?: string;
  children?: React.ReactNode;
  align?: "center" | "start" | "end";
  sideOffset?: number;
  side?: "top" | "bottom" | "left" | "right";
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
  onPointerDownOutside?: (e: Event) => void;
  onInteractOutside?: (e: Event) => void;
}) => (
  <Popover.Content
    // shadcn default sideOffset=4 → react-aria cross-axis offset 4.
    offset={sideOffset}
    placement={side}
    className={cn(
      "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
      className,
    )}
  >
    {children}
  </Popover.Content>
);
PopoverContent.displayName = "PopoverContent";

export {
  PopoverRoot as Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
};
