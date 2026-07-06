import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import * as schema from "./schema";

/**
 * Drizzle client singleton.
 *
 * Per Constitution v2.0.0 Principle II (Feature-Sliced): the DB client is
 * the only place that constructs `drizzle()` with our schema. All other
 * code receives the client via dependency injection (Better-Auth adapter,
 * tRPC context, test helpers).
 *
 * Connection pool size: 10 (default). Increase only if p95 latency regressions
 * are traced to pool starvation (Constitution v2.0.0 — measure before tuning).
 */
declare global {
  // eslint-disable-next-line no-var
  var __balthasarDbPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__balthasarDbPool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Did you forget to copy .env.example to .env?"
      );
    }
    globalThis.__balthasarDbPool = new Pool({
      connectionString: url,
      max: 10,
    });
  }
  return globalThis.__balthasarDbPool;
}

export type Db = NodePgDatabase<typeof schema>;

export const db: Db = drizzle(getPool(), { schema, casing: "snake_case" });

/**
 * Open a transaction client (for atomic multi-table writes, e.g., FR-004).
 *
 * Usage:
 * ```
 * const result = await db.transaction(async (tx) => {
 *   const u = await tx.insert(user).values(...).returning();
 *   const f = await tx.insert(family).values(...).returning();
 *   return { user: u[0], family: f[0] };
 * });
 * ```
 */
export type TxClient = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function withTransaction<T>(
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return db.transaction(fn);
}

export type PoolClientType = PoolClient;
export { getPool };
