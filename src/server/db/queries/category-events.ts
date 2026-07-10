import "server-only";
import {
  categoryEvent,
  type CategoryEventType,
  type CategoryMutationSnapshot,
} from "@/server/db/schema";
import type { TxClient } from "@/server/db/client";

/**
 * Category audit writer (018-custom-category, T009).
 *
 * Pattern mirrors `transaction-events.ts` (004):
 * - Accept Drizzle tx client as first param. Caller MUST pass tx from
 *   `db.transaction(async (tx) => ...)`.
 * - before/after jsonb hold only mutable fields (CategoryMutationSnapshot).
 * - `redactSensitiveKeys` strips password/token/ip/ua defensively (none of
 *   those should ever appear in a category snapshot, but defense-in-depth).
 *
 * Per FR-026: only custom category writes are audited. Built-in reads /
 * reads of any category produce no events.
 */

export interface CategoryEventInput {
  eventType: CategoryEventType;
  categoryId: string;
  actorMemberId: string;
  before?: CategoryMutationSnapshot | null;
  after?: CategoryMutationSnapshot | null;
}

export async function writeCategoryEvent(
  tx: TxClient,
  input: CategoryEventInput,
): Promise<void> {
  const safeBefore =
    input.before == null ? null : redactSensitiveKeys(input.before);
  const safeAfter =
    input.after == null ? null : redactSensitiveKeys(input.after);

  await tx.insert(categoryEvent).values({
    eventType: input.eventType,
    categoryId: input.categoryId,
    actorMemberId: input.actorMemberId,
    before: safeBefore,
    after: safeAfter,
  });
}

export interface CategoryEventBatchItem {
  eventType: CategoryEventType;
  categoryId: string;
  before?: CategoryMutationSnapshot | null;
  after?: CategoryMutationSnapshot | null;
}

/**
 * Batch-write multiple audit events atomically within the caller's tx.
 * Used by cascade archive/unarchive (FR-017): parent + N children each
 * produce one event, all in the same transaction.
 *
 * actorMemberId is shared across the batch (one user triggered the cascade).
 */
export async function writeCategoryEventsBatch(
  tx: TxClient,
  items: CategoryEventBatchItem[],
  actorMemberId: string,
): Promise<void> {
  if (items.length === 0) return;
  await tx.insert(categoryEvent).values(
    items.map((it) => ({
      eventType: it.eventType,
      categoryId: it.categoryId,
      actorMemberId,
      before: it.before == null ? null : redactSensitiveKeys(it.before),
      after: it.after == null ? null : redactSensitiveKeys(it.after),
    })),
  );
}

const FORBIDDEN_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "sessionToken",
  "ip",
  "ipAddress",
  "ua",
  "userAgent",
]);

function redactSensitiveKeys(
  input: CategoryMutationSnapshot | Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}
