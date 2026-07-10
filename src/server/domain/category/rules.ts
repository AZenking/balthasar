/**
 * Category domain rules (018-custom-category, T002).
 *
 * Pure functions — no IO. Unit-testable in isolation (see
 * `src/tests/unit/domain/category-rules.test.ts`).
 *
 * Per research.md:
 * - D4: sortOrder integer-gap + renumber-on-exhaustion algorithm
 * - D8: hierarchical list query uses single SELECT + app-side tree build
 *
 * Used by:
 * - `src/server/db/queries/category.ts` (createCategory / updateCategory)
 * - `src/server/api/routers/category.ts` (reorder procedure)
 * - Frontend drag-and-drop UI (when computing new sortOrder on drop)
 */

import { CATEGORY_EMOJI_SET } from "@/lib/constants/category-emojis";

/**
 * Compute the new sortOrder for an item dragged between prev and next
 * siblings (research.md D4).
 *
 * Algorithm: take the floor of the midpoint. If midpoint is not strictly
 * greater than prev (i.e., adjacent gap ≤ 1), return NaN to signal that
 * the caller MUST trigger a full renumber of the sibling list.
 *
 * @returns New sortOrder integer, or NaN if gap exhausted.
 *
 * Examples:
 *   computeSortOrder(10, 20) → 15   // ✅ fits
 *   computeSortOrder(10, 12) → 11   // ✅ fits
 *   computeSortOrder(10, 11) → NaN  // ❌ gap ≤ 1, renumber needed
 *   computeSortOrder(10, 10) → NaN  // ❌ equal (shouldn't happen, but safe)
 */
export function computeSortOrder(prev: number, next: number): number {
  const mid = Math.floor((prev + next) / 2);
  return mid > prev ? mid : Number.NaN;
}

/**
 * Generate a fresh sortOrder sequence for a sibling list of length `count`
 * (research.md D4 renumber step).
 *
 * Returns `[10, 20, 30, ..., count * 10]`. For count ≤ 0, returns empty
 * array.
 *
 * The 10-gap default gives plenty of room for future mid-insertions
 * before the next renumber.
 */
export function renumberSortOrders(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => (i + 1) * 10);
}

/**
 * Generic category node for hierarchical tree building (research.md D8).
 *
 * Generic `C` carries all the original category fields (id, name, type,
 * icon, sortOrder, familyId, isBuiltIn, parentId, archivedAt, ...).
 * `children` is appended by buildCategoryTree.
 */
export type CategoryTreeNode<
  C extends { id: string; parentId: string | null },
> = C & { children: CategoryTreeNode<C>[] };

/**
 * Build a parent-children tree from a flat list of categories
 * (research.md D8).
 *
 * Algorithm:
 * 1. Index all items by id in a Map.
 * 2. For each item, look up its parentId:
 *    - If parentId exists in the map → append self to that parent's children
 *    - Else (parentId null OR points to non-existent) → treat as root
 * 3. Return the roots array.
 *
 * Complexity: O(N) time, O(N) space.
 *
 * "Orphan" items (parentId points to a non-existent id, e.g. parent was
 * hard-deleted — but per spec we don't hard-delete, so this is defensive)
 * are promoted to roots rather than dropped.
 *
 * @example
 * const flat = [
 *   { id: "1", parentId: null, name: "A" },
 *   { id: "2", parentId: "1", name: "B" },
 * ];
 * const tree = buildCategoryTree(flat);
 * // → [{ id: "1", parentId: null, name: "A", children: [
 * //      { id: "2", parentId: "1", name: "B", children: [] }
 * //    ]}]
 */
export function buildCategoryTree<
  C extends { id: string; parentId: string | null },
>(flat: C[]): CategoryTreeNode<C>[] {
  const byId = new Map<string, CategoryTreeNode<C>>();
  for (const item of flat) {
    byId.set(item.id, { ...item, children: [] });
  }

  const roots: CategoryTreeNode<C>[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Validate that a string is in the category emoji whitelist (FR-004).
 *
 * Backed by CATEGORY_EMOJI_SET (O(1) lookup). Used by zod refine in
 * create/update procedures to reject arbitrary user input.
 */
export function isCategoryEmoji(value: string): boolean {
  return typeof value === "string" && CATEGORY_EMOJI_SET.has(value);
}
