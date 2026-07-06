import {
  pgTable,
  uuid,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { account } from "./account";
import { member } from "./member";
import { uuidv7 } from "uuidv7";

/**
 * `account_events` — audit log for account operations (Clarification Q1).
 *
 * Per FR-015 + SC-004 same-source constraint:
 * - `before` / `after` jsonb hold only mutable fields (name, currency)
 * - MUST NEVER contain password / token / sessionToken / ip / ua
 * - writeAccountEvent() redacts sensitive keys defensively (defense-in-depth)
 *
 * Per research.md Q6: audit writes in same db.transaction as business write.
 */
export const accountEventType = pgEnum("account_event_type", [
  "account_created",
  "account_edited",
  "account_archived",
  "account_unarchived",
]);

export const accountEvent = pgTable(
  "account_events",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    eventType: accountEventType("event_type").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    actorMemberId: uuid("actor_member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    before: jsonb("before"),
    after: jsonb("after"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    accountTimeIdx: index("account_events_account_time_idx").on(
      t.accountId,
      t.occurredAt
    ),
  })
);

export type AccountEvent = typeof accountEvent.$inferSelect;
export type AccountEventType = (typeof accountEventType.enumValues)[number];
