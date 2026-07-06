import { uuidv7 } from "uuidv7";

/**
 * UUID v7 generator wrapper.
 *
 * Why v7 (research.md Q9): time-ordered for B-tree friendly inserts.
 * Used by business tables (families, members, auth_events, auth_failure_counters).
 *
 * Better-Auth tables (user, session, verification, account) use cuid2
 * managed by Better-Auth itself — do NOT call this for those tables.
 */
export function newId(): string {
  return uuidv7();
}
