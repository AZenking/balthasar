-- 0001_init.sql
--
-- Initial schema migration for BALTHASAR (v2.0.0 T3 Stack).
-- Covers all 8 tables: 4 Better-Auth tables + 4 business tables.
-- Run via `pnpm db:migrate` or `drizzle-kit migrate`.

-- ============================================================================
-- Better-Auth tables (managed by Better-Auth; do not modify directly)
-- ============================================================================

CREATE TABLE "user" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "name" text NOT NULL,
  "image" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "user_email_unique" ON "user" ("email");

CREATE TABLE "session" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "session_token_unique" ON "session" ("token");
ALTER TABLE "session"
  ADD CONSTRAINT "session_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;

CREATE TABLE "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "account" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "expires_at" timestamp,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "account"
  ADD CONSTRAINT "account_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;

-- ============================================================================
-- Business tables
-- ============================================================================

CREATE TYPE "auth_event_type" AS ENUM(
  'register_success',
  'login_success',
  'login_failure',
  'lockout_triggered',
  'logout'
);
CREATE TYPE "auth_event_outcome" AS ENUM('success', 'failure');

CREATE TABLE "families" (
  "id" uuid PRIMARY KEY NOT NULL,
  "owner_user_id" text NOT NULL,
  "name" text DEFAULT '我的家庭' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "families_owner_user_id_unique_idx" ON "families" ("owner_user_id");
ALTER TABLE "families"
  ADD CONSTRAINT "families_owner_user_id_user_id_fk"
  FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE cascade;

CREATE TABLE "members" (
  "id" uuid PRIMARY KEY NOT NULL,
  "family_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "display_name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "members_family_id_idx" ON "members" ("family_id");
CREATE UNIQUE INDEX "members_user_id_unique_idx" ON "members" ("user_id");
ALTER TABLE "members"
  ADD CONSTRAINT "members_family_id_families_id_fk"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE cascade;
ALTER TABLE "members"
  ADD CONSTRAINT "members_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;

CREATE TABLE "auth_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "event_type" "auth_event_type" NOT NULL,
  "email" text NOT NULL,
  "outcome" "auth_event_outcome" NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE INDEX "auth_events_email_time_idx" ON "auth_events" ("email", "occurred_at");
CREATE INDEX "auth_events_type_time_idx" ON "auth_events" ("event_type", "occurred_at");

CREATE TABLE "auth_failure_counters" (
  "email" text PRIMARY KEY NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "locked_until" timestamp with time zone,
  "last_attempt_at" timestamp with time zone DEFAULT now() NOT NULL
);
