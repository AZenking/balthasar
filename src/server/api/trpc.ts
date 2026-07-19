import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { auth } from "@/server/auth/config";
import { headers } from "next/headers";
import type { Session, User } from "@/server/db/schema";
import { logger, isSlow } from "@/lib/logger";
import { getRequestContext, setUserId } from "@/lib/request-context";
import type { AppRouter } from "./root";

/**
 * tRPC context (T022).
 *
 * Per research.md Q12, session lookup is delegated to Better-Auth's
 * `auth.api.getSession()`. The result is injected as `ctx.session` for
 * procedure middleware to use.
 *
 * Both RSC (server.ts caller) and HTTP (route.ts) flows construct this
 * context via `createContext()` below.
 */
export interface SessionContext {
  user: User;
  session: Session;
}

export interface CreateContext {
  session: SessionContext | null;
}

export async function createContext(opts?: Partial<FetchCreateContextFnOptions> & {
  // Allow tests / RSC caller to pass pre-built headers (Next 16 async
  // headers() doesn't work outside Request scope).
  heads?: Headers;
}): Promise<CreateContext> {
  // Better-Auth expects Headers (works for both RSC and HTTP).
  // Next 16: headers() is async; tests pass `heads` directly to bypass.
  const heads = opts?.heads ?? opts?.req?.headers ?? new Headers(await headers());

  const result = await auth.api.getSession({ headers: heads });

  if (!result) {
    return { session: null };
  }

  // 034-observability: propagate the (already-entered) requestId into the
  // ALS store so downstream code (timingMiddleware, Better-Auth logger hook,
  // Drizzle error wrapper) can correlate. The requestId itself is generated
  // and entered by the HTTP handler in src/app/api/trpc/[trpc]/route.ts.
  setUserId(result.user.id);

  return {
    session: {
      user: {
        ...result.user,
        image: result.user.image ?? null,
      },
      session: {
        ...result.session,
        ipAddress: result.session.ipAddress ?? null,
        userAgent: result.session.userAgent ?? null,
      },
    },
  };
}

const t = initTRPC.context<CreateContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => {
    // Surface `retryAfterSeconds` from TRPCError.cause (set by login lockout
    // path) so clients can render remaining lockout time (FR-009, SC-007).
    const cause = error.cause as { retryAfterSeconds?: number } | undefined;
    return {
      ...shape,
      data: {
        ...shape.data,
        retryAfterSeconds: cause?.retryAfterSeconds,
      },
    };
  },
});

/**
 * Timing + structured-log middleware (T013 / FR-005, FR-006).
 *
 * Mounted on every procedure (via publicProcedure / protectedProcedure below)
 * so each call emits exactly one log record at completion:
 *   - success + fast  → info  "request complete"
 *   - success + slow  → warn  "slow request"   (FR-006, isSlow table)
 *   - failure         → error "request failed" (code from tRPCError)
 *
 * requestId/userId are pulled from AsyncLocalStorage (set by route.ts and
 * createContext). Outside HTTP scope (tests via createCaller, RSC server
 * calls), the store may be null — we degrade to requestId:null rather than
 * throw, so procedure tests still work without an ALS wrapper.
 */
const timingMiddleware = t.middleware(async ({ path, type, ctx, next }) => {
  const start = performance.now();
  const store = getRequestContext();
  const requestId = store?.requestId ?? null;
  const userId = store?.userId ?? ctx.session?.user.id ?? null;

  // tRPC middleware contract: errors thrown by downstream middleware or the
  // resolver are *caught* by callRecursive and surfaced as `{ ok: false,
  // error }` — `await next()` resolves, it does not reject. We must inspect
  // result.ok to distinguish success from failure (re-throwing would skip
  // tRPC's own error formatting / propagate incorrectly).
  const result = await next();
  const durationMs = Math.round(performance.now() - start);

  if (!result.ok) {
    // FR-007: when the underlying cause is a PostgreSQL error (Drizzle
    // wraps pg errors and re-throws as TRPCError INTERNAL_SERVER_ERROR),
    // surface the SQLSTATE code so operators can diagnose constraint
    // violations (23505 unique, 23503 FK, 08006 connection) without
    // reading raw SQL params (never logged — redact handles user input,
    // and we only pull `code` here, not `detail`/`message` which may
    // contain values).
    const cause = result.error.cause as { code?: string } | undefined;
    const sqlState = cause?.code;
    logger.error(
      {
        requestId,
        userId,
        path: path ?? null,
        type,
        durationMs,
        code: result.error.code,
        source: "trpc",
        // sqlState present ⇒ underlying failure was a DB error routed up
        // through Drizzle. Marking dbSource lets operators filter
        // "Drizzle-driven" failures from tRPC-level ones.
        ...(sqlState ? { sqlState, dbSource: "drizzle" } : {}),
      },
      "request failed",
    );
    // Pass the not-ok result through unchanged so tRPC's error formatter
    // (errorFormatter in initTRPC.create) still runs and clients see the
    // proper error shape.
    return result;
  }

  const slow = isSlow(path, durationMs);
  const level = slow ? "warn" : "info";
  logger[level](
    {
      requestId,
      userId,
      path: path ?? null,
      type,
      durationMs,
      source: "trpc",
    },
    slow ? "slow request" : "request complete",
  );
  return result;
});

/**
 * Public procedure — anyone (authed or not) can call.
 *
 * Includes timingMiddleware for structured logging (FR-005/FR-006).
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected procedure — requires a valid session. Throws UNAUTHORIZED
 * if `ctx.session` is null (FR-012). T023 in tasks.md.
 *
 * Includes timingMiddleware for structured logging (FR-005/FR-006).
 */
export const protectedProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "请先登录",
    });
  }
  return next({
    ctx: { ...ctx, session: ctx.session },
  });
});

export const router = t.router;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

/**
 * Type alias for the app router so client/server files can import it.
 */
export type AppRouterType = AppRouter;

/**
 * Re-export fetchRequestHandler for route.ts (T027).
 */
export { fetchRequestHandler };
