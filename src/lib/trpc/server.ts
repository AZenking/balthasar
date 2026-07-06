import "server-only";
import { createCallerFactory } from "@trpc/server";
import { appRouter, type AppRouter } from "@/server/api/root";
import { createContext, type CreateContext } from "@/server/api/trpc";

/**
 * Server-side tRPC caller factory (T026).
 *
 * Usage in RSC to call procedures directly (no HTTP round-trip):
 *
 *   // src/app/dashboard/page.tsx (RSC)
 *   const caller = await createCaller();
 *   const data = await caller.auth.me();
 *
 * Type inference flows from AppRouter (T024) — end-to-end type safety,
 * no manual contracts (Constitution v2.0.0 Principle VI YAGNI).
 */
const createCallerInner = createCallerFactory<AppRouter>();

/**
 * Build a caller with the given (or default) context.
 */
export async function createCaller(ctxOverride?: Partial<CreateContext>) {
  const baseCtx = await createContext();
  const ctx: CreateContext = { ...baseCtx, ...ctxOverride };
  return createCallerInner(appRouter)(ctx);
}

export type { AppRouter };
