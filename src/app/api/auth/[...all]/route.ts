import { auth } from "@/server/auth/config";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better-Auth HTTP handler mounted at /api/auth/* (T021).
 *
 * Mounts all Better-Auth endpoints (sign-up, sign-in, sign-out, get-session,
 * etc.) at a single Next.js catch-all route.
 *
 * The actual sign-up/login/logout logic for THIS feature is exposed as tRPC
 * procedures (auth.register / auth.login / auth.logout) that internally call
 * `auth.api.*`. Direct client calls to /api/auth/* are reserved for:
 * - Better-Auth's own SDK (auto session refresh in client components)
 * - Server-side prefetch (RSC fetching session)
 */
export const { GET, POST } = toNextJsHandler(auth);
