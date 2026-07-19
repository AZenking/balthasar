import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createContext } from "@/server/api/trpc";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { startRequestContext } from "@/lib/request-context";
import { uuidv7 } from "uuidv7";

/**
 * tRPC HTTP endpoint mount (T027 / T014 034-observability).
 *
 * Mounted at /api/trpc/[trpc] — every procedure call from client components
 * flows through here.
 *
 * 034-observability-logging: each request is wrapped in a request-scoped
 * AsyncLocalStorage carrying a server-generated requestId (UUIDv7, sortable).
 * The timingMiddleware in src/server/api/trpc.ts reads this id and emits one
 * log record per procedure call (info / warn-if-slow / error). Better-Auth's
 * logger hook also reads it via getRequestContext() so auth events join the
 * same correlation stream (FR-014).
 *
 * In dev, errors include stack detail in the log; in prod, the response body
 * is sanitized (never expose stack traces — Constitution v2.0.0 Q10) but the
 * server-side log still records the full error.
 */
async function handle(req: Request): Promise<Response> {
  const requestId = uuidv7();
  return startRequestContext(requestId, async () => {
    try {
      return await fetchRequestHandler({
        endpoint: "/api/trpc",
        router: appRouter,
        req,
        createContext,
        onError:
          env.NODE_ENV === "development"
            ? ({ path, error, type }) =>
                logger.error(
                  {
                    path: path ?? null,
                    type,
                    requestId,
                    source: "trpc",
                    code: error.code,
                    stack:
                      env.NODE_ENV === "development"
                        ? error.stack
                        : undefined,
                  },
                  "tRPC error (dev verbose)",
                )
            : ({ path, error, type }) =>
                logger.error(
                  {
                    path: path ?? null,
                    type,
                    requestId,
                    source: "trpc",
                    code: error.code,
                  },
                  "tRPC error",
                ),
      });
    } catch (e) {
      // Catastrophic failure outside tRPC's own error formatting.
      logger.error(
        {
          requestId,
          source: "trpc",
          err: e instanceof Error ? { name: e.name, message: e.message } : String(e),
        },
        "tRPC handler threw unexpectedly",
      );
      throw e;
    }
  });
}

export const POST = handle;
export const GET = handle;
