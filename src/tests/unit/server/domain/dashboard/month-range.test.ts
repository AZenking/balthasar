import { describe, expect, it } from "vitest";
import { getUTCMonthRange } from "@/server/domain/dashboard/month-range";

describe("getUTCMonthRange", () => {
  it("January", () => {
    const { start, end } = getUTCMonthRange(new Date("2026-01-15T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("February (non-leap year)", () => {
    const { start, end } = getUTCMonthRange(new Date("2025-02-15T00:00:00Z"));
    expect(start.toISOString()).toBe("2025-02-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2025-03-01T00:00:00.000Z");
  });

  it("February (leap year)", () => {
    const { start, end } = getUTCMonthRange(new Date("2024-02-15T00:00:00Z"));
    expect(start.toISOString()).toBe("2024-02-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2024-03-01T00:00:00.000Z");
  });

  it("December → next year January", () => {
    const { start, end } = getUTCMonthRange(new Date("2026-12-31T23:59:59Z"));
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("half-open: start inclusive, end exclusive", () => {
    const { start, end } = getUTCMonthRange(new Date("2026-07-07T12:00:00Z"));
    expect(start.getTime()).toBeLessThan(end.getTime());
    // July has 31 days
    const diffDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(31);
  });

  it("boundary: first day of month at midnight", () => {
    const { start, end } = getUTCMonthRange(new Date("2026-07-01T00:00:00Z"));
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});
