"use client";

import * as React from "react";
import {
  Card as HeroUICard,
  type CardProps as HeroUICardProps,
} from "@heroui/react";
import { cn } from "@/lib/utils";

/**
 * shadcn-compatible Card surface, backed by HeroUI v3.
 *
 * HeroUI v3 ships a compound Card (`<Card><Card.Header><Card.Title>…`). To
 * preserve the shadcn flat API (`<Card><CardHeader><CardTitle>…`) — which all
 * existing pages use — we expose the same named exports and route them to the
 * matching HeroUI sub-components.
 *
 * Sub-component mapping (verified in
 * `@heroui/react/dist/components/card/card.d.ts`):
 *
 * | shadcn flat       | HeroUI compound   |
 * | ----------------- | ----------------- |
 * | `<Card>`          | `<Card>`          |
 * | `<CardHeader>`    | `<Card.Header>`   |
 * | `<CardTitle>`     | `<Card.Title>`    |
 * | `<CardDescription>` | `<Card.Description>` |
 * | `<CardContent>`   | `<Card.Content>`  |
 * | `<CardFooter>`    | `<Card.Footer>`   |
 *
 * Visual variant defaults to HeroUI's `default`; pass-through via `className`
 * still works on every sub-component (HeroUI merges it).
 */

type CardElement = "div";
type HeaderElement = "div";
type ContentElement = "div";
type FooterElement = "div";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <HeroUICard
      ref={ref}
      className={cn("bg-card text-card-foreground shadow-sm", className)}
      {...props}
    >
      {children as HeroUICardProps<CardElement>["children"]}
    </HeroUICard>
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <HeroUICard.Header
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  >
    {children}
  </HeroUICard.Header>
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <HeroUICard.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  >
    {children}
  </HeroUICard.Title>
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <HeroUICard.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  >
    {children}
  </HeroUICard.Description>
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <HeroUICard.Content
    ref={ref}
    className={cn("p-6 pt-0", className)}
    {...props}
  >
    {children}
  </HeroUICard.Content>
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <HeroUICard.Footer
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  >
    {children}
  </HeroUICard.Footer>
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
