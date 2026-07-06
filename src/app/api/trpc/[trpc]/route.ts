import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createContext } from "@/server/api/trpc";
import { env } from "@/lib/env";

/**
 * tRPC HTTP endpoint mount (T027).
 *
 * Mounted at /api/trpc/[trpc] — every procedure call from client components
 * flows through here.
 *
 * In dev, logs errors verbosely; in prod, errors are sanitized (never expose
 * stack traces in responses — Constitution v2.0.0 research.md Q10).
 */
export const POST = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext,
    onError:
      env.NODE_ENV === "development"
        ? ({ path, error }) => console.error(`❌ tRPC error at ${path}:`, error)
        : undefined,
  });

export const GET = POST;
