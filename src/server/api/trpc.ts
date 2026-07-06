import { initTRPC, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { auth } from "@/server/auth/config";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import type { Session, User } from "@/server/db/schema";
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

export async function createContext(opts?: {
  req?: NextRequest;
  // Allow tests / RSC caller to pass pre-built headers (Next 16 async
  // headers() doesn't work outside Request scope).
  heads?: Headers;
}): Promise<CreateContext> {
  // Better-Auth expects Headers (works for both RSC and HTTP).
  // Next 16: headers() is async; tests pass `heads` directly to bypass.
  const heads = opts?.heads ?? opts?.req?.headers ?? (await headers());

  const result = await auth.api.getSession({ headers: heads });

  if (!result) {
    return { session: null };
  }

  return {
    session: {
      user: result.user,
      session: result.session,
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
 * Public procedure — anyone (authed or not) can call.
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure — requires a valid session. Throws UNAUTHORIZED
 * if `ctx.session` is null (FR-012). T023 in tasks.md.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
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
