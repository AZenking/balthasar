import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { uuidv7 } from "uuidv7";

/**
 * `api_keys` — API keys for third-party access (011-open-api).
 *
 * Key format: bk_ + 32 chars base62 (e.g. bk_aB3dE6fG9hIjKlMnOpQrStUvWxYz012345)
 * Storage: SHA-256 hash only, plaintext returned once at creation time.
 * keyPrefix: first 11 chars for list display (bk_aB3dE6fG9).
 */
export const apiKey = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    name: text("name").notNull().default("默认"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    keyHashIdx: index("api_keys_key_hash_idx").on(t.keyHash),
    userIdIdx: index("api_keys_user_id_idx").on(t.userId),
  })
);

export type ApiKey = typeof apiKey.$inferSelect;
