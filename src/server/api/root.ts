import { router } from "./trpc";

/**
 * Root application router (T024).
 *
 * Phase 2: empty router. Phase 3+ adds sub-routers as user stories are
 * implemented:
 *   - 003 US1: authRouter (auth.register / login / logout / me / auditEvents)
 *   - Future features: account, category, transaction, dashboard, etc.
 *
 * Type signature is exported for the tRPC client/server caller modules
 * (T025/T026) so they get end-to-end type inference.
 */
export const appRouter = router({});

export type AppRouter = typeof appRouter;
