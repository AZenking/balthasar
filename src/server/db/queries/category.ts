import "server-only";
import { db, withTransaction } from "@/server/db/client";
import {
  category,
  type Category,
  type CategoryType,
  type CategoryMutationSnapshot,
} from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { uuidv7 } from "uuidv7";
import { and, count, eq, isNull, or, sql } from "drizzle-orm";
import { writeCategoryEvent } from "@/server/db/queries/category-events";

/**
 * Query module for category (003 + 018 extension).
 *
 * Two read modes:
 * - 003 compat (no familyId): built-in only, sorted by (sort_order, name).
 *   Used by legacy callers / tests that don't have a session context.
 * - 018 mode (with familyId): built-in (family_id IS NULL) + family's
 *   custom (family_id = $1) + active (archived_at IS NULL), sorted by
 *   (parent_id NULLS FIRST, sort_order, created_at). Used by category.list
 *   procedure after US4 (T026) extends it with hierarchy + filters.
 *
 * Per research.md D7: countCustomCategoriesByFamily uses advisory lock
 * (taken in caller's tx) for race-safe 200-cap enforcement.
 *
 * Per research.md D8: hierarchical output is built in the application
 * layer via `buildCategoryTree` (rules.ts). This module returns FLAT list;
 * the procedure layer (US4 T026) calls buildCategoryTree after fetching.
 */

/**
 * Find all categories visible to the caller.
 *
 * Behavior by input:
 * - `{}` or `{ type }` (003 mode, no familyId): returns ALL rows of given
 *   type (or all types), sorted by (sort_order, name). Used by 003-era
 *   code paths. After 018, callers should pass familyId to get custom too.
 * - `{ familyId }` (018 mode): WHERE `(family_id IS NULL OR family_id = $1)
 *   AND archived_at IS NULL`, sorted by `(parent_id NULLS FIRST, sort_order,
 *   created_at)`. Built-in + family's active custom, flat (no hierarchy).
 *   US4 T026 will extend this with hierarchy + filters.
 */
