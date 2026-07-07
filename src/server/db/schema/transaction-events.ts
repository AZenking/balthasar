import {
  pgTable,
  uuid,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { transaction } from "./transaction";
import { member } from "./member";
import { uuidv7 } from "uuidv7";

/**
 * `transaction_events` — audit log (004-transaction, FR-016).
 *
 * Per F1 fix: `transaction_id` FK is **ON DELETE SET NULL** (not CASCADE).
 * This preserves `transaction_deleted` audit rows after the transaction is
 * hard-deleted — the FK becomes null but the audit record survives for
 * traceability.
 *
 * before/after jsonb hold only mutable fields (type, accountId, categoryId,
 * amount, remark, occurredAt). redactSensitiveKeys strips password/token/ip.
 */
export const transactionEventType = pgEnum("transaction_event_type", [
  "transaction_created",
  "transaction_edited",
  "transaction_deleted",
]);

export const transactionEvent = pgTable(
  "transaction_events",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    eventType: transactionEventType("event_type").notNull(),
    transactionId: uuid("transaction_id").references(
      () => transaction.id,
      { onDelete: "set null" }
    ),
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
    txTimeIdx: index("transaction_events_tx_time_idx").on(
      t.transactionId,
      t.occurredAt
    ),
  })
);

export type TransactionEvent = typeof transactionEvent.$inferSelect;
export type TransactionEventType =
  (typeof transactionEventType.enumValues)[number];
