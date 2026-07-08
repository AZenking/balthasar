import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Type-safe environment variable access (T3 standard).
 * Panic-fast on missing/invalid config at boot (Constitution v2.0.0 Q8).
 *
 * Server-only keys are accessed via `env.DB_URL` server-side.
 * Client-exposed keys must be prefixed with `NEXT_PUBLIC_`.
 *
 * 013-simple-deploy additions:
 * - ALLOW_REGISTRATION: master switch for sign-up endpoint. Default "false"
 *   keeps public deployments safe. First-user bypass (user.count==0) regardless.
 * - TZ: container timezone, default Asia/Shanghai. DB stores UTC via timestamptz,
 *   business layer (Dashboard monthly rollup) computes month boundary per TZ.
 * - BALTHASAR_ENTRYPOINT_MODE: docker entrypoint selector (serve vs migrate-only).
 *   Used by docker/entrypoint.sh; harmless on hosts without that script.
 * - POSTGRES_HOST: hostname used by entrypoint pg_isready probe (default "postgres",
 *   the compose service name).
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(16),
    BETTER_AUTH_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    ALLOW_REGISTRATION: z.enum(["true", "false"]).default("false"),
    TZ: z.string().default("Asia/Shanghai"),
    BALTHASAR_ENTRYPOINT_MODE: z.enum(["serve", "migrate"]).optional(),
    POSTGRES_HOST: z.string().default("postgres"),
  },
  client: {
    NEXT_PUBLIC_ALLOW_REGISTRATION: z.enum(["true", "false"]).optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION,
    TZ: process.env.TZ,
    BALTHASAR_ENTRYPOINT_MODE: process.env.BALTHASAR_ENTRYPOINT_MODE,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    NEXT_PUBLIC_ALLOW_REGISTRATION:
      process.env.NEXT_PUBLIC_ALLOW_REGISTRATION ?? process.env.ALLOW_REGISTRATION,
  },
  skipValidation: !!process.env.CI && process.env.CI !== "false",
});
