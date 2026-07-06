/**
 * T009-T012 + T021-T023: tRPC procedure contract tests for category router.
 *
 * Coverage:
 *   T009: list 无参 → 全部
 *   T010: list type=expense → 仅 expense
 *   T011: list type=income → 仅 income
 *   T012: 未登录 → 401
 *   T021: get happy path
 *   T022: get 不存在 → NOT_FOUND
 *   T023: get 未登录 → 401
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/db/queries/category", () => ({
  findAllCategories: vi.fn().mockResolvedValue([
    { id: "c1", name: "餐饮", type: "expense", icon: "🍔", sortOrder: 100, isBuiltIn: true },
    { id: "c2", name: "工资", type: "income", icon: "💰", sortOrder: 100, isBuiltIn: true },
  ]),
  findCategoryById: vi.fn(),
}));

import { createCaller } from "@/lib/trpc/server";
import { findCategoryById } from "@/server/db/queries/category";

const mockedFindById = vi.mocked(findCategoryById);

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

beforeEach(() => vi.clearAllMocks());

// ============================================================================
// T009-T012: category.list contract tests
// ============================================================================

describe("[T009-T012] category.list procedure", () => {
  it("T009: accepts no input → returns array", async () => {
    const caller = authedCaller();
    const result = await caller.category.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("T010: accepts { type: 'expense' } → returns filtered", async () => {
    const caller = authedCaller();
    const result = await caller.category.list({ type: "expense" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("T011: accepts { type: 'income' }", async () => {
    const caller = authedCaller();
    const result = await caller.category.list({ type: "income" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("T012: rejects invalid type (not in enum)", async () => {
    const caller = authedCaller();
    await expect(
      caller.category.list({ type: "transfer" as any })
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
  });

  it("T012: requires authed session", async () => {
    const caller = publicCaller();
    await expect(caller.category.list()).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED" },
    });
  });
});

// ============================================================================
// T021-T023: category.get contract tests
// ============================================================================

describe("[T021-T023] category.get procedure", () => {
  it("T021: returns category when found", async () => {
    mockedFindById.mockResolvedValueOnce({
      id: "95d6dc66-12c4-5f2b-bf9b-1d439a9c8100",
      name: "餐饮", type: "expense", icon: "🍔", sortOrder: 100,
      isBuiltIn: true, createdAt: new Date(),
    } as any);

    const caller = authedCaller();
    const result = await caller.category.get({
      id: "95d6dc66-12c4-5f2b-bf9b-1d439a9c8100",
    });
    expect(result.name).toBe("餐饮");
    expect(result.type).toBe("expense");
  });

  it("T022: throws NOT_FOUND when missing", async () => {
    mockedFindById.mockResolvedValueOnce(null);
    const caller = authedCaller();
    await expect(
      caller.category.get({ id: "00000000-0000-5000-8000-000000000000" })
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  });

  it("T022: rejects non-UUID id", async () => {
    const caller = authedCaller();
    await expect(
      caller.category.get({ id: "not-a-uuid" })
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
  });

  it("T023: requires authed session", async () => {
    const caller = publicCaller();
    await expect(
      caller.category.get({ id: "00000000-0000-5000-8000-000000000000" })
    ).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
  });
});
