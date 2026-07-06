import "server-only";
import { db } from "@/server/db/client";
import { authEvent } from "@/server/db/schema";
import { desc, lt, eq, sql } from "drizzle-orm";

/**
 * T068: read path for auth_events (FR-017).
 *
 * Lives in a separate file from audit.hook.ts (write side) per
 * Constitution v2.0.0 Principle II (Feature-Sliced) and the G1 fix
 * from /speckit-analyze.
 *
 * Returns events from the last `days` (default 30) for a given email,
 * ordered by occurredAt DESC. NEVER returns password/token fields —
 * the schema doesn't store them in the first place.
 */
export async function findRecentAuthEventsByEmail(
  email: string,
  days = 30
) {
  const cutoff = new Date(Date.now() - days * 86_400_000);

  return db
    .select({
      eventType: authEvent.eventType,
      outcome: authEvent.outcome,
      occurredAt: authEvent.occurredAt,
      metadata: authEvent.metadata,
    })
    .from(authEvent)
    .where(sql`${authEvent.email} = ${email} AND ${authEvent.occurredAt} > ${cutoff}`)
    .orderBy(desc(authEvent.occurredAt));
}
