-- 0004_transactions.sql
--
-- Migration for 004-transaction feature.
-- Creates transactions + transaction_events tables.
--
-- Run via `pnpm db:migrate`.

CREATE TYPE "transaction_type" AS ENUM('income', 'expense');
CREATE TYPE "transaction_event_type" AS ENUM(
  'transaction_created',
  'transaction_edited',
  'transaction_deleted'
);

CREATE TABLE "transactions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "type" "transaction_type" NOT NULL,
  "account_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "amount" bigint NOT NULL,
  "remark" text DEFAULT '' NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_family_id_families_id_fk"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE cascade;
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_account_id_accounts_id_fk"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE restrict;
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_category_id_categories_id_fk"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE restrict;

CREATE INDEX "transactions_family_occurred_idx"
  ON "transactions" ("family_id", "occurred_at");
CREATE INDEX "transactions_family_type_idx"
  ON "transactions" ("family_id", "type");
CREATE INDEX "transactions_family_account_idx"
  ON "transactions" ("family_id", "account_id");
CREATE INDEX "transactions_family_category_idx"
  ON "transactions" ("family_id", "category_id");

CREATE TABLE "transaction_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "event_type" "transaction_event_type" NOT NULL,
  "transaction_id" uuid,
  "actor_member_id" uuid NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- F1 fix: ON DELETE SET NULL (not CASCADE) — preserves transaction_deleted audit
ALTER TABLE "transaction_events"
  ADD CONSTRAINT "transaction_events_transaction_id_transactions_id_fk"
  FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE set null;
ALTER TABLE "transaction_events"
  ADD CONSTRAINT "transaction_events_actor_member_id_members_id_fk"
  FOREIGN KEY ("actor_member_id") REFERENCES "members"("id") ON DELETE cascade;

CREATE INDEX "transaction_events_tx_time_idx"
  ON "transaction_events" ("transaction_id", "occurred_at");
