/**
 * Re-export db + schema for ergonomic imports.
 * Per tasks.md T014: provides single import path for Better-Auth adapter
 * and business code.
 *
 *   import { db, user, family, member } from "@/server/db";
 */
export { db, withTransaction, type Db, type TxClient } from "./client";
export * as schema from "./schema";
export * from "./schema";
