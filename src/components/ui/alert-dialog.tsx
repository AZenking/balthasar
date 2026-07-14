"use client";

/**
 * AlertDialog — shadcn API on top of HeroUI v3 <AlertDialog>.
 *
 * 026 Phase 3 US1: shadcn → HeroUI v3 adapter. External API unchanged
 * (Radix-style compound: `AlertDialog` / `AlertDialogTrigger` /
 * `AlertDialogContent` / `AlertDialogHeader` / `AlertDialogTitle` /
 * `AlertDialogDescription` / `AlertDialogFooter` / `AlertDialogAction` /
 * `AlertDialogCancel`).
 *
 * HeroUI v3 ships an independent `<AlertDialog>` component (not a Modal
 * variant). It defaults to `isDismissable=false` and
 * `isKeyboardDismissDisabled=true`, matching shadcn's AlertDialog semantics
 * (Esc / outside-click do NOT dismiss — only Action/Cancel buttons do).
 *
 * API translation:
 *   shadcn `open`         → HeroUI `isOpen`
 *   shadcn `onOpenChange` → HeroUI `onOpenChange`
 *   `AlertDialogAction`   → styled button that runs onClick, then closes
 *   `AlertDialogCancel`   → outline-styled button that runs onClick, then closes
 *
 * To let Action/Cancel close the dialog without depending on
 * `react-aria-components` directly (not a user-facing dependency), the Root
 * owns a `close()` via a private React Context.
 */

import * as React from "react";
import { AlertDialog } from "@heroui/react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Internal context: closes the alert dialog from any descendant. */
const AlertDialogCloseContext = React.createContext<(() => void) | null>(null);

type AlertDialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  children?: React.ReactNode;
};

/** Root: shadcn `open` → HeroUI `isOpen`; expose `close` to descendants. */
const AlertDialogRoot = ({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: AlertDialogProps) => {
  const close = React.useCallback(
    () => onOpenChange?.(false),
    [onOpenChange],
  );
  return (
    <AlertDialogCloseContext.Provider value={close}>
      <AlertDialog.Root
        isOpen={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
      >
        {children}
      </AlertDialog.Root>
    </AlertDialogCloseContext.Provider>
  );
};

const AlertDialogTrigger = ({
  children,
  asChild: _asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) => (
  <AlertDialog.Trigger>
    {children as React.ReactElement}
  </AlertDialog.Trigger>
);

/** Portal/Overlay are shadcn-only; under HeroUI they're internal. */
const AlertDialogPortal = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);
const AlertDialogOverlay = (_props: unknown) => null;

/** Content: visible alert panel. */
const AlertDialogContent = ({
  className,
  children,
  // shadcn/Radix escape-hatch handlers — react-aria handles both internally.
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
  <AlertDialog.Backdrop
    // AlertDialog semantics: do NOT dismiss on outside click / Esc.
    isDismissable={false}
    isKeyboardDismissDisabled
  >
    <AlertDialog.Container className="fixed inset-0 z-50 grid place-items-center">
      <AlertDialog.Dialog
        className={cn(
          "relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
          className,
        )}
      >
        {children}
      </AlertDialog.Dialog>
    </AlertDialog.Container>
  </AlertDialog.Backdrop>
);
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({
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
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = ({
  className,
  children,
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <AlertDialog.Heading className={cn("text-lg font-semibold", className)}>
    {children}
  </AlertDialog.Heading>
);
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);
AlertDialogDescription.displayName = "AlertDialogDescription";

/**
 * Action / Cancel: in Radix these are special triggers that close the dialog
 * AND fire onClick. With HeroUI we render a regular button styled via
 * `buttonVariants` that:
 *   1. calls the consumer's onClick (if any),
 *   2. closes the dialog via our internal context.
 *
 * `asChild` is honored by cloning children, matching shadcn usage like
 * `<AlertDialogAction asChild><Button>...</Button></AlertDialogAction>`.
 */
const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, onClick, children, asChild, type, ...props }, ref) => {
  const close = React.useContext(AlertDialogCloseContext);
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) close?.();
  };
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
      className?: string;
      ref?: React.Ref<HTMLButtonElement>;
    }>;
    return React.cloneElement(child, {
      ...props,
      ref,
      className: cn(buttonVariants(), className, child.props.className),
      onClick: handleClick,
    });
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(buttonVariants(), className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
});
AlertDialogAction.displayName = "AlertDialogAction";

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, onClick, children, asChild, type, ...props }, ref) => {
  const close = React.useContext(AlertDialogCloseContext);
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) close?.();
  };
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
      className?: string;
      ref?: React.Ref<HTMLButtonElement>;
    }>;
    return React.cloneElement(child, {
      ...props,
      ref,
      className: cn(
        buttonVariants({ variant: "outline" }),
        "mt-2 sm:mt-0",
        className,
        child.props.className,
      ),
      onClick: handleClick,
    });
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "mt-2 sm:mt-0",
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
});
AlertDialogCancel.displayName = "AlertDialogCancel";

export {
  AlertDialogRoot as AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
