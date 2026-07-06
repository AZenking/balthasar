import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 * - schema: single source of truth lives under src/server/db/schema
 * - out: generated SQL migrations
 * - dialect: postgresql (frozen by constitution v2.0.0)
 */
export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/balthasar",
  },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
