import { pgTable, uuid, text, bigint, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { family } from "./family";
import { uuidv7 } from "uuidv7";

/**
 * `accounts` — family-level account entity (Family 聚合下的实体).
 *
 * Per data-model.md §accounts + research.md:
 * - Q1: `currency` is `text` (not pgEnum); zod enum at procedure level
 * - Q2: `archived_at` timestamp NULL = single field for "archived" + "when"
 * - Q5: `initial_balance` bigint mode 'number' (JS-safe range, "分" unit)
 * - 001 research.md Q11: `updated_at` via Drizzle `.$onUpdate` (no DB trigger)
 *
 * MVP invariant: account belongs to family (not member). V2 may add private.
 */
export const account = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    currency: text("currency").notNull(),
    initialBalance: bigint("initial_balance", { mode: "number" })
      .notNull()
      .default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    // Partial index for default list query (excludes archived). Hot path.
    familyActiveIdx: index("accounts_family_active_idx")
      .on(t.familyId, t.archivedAt)
      .where(sql`${t.archivedAt} IS NULL`),
    // Full index for includeArchived=true list query.
    familyIdx: index("accounts_family_idx").on(t.familyId),
  })
);

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
