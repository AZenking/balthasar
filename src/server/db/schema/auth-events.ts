import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

/**
 * `auth_events` — audit log for security events (FR-016, FR-017).
 *
 * Per Clarification Q3: 5 event types are mandatory:
 *   register_success | login_success | login_failure | lockout_triggered | logout
 *
 * Per SC-010 / FR-016: `metadata` jsonb MUST NEVER contain password,
 * token, ip, or ua fields. Audited by grep + DB spot-checks (SC-004).
 */
export const authEventType = pgEnum("auth_event_type", [
  "register_success",
  "login_success",
  "login_failure",
  "lockout_triggered",
  "logout",
]);

export const authEventOutcome = pgEnum("auth_event_outcome", [
  "success",
  "failure",
]);

export const authEvent = pgTable(
  "auth_events",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    eventType: authEventType("event_type").notNull(),
    email: text("email").notNull(),
    outcome: authEventOutcome("outcome").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => ({
    emailTimeIdx: index("auth_events_email_time_idx").on(t.email, t.occurredAt),
    typeTimeIdx: index("auth_events_type_time_idx").on(t.eventType, t.occurredAt),
  })
);

export type AuthEvent = typeof authEvent.$inferSelect;
export type AuthEventType = (typeof authEventType.enumValues)[number];
export type AuthEventOutcome = (typeof authEventOutcome.enumValues)[number];
