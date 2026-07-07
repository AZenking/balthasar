import "server-only";
import { transactionEvent, type TransactionEventType } from "@/server/db/schema";
import type { TxClient } from "@/server/db/client";

/**
 * T007: Transaction audit writer (research.md Q1+Q4 — same tx as business write).
 *
 * Accepts Drizzle transaction client as first param. The caller MUST pass `tx`
 * from `db.transaction(async (tx) => ...)`.
 *
 * Per FR-016 + SC-007: before/after jsonb hold only mutable fields
 * (type, accountId, categoryId, amount, remark, occurredAt).
 * MUST NEVER contain password/token/sessionToken/ip/ua.
 */
export interface TransactionEventInput {
  eventType: TransactionEventType;
  transactionId: string;
  actorMemberId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export async function writeTransactionEvent(
  tx: TxClient,
  input: TransactionEventInput
): Promise<void> {
  const safeBefore = input.before == null ? null : redactSensitiveKeys(input.before);
  const safeAfter = input.after == null ? null : redactSensitiveKeys(input.after);

  await tx.insert(transactionEvent).values({
    eventType: input.eventType,
    transactionId: input.transactionId,
    actorMemberId: input.actorMemberId,
    before: safeBefore,
    after: safeAfter,
  });
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
  input: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}
