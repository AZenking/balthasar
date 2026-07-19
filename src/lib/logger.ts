import pino, { type Logger, type StreamEntry } from "pino";
import { env } from "@/lib/env";

/**
 * Server-side structured logger (T010 / research.md R1, R6, R7).
 *
 * WHAT (contracts/log-record.md):
 *   - Production: JSON line per record, ISO8601 UTC time, string level label.
 *   - Development: pino-pretty colorized multi-line.
 *   - Test: info/debug silenced so test output stays clean; error still
 *     emitted so failure-path assertions can capture it.
 *
 * HOW (research.md R6): no LOG_LEVEL env. Behaviour is derived purely from
 * NODE_ENV. Adding a knob now is YAGNI — MVP traffic doesn't need runtime
 * tuning; promote later if a real ops need appears.
 *
 * WHY pino (research.md R1): 5-8x faster than winston in public benchmarks,
 * native JSON output, API naturally encourages structured fields (FR-013),
 * and the SC-004 ≤5% p95 overhead budget directly favours async pino over
 * winston's synchronous transports.
 */

/**
 * Slow-request thresholds in milliseconds (FR-006 / Constitution §五 p95).
 *
 * Any request whose tRPC path matches an entry and whose durationMs is >=
 * the threshold gets auto-upgraded to `warn` (with msg "slow request"),
 * regardless of success/failure. Paths absent from this table never
 * auto-upgrade (Infinity).
 *
 * Thresholds mirror the Constitution's p95 budget exactly: a request
 * *at* the budget boundary is treated as slow so we can monitor regressions
 * early rather than only after exceeding the budget.
 */
export const SLOW_THRESHOLDS_MS: Record<string, number> = {
  "transaction.create": 300,
  "dashboard.getMonthSummary": 500,
  // dashboard.* prefix handled in isSlow via the dashboardPrefix logic
};

const DASHBOARD_PREFIX = "dashboard.";

/**
 * Decide whether a (path, durationMs) pair counts as a slow request (FR-006).
 *
 * Pure function — unit-tested independently of the logger so the policy can
 * evolve without touching middleware wiring.
 */
export function isSlow(path: string | undefined, durationMs: number): boolean {
  if (!path) return false;
  const exact = SLOW_THRESHOLDS_MS[path];
  if (exact !== undefined) return durationMs >= exact;
  // Dashboard prefix fallback: any dashboard.* path uses the canonical
  // 500ms budget (matches the Constitution's "Dashboard query p95 < 500ms"
  // which is stated for the family, not one specific procedure).
  if (path.startsWith(DASHBOARD_PREFIX)) {
    return durationMs >= SLOW_THRESHOLDS_MS["dashboard.getMonthSummary"]!;
  }
  return false;
}

/**
 * Redact paths (research.md R7, contracts/log-record.md).
 *
 * `censor: "[REDACTED]"` + `remove: false`: keeps the key as a visible
 * placeholder so operators can see "this field was sanitized" while the
 * raw value never reaches stdout.
 *
 * The list below is the complete set; additions require a contract revision
 * (contracts/log-record.md is a stable external interface).
 */
const REDACT_PATHS = [
  "password",
  "*.password",
  "email",
  "*.email",
  "headers.authorization",
  "headers.cookie",
  "secret",
  "*.secret",
  "amount",
  "*.amount",
  "remark",
  "*.remark",
] as const;

/**
 * Resolve the pino level label from its numeric value (pino emits `level: 30`
 * by default; our contract requires `level: "info"`).
 *
 * Pino calls level formatters as (label, number) — we only need the number
 * to look up the canonical label (which equals `label` in stock pino, but
 * re-deriving guards against custom level overrides).
 */
function levelLabeler(label: string, level: number): { level: string } {
  return { level: pino.levels.labels[level] ?? label };
}

/**
 * ISO8601 UTC timestamp string ("2026-07-19T08:30:00.123Z"). Pino default
 * emits epoch ms; the log-record contract (FR-003) requires ISO8601.
 */
function isoTimestamp(): string {
  return `,"time":"${new Date().toISOString()}"`;
}

interface LoggerOpts {
  /** Override destination stream (tests inject in-memory sinks). */
  stream?: NodeJS.WritableStream;
  /**
   * Override minimum level. Defaults are derived from NODE_ENV.
   * Tests pass "trace" to capture everything.
   */
  minLevel?: pino.LevelWithSilent | "trace";
  /** Force pino-pretty on/off (tests for development branch). */
  pretty?: boolean;
}

/**
 * Build a pino logger configured per the contract.
 *
 * Exported (not just module-singleton) so tests can construct loggers bound
 * to in-memory sinks. Production callers use the `logger` singleton below.
 */
export function createLogger(opts: LoggerOpts = {}): Logger {
  const nodeEnv = env.NODE_ENV;

  const defaultLevel: pino.LevelWithSilent =
    nodeEnv === "development" ? "debug" : "info";
  const level = opts.minLevel ?? defaultLevel;

  // Pretty-mode resolution: explicit override wins, else dev→pretty.
  const wantPretty = opts.pretty ?? nodeEnv === "development";

  const baseConfig: pino.LoggerOptions = {
    level,
    redact: {
      paths: [...REDACT_PATHS],
      censor: "[REDACTED]",
      remove: false,
    },
    timestamp: isoTimestamp,
    formatters: {
      level: levelLabeler,
    },
  };

  // Test env: info/debug silenced. We achieve this by raising the level to
  // "error" so only error+ reaches the sink — but production code that calls
  // log.error() still has its record captured for assertions.
  if (nodeEnv === "test" && opts.minLevel === undefined) {
    baseConfig.level = "error";
  }

  // Pretty mode: route through pino-pretty as a SyncWriteExit (terminal) for
  // dev; tests pass pretty:true with an in-memory stream to verify the
  // formatter engaged.
  if (wantPretty) {
    // Lazy import so production builds don't pay for pino-pretty.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pretty = require("pino-pretty");
    const prettyStream = pretty({
      colorize: true,
      destination: opts.stream ?? process.stdout,
      singleLine: false,
    });
    return pino(baseConfig, prettyStream);
  }

  return pino(baseConfig, opts.stream as NodeJS.WritableStream);
}

/**
 * Production/dev singleton. Tests construct their own via createLogger()
 * with in-memory sinks — never read this singleton in tests.
 */
export const logger: Logger = createLogger();

/**
 * Helper for code that needs to attach the current requestId without
 * importing request-context directly (avoids a few circular-import edges).
 * Returns the structured bindings object; merge via logger.child() or
 * inline in the log payload.
 */
export function currentRequestBindings(): {
  requestId: string | null;
  userId: string | null;
} {
  // Lazy import to avoid logger ↔ request-context cycle at module load.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getRequestContext } = require("@/lib/request-context") as {
    getRequestContext: () => { requestId: string; userId: string | null } | null;
  };
  const ctx = getRequestContext();
  return {
    requestId: ctx?.requestId ?? null,
    userId: ctx?.userId ?? null,
  };
}

// StreamEntry is referenced for type-completeness; ensure import is used.
export type { StreamEntry };
