import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type Pool as PgPool } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";

/**
 * Test database helper (Constitution v2.0.0 Principle IV — Test-First).
 *
 * Provides each test file with an isolated Postgres instance:
 * 1. Start a fresh Postgres 16 container
 * 2. Apply all Drizzle migrations via `drizzle-orm` `migrate()` API
 * 3. Return a connected `db` client + the container (for teardown)
 *
 * Caller MUST call `stopTestDb()` in `afterAll` to release resources.
 */
export interface TestDb {
  db: NodePgDatabase;
  pool: PgPool;
  container: StartedPostgreSqlContainer;
  connectionString: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __balthasarTestDb: TestDb | undefined;
}

export async function startTestDb(): Promise<TestDb> {
  if (globalThis.__balthasarTestDb) {
    return globalThis.__balthasarTestDb;
  }

  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("balthasar_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const connectionString = container.getConnectionUri();
  process.env.DATABASE_URL = connectionString;

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  // Apply migrations via drizzle-orm's migrator (avoids shell-out to drizzle-kit).
  const migrationsFolder = path.resolve(process.cwd(), "src/server/db/migrations");
  await migrate(db, { migrationsFolder });

  const testDb = { db, pool, container, connectionString };
  globalThis.__balthasarTestDb = testDb;
  return testDb;
}

export async function stopTestDb(testDb: TestDb): Promise<void> {
  if (!globalThis.__balthasarTestDb) {
    return;
  }

  if (globalThis.__balthasarTestDb !== testDb) {
    await testDb.container.stop();
    return;
  }

  if (globalThis.__balthasarDbPool) {
    await globalThis.__balthasarDbPool.end();
    globalThis.__balthasarDbPool = undefined;
  }
  await testDb.pool.end();
  globalThis.__balthasarTestDb = undefined;
  await testDb.container.stop();
}

// Re-export for tests that need to shell out (e.g., verifying CLI behavior).
export function shellMigrate(connectionString: string): void {
  execSync(`DATABASE_URL=${connectionString} pnpm db:migrate`, {
    stdio: "inherit",
  });
}
