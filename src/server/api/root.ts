import { router } from "./trpc";
import { authRouter } from "./routers/auth";

/**
 * Root application router (T024 / T042).
 *
 * Phase 2: empty router.
 * Phase 3+: authRouter attached (register / login / logout / me / auditEvents).
 *
 * Future features (account, category, transaction, dashboard) will be
 * attached here as new sub-routers are implemented.
 */
export const appRouter = router({
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
