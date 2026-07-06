import "server-only";
import { db } from "@/server/db/client";
import { category, type CategoryType } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Query module for category (003-category, T018 + T026).
 *
 * Read-only (no writes). All families see the same built-in categories;
 * no familyId filter (research.md Q6 — shared global dictionary).
 *
 * Per research.md Q5: DB-level ORDER BY uses the (type, sort_order, name)
 * index for sorted output without separate sort step.
 */
export async function findAllCategories(opts?: { type?: CategoryType }) {
  if (opts?.type) {
    return db
      .select()
      .from(category)
      .where(eq(category.type, opts.type))
      .orderBy(category.sortOrder, category.name);
  }
  return db
    .select()
    .from(category)
    .orderBy(category.sortOrder, category.name);
}

export async function findCategoryById(id: string) {
  const rows = await db
    .select()
    .from(category)
    .where(eq(category.id, id))
    .limit(1);
  return rows[0] ?? null;
}
