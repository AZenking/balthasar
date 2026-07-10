import "server-only";
import { db, withTransaction } from "@/server/db/client";
import {
  category,
  transaction,
  type Category,
  type CategoryType,
  type CategoryMutationSnapshot,
} from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { uuidv7 } from "uuidv7";
import { and, count, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { writeCategoryEvent, writeCategoryEventsBatch } from "@/server/db/queries/category-events";

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

// ─── 018 US2: Update + Reorder ─────────────────────────────────────

export interface UpdateCategoryInput {
  id: string;
  familyId: string;
  actorMemberId: string;
  name?: string;
  icon?: string;
  sortOrder?: number;
  parentId?: string | null; // null = demote to top-level; undefined = no change
  type?: CategoryType;
}

/**
 * Snapshot helper for audit before/after.
 */
function snapshot(c: Category): CategoryMutationSnapshot {
  return {
    name: c.name,
    icon: c.icon,
    sortOrder: c.sortOrder,
    parentId: c.parentId,
    type: c.type,
    archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
  };
}

/**
 * Update a custom category (FR-008..FR-014).
 *
 * Atomic transaction:
 *   1. SELECT FOR UPDATE the target row
 *   2. isBuiltIn → 403; family mismatch → 404
 *   3. If archived (archivedAt !== null): only name/icon/sortOrder editable
 *      (FR-014). type/parentId changes → 400.
 *   4. type change (FR-013): reject if has transactions OR has children
 *      OR archived (redundant with #3 but defensive)
 *   5. parentId change (FR-010): reject if has children (would create 3rd
 *      level via demotion). New parent validation (FR-005):
 *      exists / same family or built-in / top-level / type-match /
 *      no self-cycle.
 *   6. name change → check uniqueness (excluding self)
 *   7. UPDATE + writeCategoryEvent(category_edited, before/after)
 *
 * LWW (Last-Write-Wins, no version field) — matches 004 transaction pattern.
 */
export async function updateCategory(
  input: UpdateCategoryInput,
): Promise<Category> {
  return withTransaction(async (tx) => {
    // 1. SELECT FOR UPDATE
    const targetRows = await tx
      .select()
      .from(category)
      .where(eq(category.id, input.id))
      .limit(1);
    const target = targetRows[0];
    if (!target) {
      throw new TRPCError({ code: "NOT_FOUND", message: "分类不存在" });
    }
    // 2. isBuiltIn / family
    if (target.isBuiltIn) {
      throw new TRPCError({ code: "FORBIDDEN", message: "内置分类不可编辑" });
    }
    if (target.familyId !== input.familyId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "分类不存在" });
    }

    const before = snapshot(target);

    // 3. archived limitations (FR-014)
    const isArchived = target.archivedAt !== null;
    if (isArchived && (input.type !== undefined || input.parentId !== undefined)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "已归档分类不可修改 type 或 parentId",
      });
    }

    // 4. type change restrictions (FR-013)
    if (input.type !== undefined && input.type !== target.type) {
      // (a) has transactions referencing this category
      const txCountRows = await tx
        .select({ c: count() })
        .from(transaction)
        .where(eq(transaction.categoryId, input.id));
      if (Number(txCountRows[0]?.c ?? 0) > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "已被交易引用的分类不可切换 type",
        });
      }
      // (b) has children
      const childCountRows = await tx
        .select({ c: count() })
        .from(category)
        .where(eq(category.parentId, input.id));
      if (Number(childCountRows[0]?.c ?? 0) > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "已有子分类的分类不可切换 type",
        });
      }
    }

    // 5. parentId change (FR-010 + FR-005)
    const parentIdChanging =
      input.parentId !== undefined && input.parentId !== target.parentId;
    if (parentIdChanging) {
      // Has children? Can't demote (would create 3rd level)
      const childCountRows = await tx
        .select({ c: count() })
        .from(category)
        .where(eq(category.parentId, input.id));
      if (Number(childCountRows[0]?.c ?? 0) > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "已有子分类的分类不可变为二级",
        });
      }

      // New parent validation
      if (input.parentId !== null && input.parentId !== undefined) {
        if (input.parentId === input.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "parentId 不可指向自己 (循环引用)",
          });
        }
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
        if (parent.familyId !== null && parent.familyId !== input.familyId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "不能使用其他家庭的分类作为父分类",
          });
        }
        if (parent.parentId !== null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "二级分类下不可再建子分类 (最多 2 层)",
          });
        }
        // type-match: if user is changing both type and parent, the new type
        // must match parent.type. If only changing parent, target.type must
        // match parent.type.
        const effectiveType = input.type ?? target.type;
        if (parent.type !== effectiveType) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "子分类 type 必须与父一致",
          });
        }
      }
    }

    // 6. name uniqueness (if changing name)
    if (input.name !== undefined && input.name !== target.name) {
      const effectiveType = input.type ?? target.type;
      const effectiveParentId = input.parentId ?? target.parentId;
      const parentIdCond =
        effectiveParentId === null
          ? isNull(category.parentId)
          : eq(category.parentId, effectiveParentId);
      const dupRows = await tx
        .select({ id: category.id })
        .from(category)
        .where(
          and(
            eq(category.familyId, input.familyId),
            eq(category.type, effectiveType),
            parentIdCond,
            sql`LOWER(${category.name}) = LOWER(${input.name})`,
            ne(category.id, input.id),
          ),
        )
        .limit(1);
      if (dupRows.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "同级下分类名已存在",
        });
      }
    }

    // 7. UPDATE
    const updates: Partial<typeof category.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.icon !== undefined) updates.icon = input.icon;
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
    if (input.parentId !== undefined) updates.parentId = input.parentId;
    if (input.type !== undefined) updates.type = input.type;
    updates.updatedAt = new Date();

    const updatedRows = await tx
      .update(category)
      .set(updates)
      .where(eq(category.id, input.id))
      .returning();
    const updated = updatedRows[0];
    if (!updated) {
      throw new Error("Failed to update category");
    }

    await writeCategoryEvent(tx, {
      eventType: "category_edited",
      categoryId: updated.id,
      actorMemberId: input.actorMemberId,
      before,
      after: snapshot(updated),
    });

    return updated;
  });
}

