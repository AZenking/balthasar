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
 *
 * Type augmentation: Better-Auth client proxy infers methods dynamically,
 * but TypeScript doesn't see emailAndPassword plugin methods at compile
 * time. We declare them explicitly to pass `next build` type checking.
 */
interface AuthResult {
  data?: unknown;
  error?: { status?: number; message?: string } | null;
}

interface EmailPasswordClient {
  signInEmail(opts: { email: string; password: string }): Promise<AuthResult>;
  signUpEmail(opts: { email: string; password: string; name?: string }): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
}

export const authClient = createAuthClient() as ReturnType<
  typeof createAuthClient
> &
  EmailPasswordClient;

export type AuthClient = typeof authClient;
