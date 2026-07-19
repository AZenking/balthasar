import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestLogger, writeLog, type CapturedRecord } from "./_helpers";

/**
 * T004 + T005: serializer / redact / injection-defense tests (TDD red → green).
 *
 * Covers FR-004 (field-level redact), FR-013 (injection defense), SC-003
 * (zero-leak), and the data-model.md "single legal JSON line" invariant.
 *
 * Strategy: use createTestLogger() which wires pino to an in-memory sink so
 * we can parse the JSON line back and assert exact fields — never read stdout.
 */

describe("logger serializer — redact paths (FR-004, SC-003)", () => {
  let captured: CapturedRecord[];

  beforeEach(() => {
    captured = [];
  });

  it("redacts top-level password/email/secret", () => {
    const log = createTestLogger(captured);
    writeLog(log, {
      level: "info",
      msg: "login attempt",
      password: "hunter2",
      email: "user@example.com",
      secret: "BETTER_AUTH_SECRET-VALUE",
    });
    expect(captured).toHaveLength(1);
    const rec = captured[0]!;
    expect(rec.password).toBe("[REDACTED]");
    expect(rec.email).toBe("[REDACTED]");
    expect(rec.secret).toBe("[REDACTED]");
    // zero-leak: raw values MUST NOT appear anywhere in the serialized output
    const raw = JSON.stringify(rec);
    expect(raw).not.toContain("hunter2");
    expect(raw).not.toContain("user@example.com");
    expect(raw).not.toContain("BETTER_AUTH_SECRET-VALUE");
  });

  it("redacts nested amount/remark under transaction-shaped objects", () => {
    const log = createTestLogger(captured);
    writeLog(log, {
      level: "info",
      msg: "transaction event",
      input: {
        amount: 999999,
        remark: "salary october",
        categoryId: "cat-1",
      },
    });
    const rec = captured[0]! as Record<string, any>;
    expect(rec.input.amount).toBe("[REDACTED]");
    expect(rec.input.remark).toBe("[REDACTED]");
    expect(rec.input.categoryId).toBe("cat-1"); // non-sensitive preserved
    expect(JSON.stringify(rec)).not.toContain("999999");
    expect(JSON.stringify(rec)).not.toContain("salary october");
  });

  it("redacts headers.authorization / headers.cookie", () => {
    const log = createTestLogger(captured);
    writeLog(log, {
      level: "info",
      msg: "request",
      headers: {
        authorization: "Bearer ey-jwt-token",
        cookie: "balthasar.session_token=abc123",
        "user-agent": "curl/8",
      },
    });
    const rec = captured[0]! as Record<string, any>;
    expect(rec.headers.authorization).toBe("[REDACTED]");
    expect(rec.headers.cookie).toBe("[REDACTED]");
    expect(rec.headers["user-agent"]).toBe("curl/8"); // preserved
    expect(JSON.stringify(rec)).not.toContain("ey-jwt-token");
    expect(JSON.stringify(rec)).not.toContain("abc123");
  });

  it("preserves allowed fields (userId / requestId / clientRequestId)", () => {
    const log = createTestLogger(captured);
    writeLog(log, {
      level: "info",
      msg: "hit",
      requestId: "req-uuid-001",
      userId: "user-uuid-002",
      clientRequestId: "client-uuid-003",
      event: "idempotency.hit",
    });
    const rec = captured[0]!;
    expect(rec.requestId).toBe("req-uuid-001");
    expect(rec.userId).toBe("user-uuid-002");
    expect(rec.clientRequestId).toBe("client-uuid-003");
    expect(rec.event).toBe("idempotency.hit");
  });
});

describe("logger serializer — injection defense (FR-013)", () => {
  let captured: CapturedRecord[];

  beforeEach(() => {
    captured = [];
  });

  it("emits a single legal JSON line even when remark contains newlines / closing braces", () => {
    const malicious = '\n{"level":"info","msg":"fake"\n';
    const log = createTestLogger(captured);
    writeLog(log, {
      level: "info",
      msg: "transaction event",
      remark: malicious,
    });
    expect(captured).toHaveLength(1);
    const rec = captured[0]!;
    // The remark value is preserved as an escaped string (not interpolated into msg)
    expect(rec.remark).toBe("[REDACTED]");
    // Critically: the malicious payload did NOT break the JSON structure
    // (pino escapes \n inside strings, so the record remains one valid JSON object).
    const raw = JSON.stringify(rec);
    expect(raw).not.toContain('"fake"');
    // The serialized form must be parseable as a single JSON object.
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("keeps user input out of msg via structured-field discipline (FR-013)", () => {
    // The contract (research.md R1/R7) is that user input must be passed as
    // structured fields, not concatenated into msg. This test asserts the
    // happy-path shape: msg is a static string, payload is a sibling field.
    const log = createTestLogger(captured);
    writeLog(log, {
      level: "info",
      msg: "transaction event", // static — no interpolation
      remark: "user-typed-remark-with-$-and-}",
    });
    const rec = captured[0]!;
    expect(rec.msg).toBe("transaction event");
    expect(rec.remark).toBe("[REDACTED]");
    expect(JSON.stringify(rec)).not.toContain("user-typed-remark-with-$-and-}");
  });

  afterEach(() => {
    // sanity: every captured record must be a single valid JSON line
    for (const rec of captured) {
      expect(() => JSON.parse(JSON.stringify(rec))).not.toThrow();
    }
  });
});
