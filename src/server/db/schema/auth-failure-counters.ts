import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * `auth_failure_counters` — per-email login failure tracking (FR-009).
 *
 * Why a separate table from Better-Auth's session/user:
 * - Better-Auth's rate-limit is per-IP, not per-email
 * - The 5/5min email lockout is custom business logic
 *
 * Lifecycle:
 * - Failure: failed_count += 1; at 5 → locked_until = now + 5min + audit event
 * - Success: row deleted (counter reset)
 * - Window expired: row kept but treated as unlocked (failed_count reset to 0
 *   on next attempt)
 */
export const authFailureCounter = pgTable("auth_failure_counters", {
  email: text("email").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuthFailureCounter = typeof authFailureCounter.$inferSelect;
