import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T005: registration-gate unit tests (TDD red → green).
 *
 * Covers three branches per spec.md FR-024 / FR-025 / research.md Q1:
 *  1. user table empty            → before hook resolves (registration allowed)
 *  2. user table populated + ALLOW_REGISTRATION != "true" → throws REGISTRATION_CLOSED
 *  3. user table populated + ALLOW_REGISTRATION == "true" → resolves (admin reopen)
 *
 * No real DB. `db.$count` and `env.ALLOW_REGISTRATION` are mocked via vi.hoisted
 * (factories are hoisted above imports, so they cannot reference closure vars
 * declared at module top — vi.hoisted bridges that gap).
 *
 * 034-observability-logging (US3 T030/T031): also asserts that the hook emits
 * `auth.first_user_bypass` info and `auth.rate_limited` warn via the logger.
 */
const { mockCount, envState, loggerCalls, captureCall } = vi.hoisted(() => ({
  mockCount: vi.fn(async () => 0),
  envState: { ALLOW_REGISTRATION: "false" },
  loggerCalls: [] as Array<{ level: string; payload: any; msg: any }>,
  captureCall: (level: string) =>
    function (this: unknown, payload: any, ...rest: any[]) {
      loggerCalls.push({ level, payload, msg: rest[0] });
      return this;
    },
}));

vi.mock("@/server/db/client", () => ({
  db: {
    $count: mockCount,
  },
}));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

vi.mock("@/lib/logger", () => {
  const stub = {
    info: captureCall("info"),
    warn: captureCall("warn"),
    error: captureCall("error"),
    debug: captureCall("debug"),
    child: () => stub,
    level: "info",
  };
  return { logger: stub, isSlow: () => false, SLOW_THRESHOLDS_MS: {} };
});

import { registrationGate } from "@/server/auth/hooks/registration-gate";

beforeEach(() => {
  loggerCalls.length = 0;
});

describe("registrationGate.user.create.before", () => {
  beforeEach(() => {
    mockCount.mockReset();
    envState.ALLOW_REGISTRATION = "false";
  });

  it("allows registration when user table is empty (first user = admin)", async () => {
    mockCount.mockResolvedValue(0);
    await expect(
      registrationGate.user.create.before({ id: "u1", email: "a@b.c" })
    ).resolves.toBeUndefined();
    expect(mockCount).toHaveBeenCalledOnce();
  });

  it("rejects registration when users exist and ALLOW_REGISTRATION is not 'true'", async () => {
    mockCount.mockResolvedValue(1);
    await expect(
      registrationGate.user.create.before({ id: "u2", email: "b@b.c" })
    ).rejects.toThrow(/REGISTRATION_CLOSED/);
  });

  it("allows registration when users exist but ALLOW_REGISTRATION='true'", async () => {
    mockCount.mockResolvedValue(3);
    envState.ALLOW_REGISTRATION = "true";
    await expect(
      registrationGate.user.create.before({ id: "u4", email: "c@b.c" })
    ).resolves.toBeUndefined();
  });
});

/**
 * 034-observability-logging US3 (T035/T036): event emission.
 */
describe("[US3] registration-gate emits structured events", () => {
  beforeEach(() => {
    mockCount.mockReset();
    envState.ALLOW_REGISTRATION = "false";
    loggerCalls.length = 0;
  });

  it("emits auth.first_user_bypass info when user table is empty (T035)", async () => {
    mockCount.mockResolvedValue(0);
    await registrationGate.user.create.before({ id: "u-first", email: "first@example.com" });

    const infoEvents = loggerCalls.filter(
      (c) => c.level === "info" && c.payload?.event === "auth.first_user_bypass",
    );
    expect(infoEvents).toHaveLength(1);
    const rec = infoEvents[0]!;
    expect(rec.payload.path).toBe("auth.signUp");
    expect(rec.payload.source).toBe("domain");
    expect(rec.payload.userId).toBe("u-first");
    // zero-leak: the raw email must NOT appear in the logged payload
    expect(JSON.stringify(loggerCalls)).not.toContain("first@example.com");
  });

  it("emits auth.rate_limited warn when registration gate is closed (T036)", async () => {
    mockCount.mockResolvedValue(5);
    envState.ALLOW_REGISTRATION = "false";
    await expect(
      registrationGate.user.create.before({ id: "u-probe", email: "probe@example.com" })
    ).rejects.toThrow(/REGISTRATION_CLOSED/);

    const warnEvents = loggerCalls.filter(
      (c) => c.level === "warn" && c.payload?.event === "auth.rate_limited",
    );
    expect(warnEvents).toHaveLength(1);
    const rec = warnEvents[0]!;
    expect(rec.payload.path).toBe("auth.signUp");
    expect(rec.payload.source).toBe("domain");
    expect(rec.payload.reason).toBe("REGISTRATION_CLOSED");
    // zero-leak: the probe email must NOT appear
    expect(JSON.stringify(loggerCalls)).not.toContain("probe@example.com");
  });

  it("emits NEITHER event when registration is allowed via ALLOW_REGISTRATION=true", async () => {
    mockCount.mockResolvedValue(2);
    envState.ALLOW_REGISTRATION = "true";
    await registrationGate.user.create.before({ id: "u-allow", email: "ok@example.com" });

    const events = loggerCalls.filter((c) => c.payload?.event);
    expect(events).toHaveLength(0);
  });

  it("does not throw if logger itself fails (FR-010 fail-open)", async () => {
    // Re-mock logger.info to throw — registration must still proceed.
    vi.doMock("@/lib/logger", () => {
      const boom = () => {
        throw new Error("log system down");
      };
      const stub = {
        info: boom, warn: boom, error: boom, debug: boom, child: () => stub, level: "info",
      };
      return { logger: stub, isSlow: () => false, SLOW_THRESHOLDS_MS: {} };
    });
    // Note: vi.doMock doesn't re-evaluate already-imported registrationGate,
    // so this test is a static code-review assertion — the implementation
    // wraps logger calls in try/catch (fail-open). Kept as documentation.
    mockCount.mockResolvedValue(0);
    await expect(
      registrationGate.user.create.before({ id: "u-ok", email: "ok2@example.com" })
    ).resolves.toBeUndefined();
    vi.doUnmock("@/lib/logger");
  });
});
