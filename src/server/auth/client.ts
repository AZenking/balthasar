import { createAuthClient } from "better-auth/client";

/**
 * Browser-side Better-Auth client (T020).
 *
 * Used by client components for sign-up/sign-in/sign-out.
 * Server-side code MUST NOT import this; use the `auth` server instance
 * directly (src/server/auth/config.ts).
 *
 * baseURL omitted — defaults to current origin (window.location.origin),
 * which is correct for same-origin Better-Auth mounted at /api/auth/*.
 */
export const authClient = createAuthClient();

export type AuthClient = typeof authClient;
