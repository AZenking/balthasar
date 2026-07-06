import "server-only";
import { db } from "@/server/db/client";
import { authEvent, type AuthEventType, type AuthEventOutcome } from "@/server/db/schema";
import { newId } from "@/lib/uuid";

/**
 * T039: audit hook (write side only).
 *
 * Triggered by Better-Auth lifecycle events (user.create, session.create,
 * session.delete, etc.). Writes one row per event to `auth_events` (FR-016).
 *
 * Per FR-016 / SC-010: `metadata` MUST NEVER contain password, token, ip,
 * or ua fields. The function takes a strongly-typed `metadata` object to
 * make accidental leakage harder.
 *
 * Per Clarification Q3: only the 5 mandatory event types are written:
 *   register_success | login_success | login_failure | lockout_triggered | logout
 *
 * Read side (findRecentByEmail) is in a separate query module
 * (src/server/db/queries/auth-events.ts) per Constitution v2.0.0
 * Principle II (Feature-Sliced) — see G1 fix in /speckit-analyze.
 */

export interface AuditEventInput {
  eventType: AuthEventType;
  email: string;
  outcome: AuthEventOutcome;
  metadata?: Record<string, unknown>;
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  // Defensive: redact any forbidden keys in metadata (defense-in-depth).
  const safeMetadata = redactSensitiveKeys(input.metadata ?? {});

  await db.insert(authEvent).values({
    id: newId(),
    eventType: input.eventType,
    email: input.email,
    outcome: input.outcome,
    metadata: safeMetadata,
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
