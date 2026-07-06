-- 0002_accounts.sql
--
-- Migration for 002-account feature.
-- Adds accounts + account_events tables.
--
-- Run via `pnpm db:migrate` (drizzle-kit migrate).

CREATE TYPE "account_event_type" AS ENUM(
  'account_created',
  'account_edited',
  'account_archived',
  'account_unarchived'
);

CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "name" text NOT NULL,
  "currency" text NOT NULL,
  "initial_balance" bigint DEFAULT 0 NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_family_id_families_id_fk"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE cascade;

-- Partial index for default list query (excludes archived). Hot path.
CREATE INDEX "accounts_family_active_idx"
  ON "accounts" ("family_id", "archived_at")
  WHERE "accounts"."archived_at" IS NULL;

-- Full index for includeArchived=true list query.
CREATE INDEX "accounts_family_idx"
  ON "accounts" ("family_id");

CREATE TABLE "account_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "event_type" "account_event_type" NOT NULL,
  "account_id" uuid NOT NULL,
  "actor_member_id" uuid NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "account_events"
  ADD CONSTRAINT "account_events_account_id_accounts_id_fk"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade;
ALTER TABLE "account_events"
  ADD CONSTRAINT "account_events_actor_member_id_members_id_fk"
  FOREIGN KEY ("actor_member_id") REFERENCES "members"("id") ON DELETE cascade;

CREATE INDEX "account_events_account_time_idx"
  ON "account_events" ("account_id", "occurred_at");
