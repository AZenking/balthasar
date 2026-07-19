/**
 * T008-T009 + T018-T019 + T026-T027 + T032: tRPC procedure contract tests
 * for transaction router (004-transaction).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * US1 log capture: replace the logger module with vi.fn stubs BEFORE the
 * tRPC router imports the singleton. Pino's level methods are dynamically
 * generated (their internal name is "LOG"), which defeats vi.spyOn — a
 * module-level vi.mock is the reliable approach.
 *
 * `loggerCalls` accumulates every (method, payload, msg) the timingMiddleware
 * emits so tests can assert FR-001 / FR-005 / FR-006 invariants.
 *
 * vi.hoisted bridges the hoisting gap: the vi.mock factory runs above all
 * top-level declarations, so closure vars must themselves be hoisted.
 *
 * Declared FIRST (before other vi.mock calls) so trpc.ts — which imports
 * the logger singleton at module load — binds to our stub.
 */
const { loggerCalls, captureCall } = vi.hoisted(() => {
  const calls: Array<{ level: string; payload: any; msg: any }> = [];
  const capture = (level: string) =>
    function (this: unknown, payload: any, ...rest: any[]) {
      calls.push({ level, payload, msg: rest[0] });
      return this;
    };
  return { loggerCalls: calls, captureCall: capture };
});

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

vi.mock("@/server/db/queries/account", () => ({
  loadFamilyIdByUserId: vi.fn().mockResolvedValue("fam_test"),
  loadFamilyAndMemberIdsByUserId: vi
    .fn()
    .mockResolvedValue({ familyId: "fam_test", memberId: "mem_test" }),
}));

vi.mock("@/server/db/queries/transaction", () => ({
  validateAccountAndCategory: vi.fn().mockResolvedValue(undefined),
  insertTransaction: vi.fn(),
  getTransactionById: vi.fn(),
  listTransactions: vi.fn(),
  findTransactionForUpdate: vi.fn(),
  serializeTransaction: vi.fn((r) => ({ ...r, amount: Math.abs(r.amount) })),
}));

