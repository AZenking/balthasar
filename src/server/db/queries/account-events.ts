import "server-only";
import { accountEvent, type AccountEventType } from "@/server/db/schema";
import type { TxClient } from "@/server/db/client";

/**
 * T015: Account audit writer (research.md Q6 — must run inside transaction).
 *
 * Accepts a Drizzle transaction client as first param. The caller (procedure)
 * MUST pass `tx` from `db.transaction(async (tx) => ...)`. Otherwise audit
 * and business write aren't atomic — violates research.md Q6.
 *
 * Per FR-015 + SC-004 same-source constraint:
 * - `before` / `after` only hold mutable account fields (name, currency, etc.)
 * - MUST NEVER contain password / token / sessionToken / ip / ua
 * - redactSensitiveKeys() provides defense-in-depth
 */
export interface AccountEventInput {
  eventType: AccountEventType;
  accountId: string;
  actorMemberId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export async function writeAccountEvent(
  tx: TxClient,
  input: AccountEventInput
): Promise<void> {
  const safeBefore = input.before == null ? null : redactSensitiveKeys(input.before);
  const safeAfter = input.after == null ? null : redactSensitiveKeys(input.after);

  await tx.insert(accountEvent).values({
    eventType: input.eventType,
    accountId: input.accountId,
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
