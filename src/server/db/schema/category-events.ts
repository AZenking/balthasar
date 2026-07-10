import {
  pgTable,
  uuid,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { category } from "./category";
import { member } from "./member";
import { uuidv7 } from "uuidv7";

/**
 * `category_events` — audit log for category write operations (018 FR-026).
 *
 * Pattern mirrors `transaction_events` (004) and `account_events` (002):
 * - id: UUID v7 (random, time-sortable)
 * - categoryId FK is ON DELETE SET NULL (categories are not hard-deleted per
 *   FR-019, so this is defensive only — preserves audit trail if a future
 *   purge ever lands)
 * - actorMemberId FK is ON DELETE CASCADE (member delete cascades audit)
 * - before/after jsonb hold only mutable fields (see CategoryMutationSnapshot
 *   type below). MUST NEVER contain password/token/sessionToken/ip/ua.
 *
 * Retention: 永久 (research.md D5 — category mutations are rare, storage
 * negligible, audit completeness prioritized).
 *
 * Writes (per FR-026):
 * - category_created: after populated, before null
 * - category_edited: both populated, only mutable fields
 * - category_archived: before.archivedAt=null, after.archivedAt=timestamp
 * - category_unarchived: before.archivedAt=timestamp, after.archivedAt=null
 *
 * Cascade archive/unarchive writes 1 + N events (parent + each child).
 */
export const categoryEventType = pgEnum("category_event_type", [
  "category_created",
  "category_edited",
  "category_archived",
  "category_unarchived",
]);

export const categoryEvent = pgTable(
  "category_events",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    eventType: categoryEventType("event_type").notNull(),
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
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
    catTimeIdx: index("category_events_cat_time_idx").on(
      t.categoryId,
      t.occurredAt,
    ),
  }),
);

export type CategoryEvent = typeof categoryEvent.$inferSelect;
export type CategoryEventType =
  (typeof categoryEventType.enumValues)[number];

/**
 * Snapshot of mutable category fields for before/after jsonb.
 * MUST NOT include id / familyId / isBuiltIn / createdAt / updatedAt
 * (those are immutable system fields, not interesting for audit diff).
 *
 * `archivedAt` is included because archive/unarchive IS a state mutation
 * worth auditing.
 */
export interface CategoryMutationSnapshot {
  name: string;
  icon: string;
  sortOrder: number;
  parentId: string | null;
  type: "income" | "expense";
  archivedAt: string | null; // ISO timestamp or null
}
