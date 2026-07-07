/**
 * T008-T009 + T018-T019 + T026-T027 + T032: tRPC procedure contract tests
 * for transaction router (004-transaction).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

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

import { createCaller } from "@/lib/trpc/server";

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
