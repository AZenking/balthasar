"use client";

/**
 * Dialog — shadcn API on top of HeroUI v3 <Modal>.
 *
 * 026 Phase 3 US1: shadcn → HeroUI v3 adapter. External API is unchanged
 * (Radix-style compound: `<Dialog open onOpenChange>` with `DialogTrigger` /
 * `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogDescription` /
 * `DialogFooter` / `DialogClose`). Internally renders HeroUI's `<Modal>`
 * compound so Esc / outside-click / focus-trap come from react-aria instead
 * of Radix.
 *
 * API translation:
 *   shadcn `open`         → HeroUI `isOpen` (react-aria OverlayTriggerProps)
 *   shadcn `onOpenChange` → HeroUI `onOpenChange` (same signature)
 *
 * `DialogTrigger`/`DialogClose` honor shadcn's `asChild` (rendered via
 * `Modal.Trigger`/`Modal.CloseTrigger`, which clone their child element).
 */

import * as React from "react";
import { Modal } from "@heroui/react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type DialogProps = {
  /** Controlled open state (shadcn `open`). Maps to HeroUI `isOpen`. */
  open?: boolean;
  /** Uncontrolled default open (shadcn `defaultOpen`). */
  defaultOpen?: boolean;
  /** Called when the open state changes (shadcn `onOpenChange`). */
  onOpenChange?: (open: boolean) => void;
  /** shadcn accepts `modal` to control inert behavior; react-aria is always modal. */
  modal?: boolean;
  children?: React.ReactNode;
};

/** Root: shadcn `open` → HeroUI `isOpen`. */
const Dialog = ({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: DialogProps) => (
  <Modal.Root
    isOpen={open}
    defaultOpen={defaultOpen}
    onOpenChange={onOpenChange}
  >
    {children}
  </Modal.Root>
);

/** Trigger: render the child as the toggle. Honors shadcn `asChild`. */
const DialogTrigger = ({
  children,
  asChild: _asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) => <Modal.Trigger>{children as React.ReactElement}</Modal.Trigger>;

/** Portal/Overlay exist on shadcn; under HeroUI they're internal. */
const DialogPortal = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);
const DialogOverlay = (_props: unknown) => null;

/** Content: the visible dialog panel. */
const DialogContent = ({
  className,
  children,
  // shadcn/Radix props that react-aria handles via isDismissable on backdrop.
  onEscapeKeyDown: _onEscapeKeyDown,
  onPointerDownOutside: _onPointerDownOutside,
  onInteractOutside: _onInteractOutside,
}: {
  className?: string;
  children?: React.ReactNode;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
  onPointerDownOutside?: (e: Event) => void;
  onInteractOutside?: (e: Event) => void;
}) => (
  <Modal.Backdrop isDismissable>
    <Modal.Container className="fixed inset-0 z-50 grid place-items-center">
      <Modal.Dialog
        className={cn(
          "relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
          className,
        )}
      >
        {children}
        <Modal.CloseTrigger
          aria-label="Close"
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Modal.CloseTrigger>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>
);
DialogContent.displayName = "DialogContent";

/** Close: explicit close affordance (shadcn DialogClose). */
const DialogClose = ({
  children,
  asChild: _asChild,
}: {
  children?: React.ReactNode;
  asChild?: boolean;
}) => <Modal.CloseTrigger>{children as React.ReactElement}</Modal.CloseTrigger>;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = ({
  className,
  children,
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Modal.Heading
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
  >
    {children}
  </Modal.Heading>
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
