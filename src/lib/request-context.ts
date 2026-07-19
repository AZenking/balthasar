import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped context for log correlation (T009 / FR-001 / research.md R2).
 *
 * Stores `requestId` (server-generated UUID, one per inbound HTTP request)
 * and `userId` (resolved after Better-Auth session lookup, null until then).
 *
 * Hybrid propagation (spec Q5 Option C):
 *  - Boundary layer (tRPC createContext) calls `startRequestContext()` to
 *    enter an isolated ALS scope for the whole request lifecycle.
 *  - Any deep function (Drizzle repository, generic util) reads
 *    `getRequestContext()` zero-signature — no parameter threading required.
 *  - The §五 p95 critical paths (transaction.create / auth.* / dashboard.*)
 *    additionally receive `requestId` as an explicit parameter so their
 *    unit/integration tests can assert log correlation without ALS mocking.
 *
 * Fail-open contract: outside any request scope (startup, cron, migration),
 * `getRequestContext()` returns `null` — loggers fall back to
 * `requestId: null` and must not throw.
 */

export interface RequestContext {
  requestId: string;
  userId: string | null;
}

const als = new AsyncLocalStorage<RequestContext>();

/**
 * Run `fn` inside a fresh request context identified by `requestId`.
 *
 * Uses `als.run(...)` (not `enterWith`) so the scope is automatically
 * restored to the prior store on function exit — including the nested-scope
 * case (inner startRequestContext restores outer on completion).
 */
export function startRequestContext<T>(
  requestId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return als.run({ requestId, userId: null }, fn);
}

/**
 * Read the current request context, or `null` if outside any request scope.
 *
 * Callers must null-check (fail-open). The logger helper does this on every
 * call; production code may also call directly when it needs the requestId
 * for explicit-parameter threading.
 */
export function getRequestContext(): RequestContext | null {
  return als.getStore() ?? null;
}

/**
 * Convenience: read just the requestId, or null.
 */
export function getRequestId(): string | null {
  return als.getStore()?.requestId ?? null;
}

/**
 * Update the userId on the current request context (called after Better-Auth
 * session resolves). No-op outside any scope (defensive — createContext is
 * the only legitimate caller).
 */
export function setUserId(userId: string): void {
  const store = als.getStore();
  if (store) {
    store.userId = userId;
  }
}
