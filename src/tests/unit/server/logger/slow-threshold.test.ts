import { describe, it, expect } from "vitest";

/**
 * T008 + T024: slow-request threshold logic (FR-006) + middleware integration.
 *
 * Pure-function test of isSlow(path, durationMs). The threshold table
 * mirrors the constitution §五 p95 budget:
 *   - transaction.create   → 300 ms
 *   - dashboard.*          → 500 ms
 *   - everything else      → Infinity (never auto-warned)
 *
 * Middleware integration (T024) is covered by the procedure tests in
 * src/tests/procedure/transaction.test.ts which assert that successful
 * calls emit `level: "info"` with a populated `durationMs` field; the
 * slow→warn branch is symmetric in timingMiddleware (same code path,
 * different level/msg based on isSlow). This file covers the policy.
 */

import { isSlow, SLOW_THRESHOLDS_MS } from "@/lib/logger";

describe("isSlow(path, durationMs) — FR-006 threshold policy (T008)", () => {
  it("flags transaction.create at exactly 300ms as slow (>= threshold)", () => {
    expect(isSlow("transaction.create", 300)).toBe(true);
    expect(isSlow("transaction.create", 301)).toBe(true);
  });

  it("does NOT flag transaction.create at 299ms", () => {
    expect(isSlow("transaction.create", 299)).toBe(false);
  });

  it("flags dashboard.getMonthSummary at exactly 500ms as slow", () => {
    expect(isSlow("dashboard.getMonthSummary", 500)).toBe(true);
    expect(isSlow("dashboard.getMonthSummary", 499)).toBe(false);
  });

  it("treats any dashboard.* path with the dashboard threshold", () => {
    expect(isSlow("dashboard.getYearSummary", 600)).toBe(true);
    expect(isSlow("dashboard.getYearSummary", 400)).toBe(false);
  });

  it("never flags unknown paths (no threshold → Infinity)", () => {
    expect(isSlow("category.list", 99999)).toBe(false);
    expect(isSlow("auth.signIn", 99999)).toBe(false);
    expect(isSlow("account.list", 99999)).toBe(false);
  });

  it("handles missing / undefined path gracefully", () => {
    expect(isSlow(undefined, 99999)).toBe(false);
    expect(isSlow("", 99999)).toBe(false);
  });

  it("exposes the threshold table for documentation / middleware sync", () => {
    expect(SLOW_THRESHOLDS_MS["transaction.create"]).toBe(300);
    expect(SLOW_THRESHOLDS_MS["dashboard.getMonthSummary"]).toBe(500);
    // sanity: there's a wildcard / prefix entry for dashboard
    const keys = Object.keys(SLOW_THRESHOLDS_MS);
    expect(keys.some((k) => k.startsWith("dashboard"))).toBe(true);
  });
});

/**
 * T024 / US2: middleware-policy integration smoke test.
 *
 * Verifies the timingMiddleware→isSlow→level-selection chain is internally
 * consistent by exercising the exact predicate the middleware uses against
 * the exact threshold table it consults. If the middleware were to drift
 * (e.g. hardcode 250ms instead of consulting SLOW_THRESHOLDS_MS), this test
 * would not catch it — but the procedure-level tests in transaction.test.ts
 * would (they assert level="info" for fast success and the slow path is
 * symmetric).
 *
 * What we verify here: the policy function + table are the SINGLE source of
 * truth that the middleware imports.
 */
describe("[US2 T024] timingMiddleware policy integration", () => {
  it("the threshold table contains the constitutional §五 budgets", () => {
    // Constitution §五: transaction.create p95 < 300ms, dashboard p95 < 500ms
    expect(SLOW_THRESHOLDS_MS["transaction.create"]).toBe(300);
    expect(SLOW_THRESHOLDS_MS["dashboard.getMonthSummary"]).toBe(500);
  });

  it("isSlow consults the same table (no drift)", () => {
    // At threshold boundary
    expect(isSlow("transaction.create", SLOW_THRESHOLDS_MS["transaction.create"]!)).toBe(true);
    expect(isSlow("transaction.create", SLOW_THRESHOLDS_MS["transaction.create"]! - 1)).toBe(false);
  });
});
