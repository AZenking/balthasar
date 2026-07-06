import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { accountRouter } from "./routers/account";

/**
 * Root application router.
 *
 * Sub-routers attached per feature (Constitution v2.0.0 Principle II
 * Feature-Sliced):
 * - auth (001-auth-family): me, auditEvents (register/login/logout via
 *   Better-Auth direct endpoints at /api/auth/*)
 * - account (002-account): create, list, update, archive, unarchive
 *
 * Future features (category, transaction, dashboard) attach here as
 * new sub-routers are implemented. Use `router({ auth, account, ... })`
 * explicit merge — never `mergeRouters` to preserve type inference.
 */
export const appRouter = router({
  auth: authRouter,
  account: accountRouter,
});

export type AppRouter = typeof appRouter;