// ─── 018 US2: Reorder (batch, atomic) ──────────────────────────────

export interface ReorderItem {
  id: string;
  sortOrder: number;
}

export interface ReorderCategoryInput {
  items: ReorderItem[];
  familyId: string;
  actorMemberId: string;
}

/**
 * Batch-reorder sibling categories atomically (FR-031(d)).
 *
 * Single transaction:
 *   1. SELECT FOR UPDATE all target rows
 *   2. Validate: all isBuiltIn=false (else 403), all familyId=current
 *      (else 404), all same parentId (else 400 "reorder 仅支持同级"),
 *      items sortOrder unique within array (else 400)
 *   3. UPDATE × N + writeCategoryEventsBatch (before/after only sortOrder)
 *
 * Failed validation or any DB error → full rollback (FR-031(d) atomicity).
 *
 * Use case: frontend drag-drop triggers renumber when integer gap exhausted.
 * Client computes new sortOrders via renumberSortOrders(count) then calls
 * this endpoint once.
 */
export async function reorderCategories(
  input: ReorderCategoryInput,
): Promise<{ updated: string[] }> {
  if (input.items.length === 0) {
    return { updated: [] };
  }
  if (input.items.length > 200) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "reorder 单次最多 200 项",
    });
  }

  // items sortOrder unique?
  const sortOrderSet = new Set(input.items.map((i) => i.sortOrder));
  if (sortOrderSet.size !== input.items.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "items 内 sortOrder 必须唯一",
    });
  }

  const ids = input.items.map((i) => i.id);

  return withTransaction(async (tx) => {
    // 1. SELECT FOR UPDATE
    const rows = await tx
      .select()
      .from(category)
      .where(inArray(category.id, ids));
    if (rows.length !== ids.length) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "部分分类不存在",
      });
    }

    // 2. Validate all rows
    let sharedParentId: string | null | undefined;
    for (const row of rows) {
      if (row.isBuiltIn) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "内置分类不可重排",
        });
      }
      if (row.familyId !== input.familyId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "分类不存在",
        });
      }
      if (sharedParentId === undefined) {
        sharedParentId = row.parentId;
      } else if (sharedParentId !== row.parentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "reorder 仅支持同级分类",
        });
      }
    }

    // 3. UPDATE × N + audit batch
    const auditItems = [];
    const updated: string[] = [];
    for (const item of input.items) {
      const row = rows.find((r) => r.id === item.id)!;
      const before: Partial<CategoryMutationSnapshot> = {
        sortOrder: row.sortOrder,
      };
      const after: Partial<CategoryMutationSnapshot> = {
        sortOrder: item.sortOrder,
      };
      await tx
        .update(category)
        .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
        .where(eq(category.id, item.id));
      auditItems.push({
        eventType: "category_edited" as const,
        categoryId: item.id,
        before,
        after,
      });
      updated.push(item.id);
    }

    await writeCategoryEventsBatch(tx, auditItems, input.actorMemberId);

    return { updated };
  });
}

// ─── 018 US3: Archive + Unarchive (cascade) ────────────────────────

export interface ArchiveCategoryInput {
  id: string;
  familyId: string;
  actorMemberId: string;
}

