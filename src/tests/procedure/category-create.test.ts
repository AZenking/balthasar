/**
 * T012: Procedure tests for category.create (018 US1).
 *
 * Coverage of spec US1 acceptance scenarios (11 total):
 *   1. Success expense顶级 (201, returns id/familyId/isBuiltIn=false/archivedAt=null)
 *   2. Success income顶级 (201)
 *   3. 409 same name + type + parent (顶级)
 *   4. 400 empty/whitespace name
 *   5. 400 name > 30 chars
 *   6. 400 invalid type
 *   7. 400 non-whitelist icon
 *   8. 201 success with valid parentId (二级)
 *   9. 400 parentId pointing to 二级 (3rd level)
 *   10. 400 parentId cross-family
 *   11. 401 unauth
 *
 * Tests mock queries (no DB). Integration test (T013) covers DB constraints.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/db/queries/account", () => ({
  loadFamilyAndMemberIdsByUserId: vi
    .fn()
    .mockResolvedValue({ familyId: "fam_test_1", memberId: "mem_test_1" }),
}));

vi.mock("@/server/db/queries/category", () => ({
  findAllCategories: vi.fn(),
  findAllCategoriesByParent: vi.fn(),
  findCategoryById: vi.fn(),
  countCustomCategoriesByFamily: vi.fn().mockResolvedValue(5),
  createCategory: vi.fn(),
}));

vi.mock("@/server/db/queries/category-events", () => ({
  writeCategoryEvent: vi.fn(),
  writeCategoryEventsBatch: vi.fn(),
}));

import { createCaller } from "@/lib/trpc/server";
import { createCategory, findCategoryById } from "@/server/db/queries/category";

const mockedCreate = vi.mocked(createCategory);
const mockedFindById = vi.mocked(findCategoryById);

function publicCaller() {
  return createCaller({ session: null });
}

function authedCaller() {
  return createCaller({
    session: {
      user: {
        id: "u_test",
        email: "test@example.com",
        emailVerified: false,
        name: "test",
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
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
      },
    },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("[US1] category.create procedure", () => {
  it("1. success: expense顶级 returns created row with familyId/isBuiltIn=false/archivedAt=null", async () => {
    mockedCreate.mockResolvedValueOnce({
      id: "c_new_1",
      name: "宠物用品",
      type: "expense",
      icon: "🐾",
      sortOrder: 100,
      isBuiltIn: false,
      familyId: "fam_test_1",
      parentId: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = authedCaller();
    const result = await caller.category.create({
      type: "expense",
      name: "宠物用品",
      icon: "🐾",
    });

    expect(result).toMatchObject({
      id: "c_new_1",
      name: "宠物用品",
      type: "expense",
      icon: "🐾",
      isBuiltIn: false,
      familyId: "fam_test_1",
      parentId: null,
      archivedAt: null,
    });
    expect(mockedCreate).toHaveBeenCalledOnce();
  });

  it("2. success: income顶级", async () => {
    mockedCreate.mockResolvedValueOnce({
      id: "c_new_2",
      name: "副业收入",
      type: "income",
      icon: "💻",
      sortOrder: 100,
      isBuiltIn: false,
      familyId: "fam_test_1",
      parentId: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = authedCaller();
    const result = await caller.category.create({
      type: "income",
      name: "副业收入",
      icon: "💻",
    });
    expect(result.type).toBe("income");
  });

  it("3. 409 conflict when same name+type+parent already exists", async () => {
    // createCategory throws TRPCError CONFLICT for duplicates
    const { TRPCError } = await import("@trpc/server");
    mockedCreate.mockRejectedValueOnce(
      new TRPCError({ code: "CONFLICT", message: "同级下分类名已存在" }),
    );

    const caller = authedCaller();
    await expect(
      caller.category.create({
        type: "expense",
        name: "宠物用品",
        icon: "🐾",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("4. rejects empty/whitespace name (zod trim+min)", async () => {
    const caller = authedCaller();
    await expect(
      caller.category.create({
        type: "expense",
        name: "   ",
        icon: "🐾",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("5. rejects name > 30 chars (zod max)", async () => {
    const caller = authedCaller();
    await expect(
      caller.category.create({
        type: "expense",
        name: "a".repeat(31),
        icon: "🐾",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("6. rejects invalid type (zod enum)", async () => {
    const caller = authedCaller();
    await expect(
      caller.category.create({
        type: "invalid" as any,
        name: "Test",
        icon: "🐾",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("7. rejects non-whitelist icon (zod refine)", async () => {
    const caller = authedCaller();
    await expect(
      caller.category.create({
        type: "expense",
        name: "Test",
        icon: "upload.png",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("8. success with valid parentId (二级分类)", async () => {
    const parentUuid = "00000000-0000-5000-8000-000000000008";
    mockedFindById.mockResolvedValueOnce({
      id: parentUuid,
      name: "人情",
      type: "expense",
      icon: "🎁",
      sortOrder: 100,
      isBuiltIn: false,
      familyId: "fam_test_1",
      parentId: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedCreate.mockResolvedValueOnce({
      id: "00000000-0000-5000-8000-000000000018",
      name: "婚礼红包",
      type: "expense",
      icon: "💍",
      sortOrder: 100,
      isBuiltIn: false,
      familyId: "fam_test_1",
      parentId: parentUuid,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = authedCaller();
    const result = await caller.category.create({
      type: "expense",
      name: "婚礼红包",
      icon: "💍",
      parentId: parentUuid,
    });
    expect(result.parentId).toBe(parentUuid);
  });

  it("9. propagates BAD_REQUEST when createCategory rejects (3rd-level parent)", async () => {
    // Procedure test layer: verify error propagation. Real validation lives
    // in createCategory query (covered by integration test T013).
    const { TRPCError } = await import("@trpc/server");
    mockedCreate.mockRejectedValueOnce(
      new TRPCError({
        code: "BAD_REQUEST",
        message: "二级分类下不可再建子分类 (最多 2 层)",
      }),
    );
    const caller = authedCaller();
    await expect(
      caller.category.create({
        type: "expense",
        name: "Third",
        icon: "🐾",
        parentId: "00000000-0000-5000-8000-000000000019",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("10. propagates BAD_REQUEST when createCategory rejects (cross-family parent)", async () => {
    const { TRPCError } = await import("@trpc/server");
    mockedCreate.mockRejectedValueOnce(
      new TRPCError({
        code: "BAD_REQUEST",
        message: "不能使用其他家庭的分类作为父分类",
      }),
    );
    const caller = authedCaller();
    await expect(
      caller.category.create({
        type: "expense",
        name: "Test",
        icon: "🐾",
        parentId: "00000000-0000-5000-8000-000000000010",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("11. rejects unauthenticated call (401)", async () => {
    const caller = publicCaller();
    await expect(
      caller.category.create({
        type: "expense",
        name: "Test",
        icon: "🐾",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("FR-001: rejects client-supplied familyId (.strict schema)", async () => {
    const caller = authedCaller();
    await expect(
      caller.category.create({
        type: "expense",
        name: "Test",
        icon: "🐾",
        familyId: "attacker_injected",
      } as any),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
