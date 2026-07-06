import { describe, expect, it } from "vitest";
import {
  checkPasswordPolicy,
  PASSWORD_MIN_LENGTH,
} from "@/server/domain/auth/password-policy";

/**
 * T032: Unit tests for password-policy (FR-003, NIST 800-63B).
 *
 * Boundary cases:
 * - Length boundary at MIN_LENGTH (7 fails, 8 passes if not blocklisted)
 * - Weak blocklist hits (e.g., "password", "12345678", "qwerty123")
 * - Unicode passwords counted by UTF-16 code unit (NIST allows either)
 */
describe("password-policy", () => {
  describe("checkPasswordPolicy", () => {
    it("rejects password shorter than MIN_LENGTH", () => {
      const result = checkPasswordPolicy("a".repeat(PASSWORD_MIN_LENGTH - 1));
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("too_short");
      expect(result.minLength).toBe(PASSWORD_MIN_LENGTH);
    });

    it("accepts password exactly MIN_LENGTH chars when not blocklisted", () => {
      const result = checkPasswordPolicy("aBcD1234");
      expect(result.ok).toBe(true);
    });

    it("rejects common weak passwords from blocklist", () => {
      const weak = ["password", "12345678", "qwerty123", "password1", "iloveyou"];
      for (const w of weak) {
        const result = checkPasswordPolicy(w);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("weak_password");
      }
    });

    it("rejects blocklisted passwords regardless of case", () => {
      const result = checkPasswordPolicy("PASSWORD");
      // Note: "password" is in blocklist but "PASSWORD" length is 8.
      // The blocklist comparison is case-insensitive (we lowercase before check).
      expect(result.ok).toBe(false);
    });

    it("accepts strong passwords", () => {
      const strong = ["correct-horse-battery-staple", "Tr0ub4dor&3-is-fine", "我的密码是随机中文123"];
      for (const s of strong) {
        const result = checkPasswordPolicy(s);
        expect(result.ok).toBe(true);
      }
    });

    it("accepts unicode passwords meeting length+blocklist rules", () => {
      // 8 unicode chars (16 UTF-16 code units in CJK, but length=8 by JS .length on astral plane edge case).
      // For simplicity, count by JS string length (UTF-16 code units).
      const result = checkPasswordPolicy("密码密码密码密码"); // 8 CJK chars
      expect(result.ok).toBe(true);
    });
  });

  describe("PASSWORD_MIN_LENGTH constant", () => {
    it("is 8 (NIST 800-63B minimum)", () => {
      expect(PASSWORD_MIN_LENGTH).toBe(8);
    });
  });
});
