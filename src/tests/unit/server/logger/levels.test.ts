import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";

/**
 * T006: level routing + format / destination switching per NODE_ENV (FR-002, FR-011, SC-006).
 *
 * Per research.md R6, logger behaviour is derived from NODE_ENV alone (no
 * LOG_LEVEL env). We exercise each of the three branches:
 *   - development → debug level, pino-pretty colorized
 *   - production  → info level, JSON lines
 *   - test        → info/debug silenced (error still emitted for assertion capture)
 *
 * Strategy: vi.mock("@/lib/env") so we can mutate the derived NODE_ENV per
 * branch. Each branch sets envState.NODE_ENV before importing the helper
 * (which in turn imports createLogger).
 */

const envState = vi.hoisted(() => ({ NODE_ENV: "test" as string }));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

// Mock request-context to avoid the lazy require() inside logger.ts
// falling over during module reload.
vi.mock("@/lib/request-context", () => ({
  getRequestContext: () => null,
  setUserId: () => {},
}));

describe("logger levels — NODE_ENV switching (FR-002, FR-011, SC-006)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    envState.NODE_ENV = "test";
  });

  it("silences info/debug in test env (FR-011)", async () => {
    envState.NODE_ENV = "test";
    const { createLoggerForTest } = await import("./_env-helpers");
    const { log, sink } = createLoggerForTest();

    log.info({ path: "x.create" }, "info-should-be-silent");
    log.debug({ path: "x.create" }, "debug-should-be-silent");
    log.error({ path: "x.create", code: "INTERNAL_SERVER_ERROR" }, "error-still-emitted");

    const joined = sink.lines.join("\n");
    // info/debug suppressed
    expect(joined).not.toContain("info-should-be-silent");
    expect(joined).not.toContain("debug-should-be-silent");
    // error still emitted so tests can assert on failure paths
    expect(joined).toContain("error-still-emitted");
  });

  it("emits info+ in production as JSON lines", async () => {
    envState.NODE_ENV = "production";
    const { createLoggerForTest } = await import("./_env-helpers");
    const { log, sink } = createLoggerForTest();

    log.info({ path: "x.create", requestId: "r1" }, "hi");
    log.debug({ path: "x.create" }, "debug-suppressed-in-prod");

    // JSON-line shape: each emitted line parses as a JSON object
    const emitted = sink.lines.filter((l) => l.trim().startsWith("{"));
    expect(emitted.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(emitted[0]!);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hi");
    expect(parsed.path).toBe("x.create");
    expect(parsed.requestId).toBe("r1");
    // debug NOT emitted in prod
    expect(sink.lines.join("\n")).not.toContain("debug-suppressed-in-prod");
  });

  it("emits debug+ in development and applies pino-pretty colorization", async () => {
    envState.NODE_ENV = "development";
    const { createLoggerForTest } = await import("./_env-helpers");
    const { log, sink } = createLoggerForTest();

    log.debug({ path: "x.create" }, "dev-debug-visible");
    log.info({ path: "x.create" }, "dev-info-visible");

    const joined = sink.lines.join("\n");
    expect(joined).toContain("dev-debug-visible");
    expect(joined).toContain("dev-info-visible");
    // pino-pretty colorizes with ANSI escapes (e.g. ESC [ ...)
    // presence of any ESC sequence confirms pretty mode engaged.
    // eslint-disable-next-line no-control-regex
    expect(/\u001b\[/.test(joined)).toBe(true);
  });
});
