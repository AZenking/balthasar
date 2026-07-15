CREATE TYPE "public"."account_type" AS ENUM('asset', 'debt');--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "type" "account_type" DEFAULT 'asset' NOT NULL;