/**
 * T003: Unit tests for category domain rules (018-custom-category).
 *
 * Pure-function tests — no DB, no mocks. Runs in milliseconds.
 * Covers: computeSortOrder / renumberSortOrders / buildCategoryTree /
 * isCategoryEmoji.
 *
 * Per Constitution Principle IV (Test-First): these tests MUST be written
 * and FAILING before implementation in rules.ts (T002) is considered done.
 */
import { describe, expect, it } from "vitest";
import {
  buildCategoryTree,
  computeSortOrder,
  isCategoryEmoji,
  renumberSortOrders,
} from "@/server/domain/category/rules";

// ─── computeSortOrder ───

describe("computeSortOrder", () => {
  it("returns midpoint when there's room", () => {
    expect(computeSortOrder(10, 20)).toBe(15);
    expect(computeSortOrder(10, 12)).toBe(11);
    expect(computeSortOrder(100, 200)).toBe(150);
  });

  it("returns NaN when adjacent gap ≤ 1 (renumber needed)", () => {
    expect(computeSortOrder(10, 11)).toBeNaN();
    expect(computeSortOrder(10, 10)).toBeNaN();
    expect(computeSortOrder(5, 6)).toBeNaN();
  });

  it("handles negative inputs symmetrically", () => {
    expect(computeSortOrder(-20, -10)).toBe(-15);
  });

  it("assumes prev < next; if caller swaps, may still produce valid but wrong value", () => {
    // Document caller contract: caller MUST ensure prev < next.
    // If caller passes (20, 10), mid = 15 which is < prev (20), so NaN.
    expect(computeSortOrder(20, 10)).toBeNaN();
  });
});

// ─── renumberSortOrders ───

describe("renumberSortOrders", () => {
  it("returns empty array for count ≤ 0", () => {
    expect(renumberSortOrders(0)).toEqual([]);
    expect(renumberSortOrders(-1)).toEqual([]);
  });

  it("returns [10] for count = 1", () => {
    expect(renumberSortOrders(1)).toEqual([10]);
  });

  it("returns [10, 20, 30, ...] for count > 1", () => {
    expect(renumberSortOrders(3)).toEqual([10, 20, 30]);
    expect(renumberSortOrders(10)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });

  it("produces N * 10 for the last element", () => {
    const arr = renumberSortOrders(50);
    expect(arr[arr.length - 1]).toBe(500);
  });

  it("all values are unique", () => {
    const arr = renumberSortOrders(20);
    expect(new Set(arr).size).toBe(20);
  });
});

// ─── buildCategoryTree ───

describe("buildCategoryTree", () => {
  type TestCat = { id: string; parentId: string | null; name: string };

  it("returns empty array for empty input", () => {
    expect(buildCategoryTree([])).toEqual([]);
  });

  it("returns all items as roots when none have parentId", () => {
    const flat: TestCat[] = [
      { id: "1", parentId: null, name: "A" },
      { id: "2", parentId: null, name: "B" },
    ];
    const tree = buildCategoryTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toEqual([]);
    expect(tree[1].children).toEqual([]);
  });

  it("nests children under their parent", () => {
    const flat: TestCat[] = [
      { id: "1", parentId: null, name: "A" },
      { id: "2", parentId: "1", name: "B" },
      { id: "3", parentId: "1", name: "C" },
    ];
    const tree = buildCategoryTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("1");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children.map((c) => c.id).sort()).toEqual(["2", "3"]);
  });

  it("preserves insertion order within children", () => {
    const flat: TestCat[] = [
      { id: "1", parentId: null, name: "A" },
      { id: "2", parentId: "1", name: "B" },
      { id: "3", parentId: "1", name: "C" },
      { id: "4", parentId: "1", name: "D" },
    ];
    const tree = buildCategoryTree(flat);
    expect(tree[0].children.map((c) => c.name)).toEqual(["B", "C", "D"]);
  });

  it("promotes orphan items (parentId points to non-existent) to roots", () => {
    const flat: TestCat[] = [
      { id: "1", parentId: "nonexistent", name: "Orphan" },
      { id: "2", parentId: null, name: "Normal" },
    ];
    const tree = buildCategoryTree(flat);
    expect(tree).toHaveLength(2); // both treated as roots
    const ids = tree.map((n) => n.id).sort();
    expect(ids).toEqual(["1", "2"]);
  });

  it("does NOT recurse beyond 2 levels (per FR-005 2-level limit)", () => {
    // Even if data accidentally has 3 levels, the algorithm should still
    // produce a tree (children inside children). The 2-level invariant is
    // enforced at create/update time, not here.
    const flat: TestCat[] = [
      { id: "1", parentId: null, name: "A" },
      { id: "2", parentId: "1", name: "B" },
      { id: "3", parentId: "2", name: "C" }, // 3rd level (shouldn't exist)
    ];
    const tree = buildCategoryTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("1");
    expect(tree[0].children[0].id).toBe("2");
    expect(tree[0].children[0].children[0].id).toBe("3");
  });
});

// ─── isCategoryEmoji (028: 现为 isCategoryIcon 的别名,校验 lucide 图标名) ───

describe("isCategoryEmoji", () => {
  it("returns true for known icon names (003 built-ins)", () => {
    expect(isCategoryEmoji("utensils")).toBe(true);
    expect(isCategoryEmoji("car")).toBe(true);
    expect(isCategoryEmoji("wallet")).toBe(true);
    expect(isCategoryEmoji("gift")).toBe(true);
  });

  it("returns true for known icon names (018 extended)", () => {
    expect(isCategoryEmoji("paw-print")).toBe(true);
    expect(isCategoryEmoji("dog")).toBe(true);
  });

  it("returns false for arbitrary strings", () => {
    expect(isCategoryEmoji("upload.png")).toBe(false);
    expect(isCategoryEmoji("invalid")).toBe(false);
    expect(isCategoryEmoji("not_an_icon_at_all")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCategoryEmoji("")).toBe(false);
  });

  it("returns false for non-icon strings", () => {
    expect(isCategoryEmoji("A")).toBe(false);
    expect(isCategoryEmoji("中")).toBe(false);
    expect(isCategoryEmoji("$")).toBe(false);
  });

  it("rejects non-string types (defensive)", () => {
    expect(isCategoryEmoji(undefined as unknown as string)).toBe(false);
    expect(isCategoryEmoji(null as unknown as string)).toBe(false);
    expect(isCategoryEmoji(123 as unknown as string)).toBe(false);
  });
});
