/**
 * Global test setup (runs before all test suites).
 *
 * Per Constitution v2.0.0 Principle IV (Test-First):
 * - Integration tests MUST hit real Postgres via testcontainers
 * - DB mocks are forbidden
 *
 * The actual container lifecycle is managed per-test-file via
 * `getTestDb()` (see db.ts). This file only sets up common env.
 */
Object.assign(process.env, { NODE_ENV: "test" });

// Set dummy env vars so that `@t3-oss/env-nextjs` (src/lib/env.ts) and
// `src/server/db/client.ts` don't throw at module load time for
// unit/procedure tests (which mock DB queries and Better-Auth).
// Integration tests override DATABASE_URL with testcontainers connection.
if (!process.env.TESTCONTAINERS_OVERRIDE) {
  process.env.DATABASE_URL = "postgres://dummy:dummy@localhost:5432/dummy";
  process.env.BETTER_AUTH_SECRET = "dummy-secret-for-tests-only-16chars";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
}
