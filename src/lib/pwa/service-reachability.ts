import type { ServiceReachability } from "@/lib/pwa/contracts";

export type RequestOutcome = { kind: "success" | "network" | "timeout" | "5xx" | "4xx" };
export const PWA_REACHABILITY_EVENT = "balthasar:pwa-reachability";

/**
 * Derive reachability solely from real request outcomes. 4xx is a completed
 * server response, never an outage; browser-offline takes precedence.
 */
export function classifyRequestOutcome(
  outcome: RequestOutcome,
  browserOnline: boolean
): ServiceReachability {
  if (!browserOnline) return "unknown";
  if (outcome.kind === "success" || outcome.kind === "4xx") return "reachable";
  return "unreachable";
}

export function requestOutcomeFromError(error: unknown): RequestOutcome {
  const candidate = error as { data?: { httpStatus?: number }; status?: number; message?: string };
  const status = candidate.data?.httpStatus ?? candidate.status;
  if (typeof status === "number") return { kind: status >= 500 ? "5xx" : "4xx" };
  if (/timeout|timed out/i.test(candidate.message ?? "")) return { kind: "timeout" };
  return { kind: "network" };
}

export function reportRequestOutcome(outcome: RequestOutcome): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PWA_REACHABILITY_EVENT, { detail: outcome }));
}
