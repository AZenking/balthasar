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

// Ensure tests don't accidentally hit the production DB.
// Testcontainers assigns a random port; production DATABASE_URL is irrelevant
// during tests but we still forbid accidental reuse by unsetting it.
if (!process.env.TESTCONTAINERS_OVERRIDE) {
  delete process.env.DATABASE_URL;
}
