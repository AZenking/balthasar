import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { accountRouter } from "./routers/account";
import { categoryRouter } from "./routers/category";
import { transactionRouter } from "./routers/transaction";
import { dashboardRouter } from "./routers/dashboard";
import { apiKeyRouter } from "./routers/api-key";

export const appRouter = router({
  auth: authRouter,
  account: accountRouter,
  category: categoryRouter,
  transaction: transactionRouter,
  dashboard: dashboardRouter,
  apiKey: apiKeyRouter,
});

export type AppRouter = typeof appRouter;
