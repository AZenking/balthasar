import { createAuthClient } from "better-auth/client";
import { env } from "@/lib/env";

/**
 * Browser-side Better-Auth client (T020).
 *
 * Used by client components for session-aware UI (e.g., showing the logged-in
 * user). Server-side code MUST NOT import this; use the `auth` server instance
 * directly (src/server/auth/config.ts).
 *
 * Note: most app flows go through tRPC procedures (auth.register, auth.login,
 * auth.logout) rather than this client directly. The client is reserved for
 * RSC-level "is the user logged in?" queries that bypass tRPC.
 */
export const authClient = createAuthClient({
  baseURL: env.BETTER_AUTH_URL,
});

export type AuthClient = typeof authClient;
