import { describe, expect, it } from "vitest";
import {
  validateAccountName,
  validateInitialBalance,
  ACCOUNT_NAME_MIN_LENGTH,
  ACCOUNT_NAME_MAX_LENGTH,
} from "@/server/domain/account/validate";

/**
 * T011: Unit tests for validate domain (FR-002 name, FR-004 balance).
 */
describe("validate domain", () => {
  describe("ACCOUNT_NAME constants", () => {
    it("MIN_LENGTH is 1", () => {
      expect(ACCOUNT_NAME_MIN_LENGTH).toBe(1);
    });

    it("MAX_LENGTH is 50", () => {
      expect(ACCOUNT_NAME_MAX_LENGTH).toBe(50);
    });
  });

  describe("validateAccountName", () => {
    it("rejects empty string", () => {
      const r = validateAccountName("");
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("too_short");
      expect(r.length).toBe(0);
    });

    it("accepts single char", () => {
      expect(validateAccountName("A").ok).toBe(true);
    });

    it("accepts exactly 50 chars", () => {
      const r = validateAccountName("a".repeat(50));
      expect(r.ok).toBe(true);
      expect(r.length).toBe(50);
    });

    it("rejects 51 chars", () => {
      const r = validateAccountName("a".repeat(51));
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("too_long");
      expect(r.length).toBe(51);
    });

    it("accepts Chinese characters (UTF-16 code unit count)", () => {
      // 8 CJK chars = 8 UTF-16 code units
      const r = validateAccountName("密码密码密码密码");
      expect(r.ok).toBe(true);
      expect(r.length).toBe(8);
    });

    it("counts emoji surrogate pair as 2 (current behavior)", () => {
      // 🎉 is a single surrogate pair = 2 UTF-16 code units
      const r = validateAccountName("🎉");
      expect(r.length).toBe(2);
      expect(r.ok).toBe(true);
    });

    it("accepts spaces in middle", () => {
      expect(validateAccountName("招商银行卡 1").ok).toBe(true);
    });
  });

  describe("validateInitialBalance", () => {
    it("accepts zero", () => {
      expect(validateInitialBalance(0).ok).toBe(true);
    });

    it("accepts positive integer", () => {
      expect(validateInitialBalance(100000).ok).toBe(true);
    });

    it("accepts negative integer (credit card / loan)", () => {
      expect(validateInitialBalance(-50000).ok).toBe(true);
    });

    it("rejects fractional value (e.g. 100.5)", () => {
      const r = validateInitialBalance(100.5);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("not_integer");
    });

    it("rejects NaN", () => {
      expect(validateInitialBalance(NaN).ok).toBe(false);
    });

    it("rejects Infinity", () => {
      expect(validateInitialBalance(Infinity).ok).toBe(false);
    });

    it("rejects string", () => {
      expect(validateInitialBalance("100").ok).toBe(false);
    });

    it("accepts MAX_SAFE_INTEGER", () => {
      expect(validateInitialBalance(Number.MAX_SAFE_INTEGER).ok).toBe(true);
    });

    it("rejects beyond MAX_SAFE_INTEGER (precision loss risk)", () => {
      const r = validateInitialBalance(Number.MAX_SAFE_INTEGER + 1);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("out_of_safe_range");
    });

    it("rejects -MAX_SAFE_INTEGER - 1", () => {
      expect(validateInitialBalance(-Number.MAX_SAFE_INTEGER - 1).ok).toBe(false);
    });
  });
});