/**
 * Archive a custom category, cascading to its children (FR-015..FR-018).
 *
 * Semantics (research.md D5 + Clarify Q2):
 *   - archive: cascade to children where archived_at IS NULL (idempotent —
 *     already-archived children keep their original archivedAt)
 *   - unarchive: 强制级联复活 ALL children (including independently-archived
 *     ones — user can re-archive manually if needed)
 *
 * Single transaction:
 *   1. SELECT FOR UPDATE parent (validate isBuiltIn=false / family match)
 *   2. SELECT children FOR UPDATE
 *   3. UPDATE parent + eligible children
 *   4. writeCategoryEventsBatch (1 + N events, before/after snapshots)
 *
 * Returns archivedChildren IDs (only those actually changed).
 */
export async function archiveCategory(
  input: ArchiveCategoryInput,
): Promise<{ archivedChildren: string[] }> {
  return withTransaction(async (tx) => {
    const parentRows = await tx
      .select()
      .from(category)
      .where(eq(category.id, input.id))
      .limit(1);
    const parent = parentRows[0];
    if (!parent) {
      throw new TRPCError({ code: "NOT_FOUND", message: "分类不存在" });
    }
    if (parent.isBuiltIn) {
      throw new TRPCError({ code: "FORBIDDEN", message: "内置分类不可归档" });
    }
    if (parent.familyId !== input.familyId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "分类不存在" });
    }

    // Children (only those not already archived — idempotent cascade)
    const children = await tx
      .select()
      .from(category)
      .where(
        and(
          eq(category.parentId, input.id),
          isNull(category.archivedAt),
        ),
      );
    const childIds = children.map((c) => c.id);

    const now = new Date();
    const beforeParent = snapshot(parent);
    const beforeChildren = children.map(snapshot);

    // UPDATE parent
    await tx
      .update(category)
      .set({ archivedAt: now, updatedAt: now })
      .where(eq(category.id, input.id));

    // UPDATE eligible children
    if (childIds.length > 0) {
      await tx
        .update(category)
        .set({ archivedAt: now, updatedAt: now })
        .where(
          and(
            eq(category.parentId, input.id),
            isNull(category.archivedAt),
          ),
        );
    }

    // Audit: 1 + N events
    const auditItems = [
      {
        eventType: "category_archived" as const,
        categoryId: parent.id,
        before: beforeParent,
        after: { ...beforeParent, archivedAt: now.toISOString() },
      },
      ...children.map((c, i) => ({
        eventType: "category_archived" as const,
        categoryId: c.id,
        before: beforeChildren[i],
        after: { ...beforeChildren[i], archivedAt: now.toISOString() },
      })),
    ];
    await writeCategoryEventsBatch(tx, auditItems, input.actorMemberId);

    return { archivedChildren: childIds };
  });
}

/**
 * Unarchive a custom category, 强制级联复活 ALL children (Clarify Q2).
 *
 * Unlike archive (which skips already-archived children), unarchive forces
 * all children to archived_at = NULL regardless of prior state. User can
 * re-archive specific children manually if needed.
 */
export async function unarchiveCategory(
  input: ArchiveCategoryInput,
): Promise<{ unarchivedChildren: string[] }> {
  return withTransaction(async (tx) => {
    const parentRows = await tx
      .select()
      .from(category)
      .where(eq(category.id, input.id))
      .limit(1);
    const parent = parentRows[0];
    if (!parent) {
      throw new TRPCError({ code: "NOT_FOUND", message: "分类不存在" });
    }
    if (parent.isBuiltIn) {
      throw new TRPCError({ code: "FORBIDDEN", message: "内置分类不可反归档" });
    }
    if (parent.familyId !== input.familyId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "分类不存在" });
    }

    // ALL children (regardless of archived state) — 强制级联复活
    const children = await tx
      .select()
      .from(category)
      .where(eq(category.parentId, input.id));
    const childIds = children.map((c) => c.id);

    const beforeParent = snapshot(parent);
    const beforeChildren = children.map(snapshot);

    // UPDATE parent
    await tx
      .update(category)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(category.id, input.id));

    // UPDATE ALL children (force resurrect)
    if (childIds.length > 0) {
      await tx
        .update(category)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(category.parentId, input.id));
    }

    // Audit: 1 + N events
    const auditItems = [
      {
        eventType: "category_unarchived" as const,
        categoryId: parent.id,
        before: beforeParent,
        after: { ...beforeParent, archivedAt: null },
      },
      ...children.map((c, i) => ({
        eventType: "category_unarchived" as const,
        categoryId: c.id,
        before: beforeChildren[i],
        after: { ...beforeChildren[i], archivedAt: null },
      })),
    ];
    await writeCategoryEventsBatch(tx, auditItems, input.actorMemberId);

    return { unarchivedChildren: childIds };
  });
}
