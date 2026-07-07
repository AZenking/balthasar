-- 0005_api_keys.sql
-- Migration for 011-open-api feature.

CREATE TABLE "api_keys" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "key_prefix" text NOT NULL,
  "key_hash" text NOT NULL,
  "name" text DEFAULT '默认' NOT NULL,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;

CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" ("key_hash");
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" ("user_id");