vi.mock("@/server/db/queries/transaction-events", () => ({
  writeTransactionEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock withTransaction so the create happy path doesn't try to hit a real DB
// (only the US1 log-assertion test exercises this path; existing contract
// tests fail-fast on validation BEFORE reaching withTransaction).
vi.mock("@/server/db/client", () => ({
  db: {},
  withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
}));

import { createCaller } from "@/lib/trpc/server";
import { logger } from "@/lib/logger";

function publicCaller() {
  return createCaller({ session: null });
}

function authedCaller() {
  return createCaller({
    session: {
      user: {
        id: "u_test", email: "test@example.com", emailVerified: false,
        name: "test", image: null, createdAt: new Date(), updatedAt: new Date(),
      },
      session: {
        id: "s_test", userId: "u_test", token: "tok_test",
        expiresAt: new Date(Date.now() + 86_400_000), ipAddress: null,
        userAgent: null, createdAt: new Date(), updatedAt: new Date(),
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  loggerCalls.length = 0;
});

describe("[T008-T009] transaction.create", () => {
  it("T008: requires authed session", async () => {
    const c = publicCaller();
    await expect(
      c.transaction.create({
        type: "expense", accountId: "00000000-0000-7000-8000-000000000001",
        categoryId: "00000000-0000-5000-8000-000000000001", amount: 100,
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("T009: rejects amount ≤ 0", async () => {
    const c = authedCaller();
    await expect(
      c.transaction.create({
        type: "expense", accountId: "00000000-0000-7000-8000-000000000001",
        categoryId: "00000000-0000-5000-8000-000000000001", amount: 0,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("T009: rejects non-integer amount", async () => {
    const c = authedCaller();
    await expect(
      c.transaction.create({
        type: "expense", accountId: "00000000-0000-7000-8000-000000000001",
        categoryId: "00000000-0000-5000-8000-000000000001", amount: 10.5,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("T009: rejects invalid type", async () => {
    const c = authedCaller();
    await expect(
      c.transaction.create({
        type: "transfer" as any, accountId: "00000000-0000-7000-8000-000000000001",
        categoryId: "00000000-0000-5000-8000-000000000001", amount: 100,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("[T018-T019] transaction.get / list", () => {
  it("T018: get requires auth", async () => {
    const c = publicCaller();
    await expect(
      c.transaction.get({ id: "00000000-0000-7000-8000-000000000001" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("T019: list requires auth", async () => {
    const c = publicCaller();
    await expect(c.transaction.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",    });
  });
});

describe("[T026-T027] transaction.update", () => {
  it("T026: requires auth", async () => {
    const c = publicCaller();
    await expect(
      c.transaction.update({ id: "00000000-0000-7000-8000-000000000001", remark: "x" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("T027: rejects empty update (no fields to change)", async () => {
    const c = authedCaller();
    await expect(
      c.transaction.update({ id: "00000000-0000-7000-8000-000000000001" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("[T032] transaction.delete", () => {
  it("requires auth", async () => {
    const c = publicCaller();
    await expect(
      c.transaction.delete({ id: "00000000-0000-7000-8000-000000000001" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

/**
 * US1 (034-observability-logging): structured log assertions.
 *
 * The timingMiddleware (src/server/api/trpc.ts) emits one log record per
 * procedure call: info on success, warn if slow (>=300ms for transaction.*),
 * error on failure. requestId is pulled from AsyncLocalStorage, null outside
 * HTTP scope (procedure tests don't wrap in startRequestContext).
 *
 * Strategy: vi.spyOn the logger singleton's level methods. Each call records
 * the payload object so we can assert FR-001 / FR-005 / FR-006 invariants.
 */
describe("[US1 T016] transaction.create structured logging", () => {
  it("logs error with code when create fails (BAD_REQUEST)", async () => {
    const c = authedCaller();
    await expect(
      c.transaction.create({
        type: "expense", accountId: "00000000-0000-7000-8000-000000000001",
        categoryId: "00000000-0000-5000-8000-000000000001", amount: 0,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const errorCalls = loggerCalls.filter((c) => c.level === "error");
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    const { payload, msg } = errorCalls[0]!;
    expect(payload.path).toBe("transaction.create");
    expect(payload.type).toBe("mutation");
    expect(payload.code).toBe("BAD_REQUEST");
    expect(payload.source).toBe("trpc");
    expect(payload).toHaveProperty("durationMs");
    expect(payload).toHaveProperty("requestId");
    expect(msg).toBe("request failed");
    // info NOT emitted on the failure path for the same path
    const infoForPath = loggerCalls.filter(
      (c) => c.level === "info" && c.payload?.path === "transaction.create",
    );
    expect(infoForPath).toHaveLength(0);
  });

  it("logs error with UNAUTHORIZED code when no session", async () => {
    const c = publicCaller();
    await expect(
      c.transaction.create({
        type: "expense", accountId: "00000000-0000-7000-8000-000000000001",
        categoryId: "00000000-0000-5000-8000-000000000001", amount: 100,
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const errorCalls = loggerCalls.filter((c) => c.level === "error");
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    const { payload } = errorCalls.find(
      (c) => c.payload?.path === "transaction.create",
    )!;
    expect(payload.code).toBe("UNAUTHORIZED");
    expect(payload.path).toBe("transaction.create");
  });

  it("logs info on successful create with path / type / requestId / userId", async () => {
    // Wire the mocked insert to resolve so create succeeds.
    const { insertTransaction, getTransactionById } = await import(
      "@/server/db/queries/transaction"
    );
    const created = {
      id: "00000000-0000-7000-8000-000000000099",
      familyId: "fam_test", memberId: "mem_test",
      accountId: "00000000-0000-7000-8000-000000000001",
      categoryId: "00000000-0000-5000-8000-000000000001",
      type: "expense", amount: -100, remark: null,
      occurredAt: new Date("2026-07-19"), clientRequestId: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    (insertTransaction as any).mockResolvedValueOnce(created);
    (getTransactionById as any).mockResolvedValueOnce(created);

    const c = authedCaller();
    const result = await c.transaction.create({
      type: "expense", accountId: "00000000-0000-7000-8000-000000000001",
      categoryId: "00000000-0000-5000-8000-000000000001", amount: 100,
    });

    expect(result).toBeTruthy();
    const infoCalls = loggerCalls.filter(
      (c) => c.level === "info" && c.payload?.path === "transaction.create",
    );
    expect(infoCalls).toHaveLength(1);
    const { payload, msg } = infoCalls[0]!;
    expect(payload.path).toBe("transaction.create");
    expect(payload.type).toBe("mutation");
    expect(payload.source).toBe("trpc");
    expect(payload).toHaveProperty("durationMs");
    expect(payload).toHaveProperty("requestId");
    expect(payload).toHaveProperty("userId");
    expect(msg).toBe("request complete");
  });
});

describe("[US1 T016] transaction.get/list/update/delete logging", () => {
  it("logs every procedure call with its path (smoke)", async () => {
    // Every procedure goes through timingMiddleware, so each call emits
    // at least one log record. This smoke-asserts the wiring without
    // duplicating per-procedure happy paths.
    const cUnauth = publicCaller();
    await expect(
      cUnauth.transaction.get({ id: "00000000-0000-7000-8000-000000000001" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const paths = loggerCalls
      .filter((c) => c.level === "error")
      .map((c) => c.payload?.path);
    expect(paths).toContain("transaction.get");
  });
});

/**
 * US2 (T025): durationMs accuracy. Every log record must carry a positive
 * integer durationMs that is plausible (>= 0, small for mocked calls).
 */
describe("[US2 T025] durationMs accuracy in log records", () => {
  it("durationMs is a non-negative integer", async () => {
    const c = publicCaller();
    await expect(
      c.transaction.get({ id: "00000000-0000-7000-8000-000000000001" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const rec = loggerCalls.find((c) => c.level === "error");
    expect(rec).toBeTruthy();
    expect(typeof rec!.payload.durationMs).toBe("number");
    expect(Number.isInteger(rec!.payload.durationMs)).toBe(true);
    expect(rec!.payload.durationMs).toBeGreaterThanOrEqual(0);
    // mocked calls resolve in < 50ms — sanity upper bound
    expect(rec!.payload.durationMs).toBeLessThan(1000);
  });
});
