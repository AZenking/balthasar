import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { uuidv7 } from "uuidv7";

/**
 * `families` — the bookkeeping aggregate root (Constitution v2.0.0 Principle III).
 *
 * MVP invariant: 1 user ⇄ 1 family (SC-005). Enforced via UNIQUE index on
 * `owner_user_id`. Default family name is fixed to "我的家庭" per FR-005;
 * customization is V2.
 *
 * `ownerUserId` is a string (cuid2) referencing Better-Auth's `user.id`,
 * NOT a UUID. This is the cross-aggregate reference mentioned in research.md Q9
 * (dual-track ID strategy).
 */
export const family = pgTable(
  "families",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("我的家庭"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    ownerUniqueIdx: uniqueIndex("families_owner_user_id_unique_idx").on(t.ownerUserId),
  })
);

export type Family = typeof family.$inferSelect;
