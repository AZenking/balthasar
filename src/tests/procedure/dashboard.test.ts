import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/db/queries/account", () => ({
  loadFamilyIdByUserId: vi.fn().mockResolvedValue("fam_test"),
}));

vi.mock("@/server/db/queries/dashboard", () => ({
  getMonthSummary: vi.fn().mockResolvedValue({ income: 20000, expense: 10000 }),
  getRecentTransactions: vi.fn().mockResolvedValue([]),
  getCategoryBreakdown: vi.fn().mockResolvedValue([
    { categoryId: "c1", categoryName: "餐饮", categoryIcon: "utensils", amount: 8000 },
    { categoryId: "c2", categoryName: "交通", categoryIcon: "car", amount: 2000 },
  ]),
  // 027: summary 内联 getDailyTrend(本月每日趋势),mock 需同步导出
  getDailyTrend: vi.fn().mockResolvedValue([]),
}));

import { createCaller } from "@/lib/trpc/server";
import { getDailyTrend } from "@/server/db/queries/dashboard";

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

// ─── 030-home-trend-area-today: dayExpense (US1) ───
//
// dashboard.summary 新增 dayExpense: number | null 字段:
//   - 当日 expense 净额(ABS,含退款冲减),复用 getDailyTrend 1 天窗口
//   - 无交易 → 0(非 null)
//   - 子查询失败 → null(降级,不连坐其它字段)
//
// getDailyTrend 在 summary 内被调用两次:本周窗口(7 天)+ 今日窗口(1 天)。
// 区分依据:weekEnd - weekStart 的天数(7 = 本周,1 = 今日)。

describe("[030-US1] dashboard.summary.dayExpense", () => {
  it("dayExpense = 当日 expense 净额(1 天窗口的 getDailyTrend[0].amount)", async () => {
    // 本周窗口(7 天)返回空;今日窗口(1 天)返回 5000 分。
    vi.mocked(getDailyTrend).mockImplementation(async (opts) => {
      const dayMs = 24 * 60 * 60 * 1000;
      const spanDays = (opts.weekEnd.getTime() - opts.weekStart.getTime()) / dayMs;
      if (spanDays === 1) {
        return [{ date: "2026-07-17", amount: 5000 }];
      }
      return []; // 本周(7 天)返回空(本测试不关注 trend 内容)
    });
    const c = authedCaller();
    const result = await c.dashboard.summary();
    expect(result.dayExpense).toBe(5000);
  });

  it("dayExpense = 0(非 null)当今日无交易(1 天窗口返回 amount:0)", async () => {
    vi.mocked(getDailyTrend).mockImplementation(async (opts) => {
      const dayMs = 24 * 60 * 60 * 1000;
      const spanDays = (opts.weekEnd.getTime() - opts.weekStart.getTime()) / dayMs;
      if (spanDays === 1) {
        return [{ date: "2026-07-17", amount: 0 }];
      }
      return [];
    });
    const c = authedCaller();
    const result = await c.dashboard.summary();
    expect(result.dayExpense).toBe(0);
    expect(result.dayExpense).not.toBeNull();
  });

  it("dayExpense = null 当今日窗口 getDailyTrend 抛错(降级);其它字段不受影响", async () => {
    vi.mocked(getDailyTrend).mockImplementation(async (opts) => {
      const dayMs = 24 * 60 * 60 * 1000;
      const spanDays = (opts.weekEnd.getTime() - opts.weekStart.getTime()) / dayMs;
      if (spanDays === 1) {
        throw new Error("simulated today query failure");
      }
      return []; // 本周窗口正常
    });
    const c = authedCaller();
    const result = await c.dashboard.summary();
    expect(result.dayExpense).toBeNull();
    // 主汇总不受降级连坐
    expect(result.monthIncome).toBe(20000);
    expect(result.monthExpense).toBe(10000);
    expect(result.expenseTrend).toBeDefined();
  });
});

// ─── 030-home-trend-area-today: expenseTrend 本周窗口(US2) ───
//
// dashboard.summary.expenseTrend 从"本月每日"改为"本周 Mon..Sun UTC"7 桶,
// 与 year/month 输入解耦(Clarification Q2)。今日之后的本周未来日补零。
//
// 区分 getDailyTrend 两次调用:本周(7 天)+ 今日(1 天)by 窗口跨度。

describe("[030-US2] dashboard.summary.expenseTrend 本周窗口", () => {
  it("expenseTrend.buckets 长度 = 7(本周 Mon..Sun,而非月天数)", async () => {
    // 本周窗口返回 7 桶;今日窗口返回 1 桶。
    vi.mocked(getDailyTrend).mockImplementation(async (opts) => {
      const dayMs = 24 * 60 * 60 * 1000;
      const spanDays = (opts.weekEnd.getTime() - opts.weekStart.getTime()) / dayMs;
      if (spanDays === 7) {
        return Array.from({ length: 7 }, (_, i) => ({
          date: `2026-07-1${i + 3}`, // 7 个占位日期
          amount: i * 1000,
        }));
      }
      return [{ date: "2026-07-17", amount: 5000 }]; // 今日
    });
    const c = authedCaller();
    const result = await c.dashboard.summary();
    expect(result.expenseTrend.granularity).toBe("daily");
    expect(result.expenseTrend.buckets).toHaveLength(7);
  });

  it("expenseTrend 与 month 输入无关:当前月 vs 上月调用结果完全相同", async () => {
    // 固定本周数据;无论传什么 month,expenseTrend 应一致。
    const fixedWeekBuckets = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-07-1${i + 3}`,
      amount: (i + 1) * 1000,
    }));
    vi.mocked(getDailyTrend).mockImplementation(async (opts) => {
      const dayMs = 24 * 60 * 60 * 1000;
      const spanDays = (opts.weekEnd.getTime() - opts.weekStart.getTime()) / dayMs;
      if (spanDays === 7) return [...fixedWeekBuckets];
      return [{ date: "2026-07-17", amount: 5000 }];
    });
    const c = authedCaller();
    const currentMonth = await c.dashboard.summary(); // 缺省 = 当前月
    const lastMonth = await c.dashboard.summary({
      year: 2025,
      month: 6,
    });
    expect(lastMonth.expenseTrend.buckets).toEqual(currentMonth.expenseTrend.buckets);
  });

  it("getDailyTrend 本周调用锚点为周一(weekStart.getUTCDay() === 1),跨度 7 天", async () => {
    vi.mocked(getDailyTrend).mockResolvedValue([]);
    const c = authedCaller();
    await c.dashboard.summary();
    const calls = vi.mocked(getDailyTrend).mock.calls;
    // 找到本周调用(跨度 7 天的那个)
    const dayMs = 24 * 60 * 60 * 1000;
    const weekCall = calls.find(
      ([opts]) => (opts.weekEnd.getTime() - opts.weekStart.getTime()) / dayMs === 7,
    );
    expect(weekCall).toBeDefined();
    expect(weekCall![0].weekStart.getUTCDay()).toBe(1); // Monday
    expect(weekCall![0].weekEnd.getTime() - weekCall![0].weekStart.getTime()).toBe(
      7 * dayMs,
    );
  });
});
