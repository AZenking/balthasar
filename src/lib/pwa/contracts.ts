import { z } from "zod";

/** One version for local PWA envelopes; incompatible values are discarded. */
export const PWA_SCHEMA_VERSION = 1;
export const CONNECTIVITY_STABILITY_MS = 300;

export const versionedEnvelopeSchema = z.object({
  schemaVersion: z.number().int(),
  data: z.unknown(),
});

export type EnvelopeParseResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: "unknown-version" | "invalid-payload" };

/** Parses untrusted browser storage without allowing malformed data to escape. */
export function parseVersionedEnvelope(input: unknown): EnvelopeParseResult {
  let value = input;

  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch {
      return { ok: false, reason: "invalid-payload" };
    }
  }

  const parsed = versionedEnvelopeSchema.safeParse(value);
  if (!parsed.success || parsed.data.data === undefined) {
    return { ok: false, reason: "invalid-payload" };
  }
  if (parsed.data.schemaVersion !== PWA_SCHEMA_VERSION) {
    return { ok: false, reason: "unknown-version" };
  }

  return { ok: true, data: parsed.data.data };
}

/** Cross-tab broadcast channel name shared by all PWA runtime instances. */
export const PWA_BROADCAST_CHANNEL = "balthasar:pwa";

/**
 * Cross-tab events. Payloads deliberately carry no financial data, credentials,
 * or draft fields — only the minimum signal other tabs need to synchronize
 * privacy, scope and update state.
 */
export type PwaBroadcastEvent =
  | { type: "PRIVACY_LOCKED" }
  | { type: "LOGOUT_COMPLETED" }
  | { type: "DRAFT_CLEARED"; scope: string }
  | { type: "UPDATE_AVAILABLE"; buildId: string };

export type ServiceReachability = "unknown" | "reachable" | "unreachable";

export interface ConnectivityState {
  stableOnline: boolean;
  pendingOnline: boolean | null;
  pendingSince: number | null;
  serviceReachability: ServiceReachability;
}

export type ConnectivitySignal = boolean | "reachable" | "unreachable";

export function createConnectivityState(online: boolean): ConnectivityState {
  return {
    stableOnline: online,
    pendingOnline: null,
    pendingSince: null,
    serviceReachability: online ? "unknown" : "unknown",
  };
}

/**
 * Browser signals are settled after a short window to avoid banner flicker.
 * Service reachability comes only from real application requests and never
 * changes `stableOnline`: a reachable browser may still be unable to reach us.
 */
export function transitionConnectivity(
  state: ConnectivityState,
  signal: ConnectivitySignal,
  now: number
): ConnectivityState {
  if (signal === "reachable" || signal === "unreachable") {
    return { ...state, serviceReachability: signal };
  }

  if (signal === state.stableOnline) {
    return { ...state, pendingOnline: null, pendingSince: null };
  }

  if (state.pendingOnline !== signal || state.pendingSince === null) {
    return { ...state, pendingOnline: signal, pendingSince: now };
  }

  if (now - state.pendingSince >= CONNECTIVITY_STABILITY_MS) {
    return {
      ...state,
      stableOnline: signal,
      pendingOnline: null,
      pendingSince: null,
    };
  }

  return state;
}
