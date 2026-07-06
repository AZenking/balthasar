import { describe, expect, it } from "vitest";
import {
  isPlausibleEmail,
  normalizeEmail,
} from "@/server/domain/auth/email-normalize";

/**
 * T033: Unit tests for email normalization (FR-015).
 *
 * - trim leading/trailing whitespace
 * - lowercase
 * - preserve middle whitespace as-is (invalid email per RFC)
 * - isPlausibleEmail regex accepts common forms, rejects obvious typos
 */
describe("email-normalize", () => {
  describe("normalizeEmail", () => {
    it("trims leading and trailing whitespace", () => {
      expect(normalizeEmail("  alice@example.com  ")).toBe("alice@example.com");
    });

    it("lowercases uppercase letters", () => {
      expect(normalizeEmail("Alice@Example.COM")).toBe("alice@example.com");
    });

    it("handles combined trim + lowercase", () => {
      expect(normalizeEmail("\tBob@Gmail.COM\n")).toBe("bob@gmail.com");
    });

    it("preserves unicode characters", () => {
      expect(normalizeEmail("用户@例子.广告")).toBe("用户@例子.广告");
    });

    it("returns empty string for empty input", () => {
      expect(normalizeEmail("")).toBe("");
    });
  });

  describe("isPlausibleEmail", () => {
    it("accepts standard email format", () => {
      expect(isPlausibleEmail("alice@example.com")).toBe(true);
    });

    it("accepts plus aliases", () => {
      expect(isPlausibleEmail("alice+filter@gmail.com")).toBe(true);
    });

    it("accepts dotted local part", () => {
      expect(isPlausibleEmail("alice.bob@example.com")).toBe(true);
    });

    it("rejects missing @", () => {
      expect(isPlausibleEmail("aliceexample.com")).toBe(false);
    });

    it("rejects missing domain", () => {
      expect(isPlausibleEmail("alice@")).toBe(false);
    });

    it("rejects missing TLD (no dot in domain)", () => {
      expect(isPlausibleEmail("alice@example")).toBe(false);
    });

    it("rejects whitespace in middle", () => {
      expect(isPlausibleEmail("ali ce@example.com")).toBe(false);
    });
  });
});
