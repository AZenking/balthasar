import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/db/queries/account", () => ({
  loadFamilyIdByUserId: vi.fn().mockResolvedValue("fam_test"),
}));

vi.mock("@/server/db/queries/dashboard", () => ({
  getMonthSummary: vi.fn().mockResolvedValue({ income: 20000, expense: 10000 }),
  getRecentTransactions: vi.fn().mockResolvedValue([]),
  getCategoryBreakdown: vi.fn().mockResolvedValue([
    { categoryId: "c1", categoryName: "餐饮", categoryIcon: "🍔", amount: 8000 },
    { categoryId: "c2", categoryName: "交通", categoryIcon: "🚗", amount: 2000 },
  ]),
  // 027: summary 内联 getDailyTrend(本月每日趋势),mock 需同步导出
  getDailyTrend: vi.fn().mockResolvedValue([]),
}));

import { createCaller } from "@/lib/trpc/server";

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

function publicCaller() {
  return createCaller({ session: null });
}

beforeEach(() => vi.clearAllMocks());

describe("[T004] dashboard.summary", () => {
  it("returns summary shape", async () => {
    const c = authedCaller();
    const result = await c.dashboard.summary();
    expect(result.monthIncome).toBe(20000);
    expect(result.monthExpense).toBe(10000);
    expect(result.monthNet).toBe(10000);
    expect(Array.isArray(result.recentTransactions)).toBe(true);
    expect(result.topExpenseCategories.length).toBe(2);
    expect(result.topExpenseCategories[0]!.percentage).toBe(80); // 8000/10000*100
    expect(result.topExpenseCategories[1]!.percentage).toBe(20); // 2000/10000*100
  });

  it("requires auth", async () => {
    const c = publicCaller();
    await expect(c.dashboard.summary()).rejects.toMatchObject({
      code: "UNAUTHORIZED",    });
  });
});
