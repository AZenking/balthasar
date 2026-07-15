/**
 * GET /api/v1/categories route handler — unit tests.
 *
 * DB + auth dependencies are mocked. Verifies:
 *   - 401 when API key missing/invalid
 *   - 429 when rate limited
 *   - 400 when type is invalid
 *   - 200 happy path returns hierarchical { items }
 *   - type filter passed through to query
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks (vi.hoisted so vi.mock factories can reference them) ──────────

const { validateApiKey, checkRateLimit, loadFamilyIdByUserId, findAllCategories } =
  vi.hoisted(() => ({
    validateApiKey: vi.fn(),
    checkRateLimit: vi.fn(),
    loadFamilyIdByUserId: vi.fn(),
    findAllCategories: vi.fn(),
  }));

vi.mock("@/server/auth/api-key-auth", () => ({ validateApiKey }));
vi.mock("@/server/auth/api-rate-limit", () => ({ checkRateLimit }));
vi.mock("@/server/auth/cors", () => ({
  setCorsHeaders: (res: Response) => res,
  corsPreflightResponse: () => new Response(null, { status: 204 }),
}));
vi.mock("@/server/db/queries/account", () => ({ loadFamilyIdByUserId }));
vi.mock("@/server/db/queries/category", () => ({ findAllCategories }));
// buildCategoryTree stays real (pure function).

import { GET } from "@/app/api/v1/categories/route";

function makeReq(url = "http://localhost/api/v1/categories", key = "bk_test") {
  return new Request(url, { headers: { Authorization: `Bearer ${key}` } });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockReturnValue({ allowed: true, retryAfter: 0 });
  loadFamilyIdByUserId.mockResolvedValue("fam_test");
  findAllCategories.mockResolvedValue([]);
});

// ─── Tests ──────────────────────────────────────────────────────────────

describe("GET /api/v1/categories", () => {
  it("returns 401 when API key is invalid", async () => {
    validateApiKey.mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    validateApiKey.mockResolvedValue({ userId: "u1", keyPrefix: "bk_abcd" });
    checkRateLimit.mockReturnValue({ allowed: false, retryAfter: 12 });
    const res = await GET(makeReq());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
  });

  it("returns 400 when type is invalid", async () => {
    validateApiKey.mockResolvedValue({ userId: "u1", keyPrefix: "bk_abcd" });
    const res = await GET(
      makeReq("http://localhost/api/v1/categories?type=invalid"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts type=income and passes it to the query", async () => {
    validateApiKey.mockResolvedValue({ userId: "u1", keyPrefix: "bk_abcd" });
    findAllCategories.mockResolvedValue([
      { id: "c1", parentId: null, name: "工资", type: "income", icon: "wallet", sortOrder: 10, isBuiltIn: true, familyId: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await GET(
      makeReq("http://localhost/api/v1/categories?type=income"),
    );
    expect(res.status).toBe(200);
    expect(findAllCategories).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: "fam_test", type: "income" }),
    );
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it("builds hierarchical tree from flat list", async () => {
    validateApiKey.mockResolvedValue({ userId: "u1", keyPrefix: "bk_abcd" });
    findAllCategories.mockResolvedValue([
      { id: "root", parentId: null, name: "餐饮", type: "expense", icon: "utensils", sortOrder: 10, isBuiltIn: true, familyId: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "child", parentId: "root", name: "外卖", type: "expense", icon: "bike", sortOrder: 20, isBuiltIn: true, familyId: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].children).toHaveLength(1);
    expect(body.items[0].children[0].id).toBe("child");
  });

  it("defaults to excluding archived", async () => {
    validateApiKey.mockResolvedValue({ userId: "u1", keyPrefix: "bk_abcd" });
    await GET(makeReq());
    expect(findAllCategories).toHaveBeenCalledWith(
      expect.objectContaining({ includeArchived: false }),
    );
  });

  it("includes archived when ?includeArchived=true", async () => {
    validateApiKey.mockResolvedValue({ userId: "u1", keyPrefix: "bk_abcd" });
    await GET(
      makeReq("http://localhost/api/v1/categories?includeArchived=true"),
    );
    expect(findAllCategories).toHaveBeenCalledWith(
      expect.objectContaining({ includeArchived: true }),
    );
  });
});
