/**
 * Category constants (003-category, F3 fix — YAGNI).
 *
 * Per research.md Q2: built-in category IDs are UUID v5 generated from
 * `"${type}:${name}"` in this fixed DNS namespace. The seed migration
 * (0003_categories.sql) uses these same IDs to ensure cross-environment
 * stability (FR-011, SC-005).
 *
 * To regenerate seed SQL after editing the dataset, run:
 *   node scripts/generate-category-seed.mjs  (TODO T005, not committed)
 *
 * Future: when V2 adds user-defined categories, this constant remains for
 * built-in classification logic (e.g. `isBuiltIn` flag derivation).
 */
export const CATEGORY_DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
