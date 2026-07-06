"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/api/root";
import { httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";

/**
 * Browser-side tRPC client (T025).
 *
 * Usage in client components:
 *   "use client";
 *   import { trpc } from "@/lib/trpc/client";
 *   const me = trpc.auth.me.useQuery();
 *
 * Type inference flows from AppRouter (T024) — no manual contract files
 * (Constitution v2.0.0 Principle II + VI: no OpenAPI/Swagger/codegen).
 */
export const trpc = createTRPCReact<AppRouter>();

export function getTrpcClientConfig() {
  return {
    links: [
      loggerLink({
        enabled: (op) =>
          process.env.NODE_ENV === "development" ||
          (op.direction === "down" && op.result instanceof Error),
      }),
      httpBatchLink({
        // Relative URL works in browser context (same-origin).
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  };
}

export type { AppRouter };
