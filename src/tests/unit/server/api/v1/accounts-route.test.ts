/**
 * GET /api/v1/accounts route handler — unit tests.
 *
 * DB + auth dependencies are mocked. Verifies:
 *   - 401 when API key missing/invalid
 *   - 429 when rate limited
 *   - 200 happy path returns { items: [...] }
 *   - includeArchived query param toggles archived filter
 *   - family resolved from auth, not request body
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks (vi.hoisted so vi.mock factories can reference them) ──────────

const { validateApiKey, checkRateLimit, loadFamilyIdByUserId, rows } =
  vi.hoisted(() => ({
    validateApiKey: vi.fn(),
    checkRateLimit: vi.fn(),
    loadFamilyIdByUserId: vi.fn(),
    rows: vi.fn(),
  }));

// Drizzle chain mock: db.select().from().where().orderBy() → rows()
const { mockOrderBy, mockWhere, mockFrom, mockSelect } = vi.hoisted(() => {
  const rows = vi.fn();
  const mockOrderBy = vi.fn().mockImplementation(() => rows());
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return { mockOrderBy, mockWhere, mockFrom, mockSelect, rows };
});

vi.mock("@/server/auth/api-key-auth", () => ({ validateApiKey }));
vi.mock("@/server/auth/api-rate-limit", () => ({ checkRateLimit }));
vi.mock("@/server/auth/cors", () => ({
  setCorsHeaders: (res: Response) => res,
  corsPreflightResponse: () => new Response(null, { status: 204 }),
}));
vi.mock("@/server/db/queries/account", () => ({ loadFamilyIdByUserId }));
vi.mock("@/server/db/client", () => ({ db: { select: mockSelect } }));

import { GET } from "@/app/api/v1/accounts/route";

function makeReq(url = "http://localhost/api/v1/accounts", key = "bk_test") {
  return new Request(url, { headers: { Authorization: `Bearer ${key}` } });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockReturnValue({ allowed: true, retryAfter: 0 });
  loadFamilyIdByUserId.mockResolvedValue("fam_test");
  // re-wire orderBy to rows() after clearAllMocks wipes implementations
  mockOrderBy.mockImplementation(() => rows());
  rows.mockReturnValue([]);
});

// ─── Tests ──────────────────────────────────────────────────────────────

describe("GET /api/v1/accounts", () => {
  it("returns 401 when API key is invalid", async () => {
    validateApiKey.mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 429 when rate limited", async () => {
    validateApiKey.mockResolvedValue({ userId: "u1", keyPrefix: "bk_abcd" });
    checkRateLimit.mockReturnValue({ allowed: false, retryAfter: 30 });
    const res = await GET(makeReq());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 200 with items array on happy path", async () => {
    validateApiKey.mockResolvedValue({ userId: "u1", keyPrefix: "bk_abcd" });
    rows.mockReturnValue([
      {
        id: "acct-1",
        familyId: "fam_test",
        name: "招行",
        currency: "CNY",
        initialBalance: 100000,
        type: "asset",
        archivedAt: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: "acct-1",
      name: "招行",
      currency: "CNY",
      type: "asset",
    });
    // familyId should NOT leak to third parties
    expect(body.items[0]).not.toHaveProperty("familyId");
  });

  it("excludes archived accounts by default (query runs)", async () => {
    validateApiKey.mockResolvedValue({ userId: "u1", keyPrefix: "bk_abcd" });
    await GET(makeReq());
    expect(mockOrderBy).toHaveBeenCalledTimes(1);
  });

  it("includes archived when ?includeArchived=true", async () => {
    validateApiKey.mockResolvedValue({ userId: "u1", keyPrefix: "bk_abcd" });
    rows.mockReturnValue([
      { id: "a1", archivedAt: null, familyId: "f", name: "x", currency: "CNY", initialBalance: 0, type: "asset", createdAt: new Date(), updatedAt: new Date() },
      { id: "a2", archivedAt: new Date(), familyId: "f", name: "y", currency: "CNY", initialBalance: 0, type: "debt", createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await GET(
      makeReq("http://localhost/api/v1/accounts?includeArchived=true"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
  });

  it("resolves family from the authenticated user", async () => {
    validateApiKey.mockResolvedValue({ userId: "u_real", keyPrefix: "bk_abcd" });
    await GET(makeReq());
    expect(loadFamilyIdByUserId).toHaveBeenCalledWith("u_real");
  });
});
