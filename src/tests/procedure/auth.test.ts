/**
 * T028-T031 + T043-T045 + T055-T056 + T060-T062: tRPC procedure contract tests
 * for the auth router.
 *
 * These tests run WITHOUT a database — Better-Auth's `auth.api` is mocked via
 * `vi.mock`. Real DB integration tests live under `src/tests/integration/`.
 *
 * Coverage:
 *   - register: 201 / 400 (validation) / 409 (duplicate) / 429 (rate limit)
 *   - login:    200 / 401 (generic) / 423 (locked)
 *   - logout:   200 / 200 idempotent
 *   - me:       200 / 401 (no/expired session)
 *   - auditEvents: 200 / 401 / shape (no password/token in payload)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Mock Better-Auth before any imports that touch it.
 * Tests override individual methods per test case.
 */
vi.mock("@/server/auth/config", () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      signInEmail: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

/**
 * Mock DB-layer query modules so procedure tests don't need a real DB.
 * Real DB integration tests live under src/tests/integration/.
 */
vi.mock("@/server/db/queries/family-member", () => ({
  loadFamilyAndMemberByUserId: vi.fn().mockResolvedValue({
    family: { id: "fam_test", name: "我的家庭" },
    member: { id: "mem_test", displayName: "alice" },
  }),
}));

vi.mock("@/server/db/queries/auth-events", () => ({
  findRecentAuthEventsByEmail: vi.fn().mockResolvedValue([
    {
      eventType: "login_success",
      outcome: "success",
      occurredAt: new Date(),
      metadata: {},
    },
  ]),
}));

vi.mock("@/server/auth/hooks/audit", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Mock lockout hooks so contract tests don't need DB.
 * Default: allow all logins. Per-test override via mockRejectedValueOnce.
 */
vi.mock("@/server/auth/hooks/lockout", () => ({
  checkLockoutByEmail: vi.fn().mockResolvedValue({ status: "allowed" }),
  recordLoginFailure: vi
    .fn()
    .mockResolvedValue({ triggeredLockout: false }),
  clearLoginFailures: vi.fn().mockResolvedValue(undefined),
}));

import { auth } from "@/server/auth/config";
import { createCaller } from "@/lib/trpc/server";
import { checkLockoutByEmail } from "@/server/auth/hooks/lockout";

const mockedCheckLockout = vi.mocked(checkLockoutByEmail);

type MockFn = ReturnType<typeof vi.fn>;

const mockedAuthApi = auth.api as unknown as {
  signUpEmail: MockFn;
  signInEmail: MockFn;
  signOut: MockFn;
  getSession: MockFn;
};

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Build a caller with NO session (public).
 */
function publicCaller() {
  return createCaller({ session: null });
}

/**
 * Build a caller with a fake session (for testing protected procedures).
 */
function authedCaller(overrides: Partial<{
  user: { id: string; email: string };
  session: { id: string; userId: string };
}> = {}) {
  return createCaller({
    session: {
      user: {
        id: "u_test",
        email: "alice@example.com",
        emailVerified: false,
        name: "alice",
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides.user,
      },
      session: {
        id: "s_test",
        userId: "u_test",
        token: "tok_test",
        expiresAt: new Date(Date.now() + 86_400_000),
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides.session,
      },
    },
  });
}


// T060-T062: auth.me + auth.auditEvents contract tests
// ============================================================================

describe("[T060-T062] auth.me + auth.auditEvents", () => {
  it("T060: me returns null when not authed", async () => {
    const caller = publicCaller();
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("T061: auditEvents requires session (protectedProcedure)", async () => {
    const caller = publicCaller();
    await expect(caller.auth.auditEvents()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("T062: auditEvents shape has no password/token fields", async () => {
    const caller = authedCaller();
    const result = await caller.auth.auditEvents();
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/password/i);
    expect(json).not.toMatch(/token/i);
  });
});
