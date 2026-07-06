import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { accountRouter } from "./routers/account";
import { categoryRouter } from "./routers/category";

/**
 * Root application router.
 *
 * Sub-routers attached per feature (Constitution v2.0.0 Principle II
 * Feature-Sliced):
 * - auth (001-auth-family): me, auditEvents (register/login/logout via
 *   Better-Auth direct endpoints at /api/auth/*)
 * - account (002-account): create, list, update, archive, unarchive
 * - category (003-category): list, get (read-only dictionary)
 *
 * Future features (transaction, dashboard) attach here as new sub-routers.
 */
export const appRouter = router({
  auth: authRouter,
  account: accountRouter,
  category: categoryRouter,
});

export type AppRouter = typeof appRouter;