export async function findAllCategories(
  opts?:
    | { type?: CategoryType }
    | { familyId: string; type?: CategoryType },
): Promise<Category[]> {
  if (opts && "familyId" in opts && opts.familyId) {
    // 018 mode
    const conds = [
      or(isNull(category.familyId), eq(category.familyId, opts.familyId)),
      isNull(category.archivedAt),
    ];
    if (opts.type) {
      conds.push(eq(category.type, opts.type));
    }
    return db
      .select()
      .from(category)
      .where(and(...conds))
      .orderBy(
        sql`${category.parentId} NULLS FIRST`,
        category.sortOrder,
        category.createdAt,
      );
  }

  // 003 compat mode
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

/**
 * Find direct children of a parent. Used for "select parent → load
 * children" cascade scenario (US4 T026 will expose this via list query).
 *
 * Returns flat list (no nested children).
 */
export async function findAllCategoriesByParent(opts: {
  familyId: string;
  parentId: string;
  type?: CategoryType;
  includeArchived?: boolean;
}): Promise<Category[]> {
  const conds = [
    or(isNull(category.familyId), eq(category.familyId, opts.familyId)),
    eq(category.parentId, opts.parentId),
  ];
  if (opts.type) {
    conds.push(eq(category.type, opts.type));
  }
  if (!opts.includeArchived) {
    conds.push(isNull(category.archivedAt));
  }
  return db
    .select()
    .from(category)
    .where(and(...conds))
    .orderBy(category.sortOrder, category.createdAt);
}

/**
 * Count categories visible to a family (for 200-cap enforcement, FR).
 *
 * Counts ALL custom categories (family_id = $1 AND is_built_in = false),
 * including archived. Built-in (family_id IS NULL) excluded.
 *
 * Caller MUST hold `pg_advisory_xact_lock(hashtext($familyId))` within
 * the same transaction to prevent race conditions on concurrent creates.
 */
export async function countCustomCategoriesByFamily(
  familyId: string,
): Promise<number> {
  const rows = await db
    .select({ c: count() })
    .from(category)
    .where(
      and(
        eq(category.familyId, familyId),
        eq(category.isBuiltIn, false),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}

/**
 * Find single category by id. No family filter here (cross-family check
 * happens at procedure layer, US5 T030, to return 404 not-exist for
 * privacy).
 *
 * Returns null if not found.
 */
export async function findCategoryById(id: string): Promise<Category | null> {
  const rows = await db
    .select()
    .from(category)
    .where(eq(category.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ─── 018 US1: Create ────────────────────────────────────────────────

/**
 * Per-family custom category hard cap (FR assumption + research.md D7).
 * Includes archived categories. Exceeding → BAD_REQUEST.
 */
const CUSTOM_CATEGORY_CAP = 200;

export interface CreateCategoryInput {
  type: CategoryType;
  name: string;
  icon: string;
  familyId: string;
  actorMemberId: string;
  parentId?: string;
  sortOrder?: number;
}

/**
 * Create a custom category within a family.
 *
 * Atomic transaction:
 *   1. pg_advisory_xact_lock(hashtext(familyId)) — race-safe 200-cap check
 *   2. Count existing custom < 200 (else BAD_REQUEST)
 *   3. If parentId provided:
 *      - parent exists (else BAD_REQUEST)
 *      - parent.familyId == current OR parent.isBuiltIn (else BAD_REQUEST cross-family)
 *      - parent.parentId IS NULL (else BAD_REQUEST 3rd level)
 *      - parent.type == child.type (else BAD_REQUEST type-mismatch)
 *   4. INSERT category (id=uuidv7, isBuiltIn=false, archivedAt=null)
 *   5. writeCategoryEvent(category_created, after=snapshot)
 *
 * Duplicate name → DB unique index throws → wrapped into TRPCError CONFLICT.
 *
 * Returns the created Category row.
 */
export async function createCategory(
  input: CreateCategoryInput,
): Promise<Category> {
  return withTransaction(async (tx) => {
    // 1. Family-level advisory lock (race-safe 200-cap)
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${input.familyId}))`,
    );

    // 2. Count check
    const countRows = await tx
      .select({ c: count() })
      .from(category)
      .where(
        and(
          eq(category.familyId, input.familyId),
          eq(category.isBuiltIn, false),
        ),
      );
    const current = Number(countRows[0]?.c ?? 0);
    if (current >= CUSTOM_CATEGORY_CAP) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `自定义分类数已达上限 ${CUSTOM_CATEGORY_CAP}`,
      });
    }

    // 3. parentId validation
    if (input.parentId) {
      const parentRows = await tx
        .select()
        .from(category)
        .where(eq(category.id, input.parentId))
        .limit(1);
      const parent = parentRows[0];
      if (!parent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "父分类不存在",
        });
      }
      // Cross-family check (built-in has familyId=null, OK as parent)
      if (parent.familyId !== null && parent.familyId !== input.familyId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "不能使用其他家庭的分类作为父分类",
        });
      }
      // Depth check (parent itself must be top-level)
      if (parent.parentId !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "二级分类下不可再建子分类 (最多 2 层)",
        });
      }
      // Type match (FR-005(d))
      if (parent.type !== input.type) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "子分类 type 必须与父一致",
        });
      }
    }

    // 4. INSERT
    const id = uuidv7();
    const now = new Date();
    const newRow: typeof category.$inferInsert = {
      id,
      name: input.name,
      type: input.type,
      icon: input.icon,
      sortOrder: input.sortOrder ?? 100,
      isBuiltIn: false,
      familyId: input.familyId,
      parentId: input.parentId ?? null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    let inserted: Category;
    try {
      const rows = await tx.insert(category).values(newRow).returning();
      inserted = rows[0];
    } catch (err: unknown) {
      // PostgreSQL unique-constraint violation code = 23505
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "23505"
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "同级下分类名已存在",
        });
      }
      throw err;
    }
    if (!inserted) {
      throw new Error("Failed to insert category");
    }

    // 5. Audit
    const afterSnapshot: CategoryMutationSnapshot = {
      name: inserted.name,
      icon: inserted.icon,
      sortOrder: inserted.sortOrder,
      parentId: inserted.parentId,
      type: inserted.type,
      archivedAt: inserted.archivedAt
        ? inserted.archivedAt.toISOString()
        : null,
    };
    await writeCategoryEvent(tx, {
      eventType: "category_created",
      categoryId: inserted.id,
      actorMemberId: input.actorMemberId,
      before: null,
      after: afterSnapshot,
    });

    return inserted;
  });
}
