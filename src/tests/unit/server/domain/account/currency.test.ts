import { describe, expect, it } from "vitest";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_MINOR_UNITS,
  isSupportedCurrency,
  formatBalance,
} from "@/server/domain/account/currency";

/**
 * T010: Unit tests for currency domain (FR-003, FR-004 minor units).
 */
describe("currency domain", () => {
  describe("SUPPORTED_CURRENCIES", () => {
    it("includes 9 MVP currencies", () => {
      expect(SUPPORTED_CURRENCIES).toHaveLength(9);
    });

    it("includes CNY as default", () => {
      expect(SUPPORTED_CURRENCIES).toContain("CNY");
    });

    it("includes JPY (zero-decimal currency)", () => {
      expect(SUPPORTED_CURRENCIES).toContain("JPY");
    });
  });

  describe("CURRENCY_MINOR_UNITS", () => {
    it("maps CNY/USD/EUR to 2 minor units", () => {
      expect(CURRENCY_MINOR_UNITS.CNY).toBe(2);
      expect(CURRENCY_MINOR_UNITS.USD).toBe(2);
      expect(CURRENCY_MINOR_UNITS.EUR).toBe(2);
    });

    it("maps JPY to 0 minor units", () => {
      expect(CURRENCY_MINOR_UNITS.JPY).toBe(0);
    });

    it("covers all SUPPORTED_CURRENCIES", () => {
      for (const c of SUPPORTED_CURRENCIES) {
        expect(CURRENCY_MINOR_UNITS[c]).toBeDefined();
      }
    });
  });

  describe("isSupportedCurrency", () => {
    it("accepts valid codes", () => {
      expect(isSupportedCurrency("CNY")).toBe(true);
      expect(isSupportedCurrency("USD")).toBe(true);
      expect(isSupportedCurrency("JPY")).toBe(true);
    });

    it("rejects 'RMB' (common China-specific informal code)", () => {
      expect(isSupportedCurrency("RMB")).toBe(false);
    });

    it("rejects lowercase", () => {
      expect(isSupportedCurrency("cny")).toBe(false);
    });

    it("rejects unknown codes", () => {
      expect(isSupportedCurrency("KRW")).toBe(false);
      expect(isSupportedCurrency("XYZ")).toBe(false);
      expect(isSupportedCurrency("abc")).toBe(false);
      expect(isSupportedCurrency("")).toBe(false);
    });
  });

  describe("formatBalance", () => {
    it("formats CNY with 2 decimals (100000 分 → 1000.00)", () => {
      expect(formatBalance(100000, "CNY")).toBe("1000.00");
    });

    it("formats CNY with 0 分 as 0.00", () => {
      expect(formatBalance(0, "CNY")).toBe("0.00");
    });

    it("formats negative balance (credit card scenario)", () => {
      expect(formatBalance(-50000, "USD")).toBe("-500.00");
    });

    it("formats JPY without decimals (0 minor units)", () => {
      expect(formatBalance(2000, "JPY")).toBe("2000");
    });

    it("formats HKD with 2 decimals", () => {
      expect(formatBalance(123456, "HKD")).toBe("1234.56");
    });
  });
});
