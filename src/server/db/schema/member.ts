import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { family } from "./family";
import { user } from "./auth";
import { uuidv7 } from "uuidv7";

/**
 * `members` — a person within a family who recorded a transaction.
 *
 * MVP invariant (SC-005): 1 family ⇄ 1 member; 1 user ⇄ 1 member.
 * Enforced via UNIQUE on `user_id`. Default `displayName` is derived from
 * the user's email local-part at registration time (T037 family-init.hook).
 */
export const member = pgTable(
  "members",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    familyIdx: index("members_family_id_idx").on(t.familyId),
    userUniqueIdx: uniqueIndex("members_user_id_unique_idx").on(t.userId),
  })
);

export type Member = typeof member.$inferSelect;
