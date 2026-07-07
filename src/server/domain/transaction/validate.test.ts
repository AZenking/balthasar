import { describe, expect, it } from "vitest";
import {
  applySign,
  toDisplayAmount,
  validateOccurredAt,
  validateRemark,
  REMARK_MAX_LENGTH,
  OCCURRED_AT_FUTURE_TOLERANCE_MS,
} from "@/server/domain/transaction/validate";

describe("applySign", () => {
  it("returns positive for income", () => {
    expect(applySign("income", 5000)).toBe(5000);
  });

  it("returns negative for expense", () => {
    expect(applySign("expense", 5000)).toBe(-5000);
  });

  it("returns 0 for zero amount", () => {
    expect(applySign("income", 0)).toBe(0);
    expect(applySign("expense", 0)).toBe(0);
  });

  it("forces abs value regardless of input sign", () => {
    expect(applySign("income", -100)).toBe(100);
    expect(applySign("expense", -100)).toBe(-100);
  });
});

describe("toDisplayAmount", () => {
  it("converts negative DB amount to positive", () => {
    expect(toDisplayAmount(-5000)).toBe(5000);
  });

  it("converts positive DB amount to positive", () => {
    expect(toDisplayAmount(5000)).toBe(5000);
  });

  it("handles zero", () => {
    expect(toDisplayAmount(0)).toBe(0);
  });
});

describe("validateOccurredAt", () => {
  const NOW = new Date("2026-07-07T12:00:00Z");

  it("accepts past date", () => {
    expect(validateOccurredAt(new Date("2020-01-01"), NOW).ok).toBe(true);
  });

  it("accepts today", () => {
    expect(validateOccurredAt(NOW, NOW).ok).toBe(true);
  });

  it("accepts within 1-day tolerance", () => {
    const within = new Date(NOW.getTime() + 12 * 60 * 60 * 1000); // +12h
    expect(validateOccurredAt(within, NOW).ok).toBe(true);
  });

  it("rejects > 1 day in future", () => {
    const future = new Date(NOW.getTime() + OCCURRED_AT_FUTURE_TOLERANCE_MS + 1);
    expect(validateOccurredAt(future, NOW).ok).toBe(false);
    expect(validateOccurredAt(future, NOW).reason).toBe("future_date");
  });

  it("accepts exactly at tolerance boundary", () => {
    const boundary = new Date(NOW.getTime() + OCCURRED_AT_FUTURE_TOLERANCE_MS);
    expect(validateOccurredAt(boundary, NOW).ok).toBe(true);
  });
});

describe("validateRemark", () => {
  it("accepts empty string", () => {
    expect(validateRemark("").ok).toBe(true);
  });

  it("accepts exactly 200 chars", () => {
    expect(validateRemark("a".repeat(200)).ok).toBe(true);
  });

  it("rejects 201 chars", () => {
    const r = validateRemark("a".repeat(201));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("too_long");
    expect(r.length).toBe(201);
  });

  it("accepts Chinese characters", () => {
    expect(validateRemark("午餐咖啡地铁").ok).toBe(true);
  });

  it("REMARK_MAX_LENGTH is 200", () => {
    expect(REMARK_MAX_LENGTH).toBe(200);
  });
});
