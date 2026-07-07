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

// Set a dummy DATABASE_URL so that `src/server/db/client.ts` doesn't throw
// at module load time for unit/procedure tests (which mock DB queries).
// Integration tests override this with the real testcontainers connection.
if (!process.env.TESTCONTAINERS_OVERRIDE) {
  process.env.DATABASE_URL = "postgres://dummy:dummy@localhost:5432/dummy";
}
