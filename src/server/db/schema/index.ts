/**
 * Single source of truth for Drizzle schema.
 * Re-export all schema files for clean imports elsewhere.
 *
 * Order matters: Better-Auth tables (auth.ts) must be declared first because
 * business tables (family.ts, member.ts) reference them via foreign keys.
 */
export * from "./auth";
export * from "./family";
export * from "./member";
export * from "./auth-events";
export * from "./auth-failure-counters";
// 002-account
export * from "./account";
export * from "./account-events";
// 003-category
export * from "./category";
// 004-transaction
export * from "./transaction";
export * from "./transaction-events";
// 011-open-api
export * from "./api-keys";
