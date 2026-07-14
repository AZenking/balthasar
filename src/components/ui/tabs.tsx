"use client";

/**
 * Tabs — shadcn-compatible adapter over HeroUI v3 Tabs.
 *
 * shadcn surface (preserved for callers):
 *   <Tabs value onValueChange defaultValue>           // controlled or uncontrolled
 *     <TabsList>
 *       <TabsTrigger value="x">…</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="x">…</TabsContent>
 *   </Tabs>
 *
 * HeroUI v3 / react-aria surface we map to:
 *   <Tabs selectedKey onSelectionChange defaultSelectedKey>
 *     <TabsList>
 *       <Tab id="x">…</Tab>
 *     </TabsList>
 *     <TabPanel id="x">…</TabPanel>
 *   </Tabs>
 *
 * Notes:
 *  - shadcn values are always strings (radix tabs API). react-aria uses `Key` (string|number).
 *    We type the public shadcn surface as string for drop-in compatibility; we coerce Key -> string
 *    at the onSelectionChange boundary so callers don't have to.
 *  - `forwardRef` retained on every sub-component for drop-in compatibility.
 */

import * as React from "react";
import { Tabs as HeroUITabs } from "@heroui/react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// <Tabs> — root container. Maps shadcn value/onValueChange -> selectedKey/onSelectionChange.
// ---------------------------------------------------------------------------

export interface TabsProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof HeroUITabs>,
    "selectedKey" | "defaultSelectedKey" | "onSelectionChange" | "children"
  > {
  /** Currently active tab (controlled). shadcn name for react-aria's selectedKey. */
  value?: string;
  /** Initial active tab (uncontrolled). shadcn name for react-aria's defaultSelectedKey. */
  defaultValue?: string;
  /** Called when the active tab changes. shadcn name for onSelectionChange. */
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    { value, defaultValue, onValueChange, className, children, ...props },
    ref,
  ) => {
    // Bridge react-aria `Key` (string | number) back to shadcn's `string`.
    // In practice ids are always strings; we coerce defensively so callers don't have to.
    const handleSelectionChange = React.useCallback(
      (key: React.Key | null) => {
        if (onValueChange && key != null) {
          onValueChange(String(key));
        }
      },
      [onValueChange],
    );
    return (
      <HeroUITabs
        ref={ref}
        // react-aria supports both controlled (selectedKey) and uncontrolled (defaultSelectedKey).
        // We pass whichever shadcn prop the caller used; undefined is fine.
        selectedKey={value}
        defaultSelectedKey={defaultValue}
        onSelectionChange={handleSelectionChange}
        className={className}
        {...props}
      >
        {children}
      </HeroUITabs>
    );
  },
);
Tabs.displayName = "Tabs";

// ---------------------------------------------------------------------------
// <TabsList> — wraps the tab triggers.
// ---------------------------------------------------------------------------

export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof HeroUITabs.List>
>(({ className, ...props }, ref) => (
  <HeroUITabs.List ref={ref} className={cn(className)} {...props} />
));
TabsList.displayName = "TabsList";

// ---------------------------------------------------------------------------
// <TabsTrigger> — single tab. shadcn uses value; HeroUI/react-aria uses id.
// ---------------------------------------------------------------------------

export interface TabsTriggerProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof HeroUITabs.Tab>,
    "id" | "isSelected" | "isDisabled"
  > {
  /** Tab identity. shadcn name; passed as HeroUI's `id`. */
  value?: string;
  /** shadcn uses `disabled`; HeroUI uses `isDisabled`. Bridge both. */
  disabled?: boolean;
}

export const TabsTrigger = React.forwardRef<HTMLDivElement, TabsTriggerProps>(
  ({ value, disabled, className, ...props }, ref) => (
    <HeroUITabs.Tab
      ref={ref}
      id={value}
      isDisabled={disabled}
      className={cn(className)}
      {...props}
    />
  ),
);
TabsTrigger.displayName = "TabsTrigger";

// ---------------------------------------------------------------------------
// <TabsContent> — panel for a tab. shadcn uses value; HeroUI/react-aria uses id.
// ---------------------------------------------------------------------------

export interface TabsContentProps
  extends React.ComponentPropsWithoutRef<typeof HeroUITabs.Panel> {
  /** Panel identity. shadcn name; passed as HeroUI's `id`. */
  value?: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, ...props }, ref) => (
    <HeroUITabs.Panel
      ref={ref}
      id={value}
      className={cn(className)}
      {...props}
    />
  ),
);
TabsContent.displayName = "TabsContent";

export { Tabs as TabsRoot, TabsList as TabList, TabsTrigger as Tab, TabsContent as TabPanel };
