import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { accountRouter } from "./routers/account";
import { categoryRouter } from "./routers/category";
import { transactionRouter } from "./routers/transaction";
import { dashboardRouter } from "./routers/dashboard";

export const appRouter = router({
  auth: authRouter,
  account: accountRouter,
  category: categoryRouter,
  transaction: transactionRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
