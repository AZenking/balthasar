/**
 * Unit tests for `src/lib/date-ranges.ts` (026-cream-amber-revamp R7).
 *
 * Pure-function tests — no DB, no mocks. Covers the four exported utilities
 * and the edge cases called out in research.md R7 + data-model.md §2.9:
 * cross-year, leap year, month-length variance, partial weeks at month
 * boundaries, cross-month weeks, empty data, sign passthrough, excl end.
 *
 * Per Constitution Principle IV (Test-First): these tests MUST be written
 * and FAILING before the implementation is considered done.
 */
import { describe, expect, it } from "vitest";

import {
  getLast24Months,
  getUtcMonthRange,
  getUtcWeeksInMonth,
  padDailyBuckets,
} from "@/lib/date-ranges";

// Helper: assert a Date equals a UTC instant specified as 'YYYY-MM-DDTHH:MM:SSZ'.
function expectUtc(date: Date, iso: string): void {
  expect(date.toISOString()).toBe(`${iso.replace("Z", "")}Z`);
}

// ─── getUtcMonthRange ───

describe("getUtcMonthRange", () => {
  it("2026-07 → start=2026-07-01T00:00:00Z, end=2026-08-01T00:00:00Z", () => {
    const { start, end } = getUtcMonthRange(2026, 7);
    expectUtc(start, "2026-07-01T00:00:00.000Z");
    expectUtc(end, "2026-08-01T00:00:00.000Z");
  });

  it("cross-year: 2026-12 → end=2027-01-01T00:00:00Z", () => {
    const { start, end } = getUtcMonthRange(2026, 12);
    expectUtc(start, "2026-12-01T00:00:00.000Z");
    expectUtc(end, "2027-01-01T00:00:00.000Z");
  });

  it("leap year: 2024-02 has 29 days (start=2024-02-01, end=2024-03-01)", () => {
    const { start, end } = getUtcMonthRange(2024, 2);
    expectUtc(start, "2024-02-01T00:00:00.000Z");
    expectUtc(end, "2024-03-01T00:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(29 * 24 * 60 * 60 * 1000);
  });

  it("month-length variance: 2026-01 (31d) vs 2026-04 (30d)", () => {
    const jan = getUtcMonthRange(2026, 1);
    const apr = getUtcMonthRange(2026, 4);
    expect(jan.end.getTime() - jan.start.getTime()).toBe(
      31 * 24 * 60 * 60 * 1000,
    );
    expect(apr.end.getTime() - apr.start.getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
  });

  it("non-leap year: 2025-02 has 28 days (2025-02-29 does not exist; call does not throw)", () => {
    expect(() => getUtcMonthRange(2025, 2)).not.toThrow();
    const { start, end } = getUtcMonthRange(2025, 2);
    expect(end.getTime() - start.getTime()).toBe(28 * 24 * 60 * 60 * 1000);
  });
});

// ─── getUtcWeeksInMonth ───

describe("getUtcWeeksInMonth", () => {
  it("2026-07-01 is a Wednesday → first week starts Mon 2026-06-29, ends Mon 2026-07-06, label '6/29-7/5'", () => {
    const weeks = getUtcWeeksInMonth(2026, 7);
    expect(weeks[0].start.toISOString()).toBe("2026-06-29T00:00:00.000Z");
    expect(weeks[0].end.toISOString()).toBe("2026-07-06T00:00:00.000Z");
    expect(weeks[0].label).toBe("6/29-7/5");
  });

  it("2026-06-01 is a Monday (not Sunday as the task description stated) → first week starts 2026-06-01, ends 2026-06-08 (excl), label '6/1-6/7'", () => {
    // Reality check: 2026-06-01 is a Monday (getUTCDay()=1). Task description
    // said "2026-06-01 is a Sunday" — that is incorrect; verified via
    // `new Date('2026-06-01T00:00:00.000Z').getUTCDay()` === 1. Under the
    // Mon-start rule, the first week of 2026-06 starts exactly on 2026-06-01.
    const weeks = getUtcWeeksInMonth(2026, 6);
    expect(weeks[0].start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(weeks[0].end.toISOString()).toBe("2026-06-08T00:00:00.000Z");
    expect(weeks[0].label).toBe("6/1-6/7");
  });

  it("2026-02-01 is a Sunday → first week starts on the preceding Monday 2026-01-26", () => {
    // 2026-02-01 is a Sunday (verified). isoWeekday(0)=6 → firstWeekStart =
    // 2026-02-01 minus 6 days = 2026-01-26.
    const weeks = getUtcWeeksInMonth(2026, 2);
    expect(weeks[0].start.toISOString()).toBe("2026-01-26T00:00:00.000Z");
    expect(weeks[0].end.toISOString()).toBe("2026-02-02T00:00:00.000Z");
    expect(weeks[0].label).toBe("1/26-2/1");
  });

  it("2025-09-01 is a Monday → first week starts 2025-09-01 (aligned with month start)", () => {
    const weeks = getUtcWeeksInMonth(2025, 9);
    expect(weeks[0].start.toISOString()).toBe("2025-09-01T00:00:00.000Z");
    expect(weeks[0].end.toISOString()).toBe("2025-09-08T00:00:00.000Z");
    expect(weeks[0].label).toBe("9/1-9/7");
  });

  it("2026-07-31 is a Friday → last week starts Mon 2026-07-27, ends Mon 2026-08-03", () => {
    const weeks = getUtcWeeksInMonth(2026, 7);
    const last = weeks[weeks.length - 1];
    expect(last.start.toISOString()).toBe("2026-07-27T00:00:00.000Z");
    expect(last.end.toISOString()).toBe("2026-08-03T00:00:00.000Z");
    expect(last.label).toBe("7/27-8/2");
  });

  it("month-length variance: 2026-07 (31d, Wed start) → 5 weeks; 2026-02 (28d, Sun start) → 5 weeks", () => {
    // 2026-07-01 is Wed → first week Mon 6/29..Sun 7/5, last week 7/27..8/2 → 5 weeks.
    // 2026-02-01 is Sun → first week Mon 1/26..Sun 2/1, last week 2/23..3/1 → 5 weeks.
    // (Task description said "2026-02 → 4 weeks" but that assumed Sun-start;
    // under the Mon-start rule the partial first week + 4 more = 5.)
    const jul = getUtcWeeksInMonth(2026, 7);
    const feb = getUtcWeeksInMonth(2026, 2);
    expect(jul.length).toBe(5);
    expect(feb.length).toBe(5);
  });

  it("cross-month weeks: returned start may be previous month, end may be next month", () => {
    const weeks = getUtcWeeksInMonth(2026, 7);
    // First week start is in June (prev month).
    expect(weeks[0].start.getUTCMonth()).toBe(5); // 0-indexed June
    // Last week end is in August (next month).
    expect(weeks[weeks.length - 1].end.getUTCMonth()).toBe(7); // 0-indexed August
  });

  it("every week is exactly 7 days (start to end)", () => {
    const weeks = getUtcWeeksInMonth(2026, 7);
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    for (const w of weeks) {
      expect(w.end.getTime() - w.start.getTime()).toBe(weekMs);
    }
  });

  it("weeks are contiguous: week[i].end === week[i+1].start", () => {
    const weeks = getUtcWeeksInMonth(2026, 7);
    for (let i = 0; i < weeks.length - 1; i++) {
      expect(weeks[i].end.getTime()).toBe(weeks[i + 1].start.getTime());
    }
  });
});

// ─── padDailyBuckets ───

describe("padDailyBuckets", () => {
  // Standard 7-day Mon-Sun window used across most tests:
  // 2026-07-06 (Mon) .. 2026-07-13 (next Mon, excl).
  const start = new Date("2026-07-06T00:00:00.000Z");
  const end = new Date("2026-07-13T00:00:00.000Z");

  it("empty transactions → 7 zero buckets", () => {
    const buckets = padDailyBuckets([], start, end);
    expect(buckets).toHaveLength(7);
    for (const b of buckets) expect(b.amount).toBe(0);
    expect(buckets.map((b) => b.date)).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);
  });

  it("single transaction on Wednesday → Wednesday bucket = amount, others 0", () => {
    const txs = [
      {
        occurredAt: new Date("2026-07-08T12:30:00.000Z"), // Wed
        amount: 5000,
      },
    ];
    const buckets = padDailyBuckets(txs, start, end);
    expect(buckets).toHaveLength(7);
    expect(buckets[2]).toEqual({ date: "2026-07-08", amount: 5000 });
    // Every other bucket is zero.
    for (let i = 0; i < 7; i++) {
      if (i === 2) continue;
      expect(buckets[i].amount).toBe(0);
    }
  });

  it("multiple transactions on the same day → sum", () => {
    const txs = [
      { occurredAt: new Date("2026-07-08T01:00:00.000Z"), amount: 1000 },
      { occurredAt: new Date("2026-07-08T12:00:00.000Z"), amount: 2500 },
      { occurredAt: new Date("2026-07-08T23:59:59.999Z"), amount: 500 },
    ];
    const buckets = padDailyBuckets(txs, start, end);
    expect(buckets[2]).toEqual({ date: "2026-07-08", amount: 4000 });
  });

  it("transactions across multiple days (Mon + Wed) → two non-zero buckets", () => {
    const txs = [
      { occurredAt: new Date("2026-07-06T08:00:00.000Z"), amount: 1200 }, // Mon
      { occurredAt: new Date("2026-07-08T08:00:00.000Z"), amount: 800 }, // Wed
    ];
    const buckets = padDailyBuckets(txs, start, end);
    expect(buckets[0].amount).toBe(1200);
    expect(buckets[2].amount).toBe(800);
    expect(buckets[1].amount).toBe(0);
    expect(buckets[3].amount).toBe(0);
  });

  it("negative amount (expense stored as −) passes through unchanged", () => {
    const txs = [
      {
        occurredAt: new Date("2026-07-09T10:00:00.000Z"), // Thu
        amount: -3200,
      },
    ];
    const buckets = padDailyBuckets(txs, start, end);
    expect(buckets[3]).toEqual({ date: "2026-07-09", amount: -3200 });
  });

  it("transaction exactly at start (Mon 00:00 UTC) → counted in first bucket", () => {
    const txs = [{ occurredAt: new Date("2026-07-06T00:00:00.000Z"), amount: 999 }];
    const buckets = padDailyBuckets(txs, start, end);
    expect(buckets[0].amount).toBe(999);
  });

  it("transaction exactly at end (next Mon 00:00 UTC) → NOT counted (excl end)", () => {
    const txs = [
      { occurredAt: new Date("2026-07-13T00:00:00.000Z"), amount: 999 },
    ];
    const buckets = padDailyBuckets(txs, start, end);
    // Bucket count is still 7 and all are zero — the boundary tx is excluded.
    expect(buckets).toHaveLength(7);
    for (const b of buckets) expect(b.amount).toBe(0);
  });

  it("transactions outside [start, end) are dropped", () => {
    const txs = [
      { occurredAt: new Date("2026-07-05T23:59:59.999Z"), amount: 100 }, // day before start
      { occurredAt: new Date("2026-07-13T00:00:00.000Z"), amount: 200 }, // == end (excl)
      { occurredAt: new Date("2026-07-20T00:00:00.000Z"), amount: 300 }, // after end
    ];
    const buckets = padDailyBuckets(txs, start, end);
    expect(buckets).toHaveLength(7);
    for (const b of buckets) expect(b.amount).toBe(0);
  });

  it("buckets are ordered ascending by date", () => {
    const txs = [
      { occurredAt: new Date("2026-07-12T00:00:00.000Z"), amount: 1 }, // Sun
      { occurredAt: new Date("2026-07-06T00:00:00.000Z"), amount: 2 }, // Mon
      { occurredAt: new Date("2026-07-09T00:00:00.000Z"), amount: 3 }, // Thu
    ];
    const buckets = padDailyBuckets(txs, start, end);
    const dates = buckets.map((b) => b.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });
});

// ─── getLast24Months ───

describe("getLast24Months", () => {
  it("default param: current month in position 0, descending", () => {
    const list = getLast24Months();
    const now = new Date();
    const first = list[0];
    expect(first.year).toBe(now.getUTCFullYear());
    expect(first.month).toBe(now.getUTCMonth() + 1);
    // Strictly descending (year*12+month decreasing).
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1].year * 12 + (list[i - 1].month - 1);
      const curr = list[i].year * 12 + (list[i].month - 1);
      expect(prev).toBeGreaterThan(curr);
    }
  });

  it("explicit now=2026-07-13 → first item { year: 2026, month: 7, label: '2026年7月' }", () => {
    const list = getLast24Months(new Date("2026-07-13T10:00:00.000Z"));
    expect(list[0]).toEqual({ year: 2026, month: 7, label: "2026年7月" });
  });

  it("cross-year: now=2026-01-15 → first=2026-01, last=2024-02", () => {
    const list = getLast24Months(new Date("2026-01-15T00:00:00.000Z"));
    expect(list[0]).toEqual({ year: 2026, month: 1, label: "2026年1月" });
    expect(list[23]).toEqual({ year: 2024, month: 2, label: "2024年2月" });
  });

  it("array length is exactly 24", () => {
    const list = getLast24Months(new Date("2026-07-13T00:00:00.000Z"));
    expect(list).toHaveLength(24);
  });

  it("label has no leading zero: '2026年7月' not '2026年07月'", () => {
    const list = getLast24Months(new Date("2026-07-13T00:00:00.000Z"));
    const jul = list[0];
    expect(jul.label).toBe("2026年7月");
    expect(jul.label).not.toBe("2026年07月");
    // October (month 10) — also no leading zero, label is '2025年10月'.
    const oct = list.find((x) => x.year === 2025 && x.month === 10);
    expect(oct?.label).toBe("2025年10月");
  });

  it("month field is always 1-12", () => {
    const list = getLast24Months(new Date("2026-07-13T00:00:00.000Z"));
    for (const item of list) {
      expect(item.month).toBeGreaterThanOrEqual(1);
      expect(item.month).toBeLessThanOrEqual(12);
    }
  });
});

// ─── Cross-cutting boundary cases ───

describe("cross-cutting edge cases", () => {
  it("leap year 2024-02-29 exists: month span = 29 days", () => {
    const { start, end } = getUtcMonthRange(2024, 2);
    expect(end.getTime() - start.getTime()).toBe(29 * 24 * 60 * 60 * 1000);
  });

  it("non-leap year 2025-02-29 does NOT exist: getUtcMonthRange(2025, 2) does not throw", () => {
    expect(() => getUtcMonthRange(2025, 2)).not.toThrow();
  });

  it("getUtcWeeksInMonth(2026, 7) covers 2026-06-29 through 2026-08-03 (full month + cross-month padding)", () => {
    const weeks = getUtcWeeksInMonth(2026, 7);
    const firstStart = weeks[0].start.getTime();
    const lastEnd = weeks[weeks.length - 1].end.getTime();
    expect(firstStart).toBe(new Date("2026-06-29T00:00:00.000Z").getTime());
    expect(lastEnd).toBe(new Date("2026-08-03T00:00:00.000Z").getTime());
    // Coverage is continuous: end-of-week[i] === start-of-week[i+1].
    for (let i = 0; i < weeks.length - 1; i++) {
      expect(weeks[i].end.getTime()).toBe(weeks[i + 1].start.getTime());
    }
  });

  it("getUtcWeeksInMonth coverage ≥ month span: every day in the month falls in some week", () => {
    // For 2026-07 (31 days), union of week [start, end) must cover at least
    // [2026-07-01, 2026-08-01).
    const weeks = getUtcWeeksInMonth(2026, 7);
    const monthStart = new Date("2026-07-01T00:00:00.000Z").getTime();
    const monthEnd = new Date("2026-08-01T00:00:00.000Z").getTime();
    expect(weeks[0].start.getTime()).toBeLessThanOrEqual(monthStart);
    expect(weeks[weeks.length - 1].end.getTime()).toBeGreaterThanOrEqual(
      monthEnd,
    );
  });
});
