import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Type-safe environment variable access (T3 standard).
 * Panic-fast on missing/invalid config at boot (Constitution v2.0.0 Q8).
 *
 * Server-only keys are accessed via `env.DB_URL` server-side.
 * Client-exposed keys must be prefixed with `NEXT_PUBLIC_`.
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(16),
    BETTER_AUTH_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  client: {
    // Add NEXT_PUBLIC_* keys here when needed (e.g. NEXT_PUBLIC_APP_NAME)
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.CI && process.env.CI !== "false",
});
