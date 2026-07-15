import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import {
  findAllCategories,
  findCategoryById,
  createCategory,
  updateCategory,
  reorderCategories,
  archiveCategory,
  unarchiveCategory,
} from "@/server/db/queries/category";
import { loadFamilyAndMemberIdsByUserId } from "@/server/db/queries/account";
import { buildCategoryTree } from "@/server/domain/category/rules";
import { isCategoryIcon } from "@/lib/constants/category-icons";
import { categoryType } from "@/server/db/schema";

/**
 * Category router.
 *
 * 003: list + get (built-in dictionary, read-only).
 * 018 (US1): + create (custom categories within family scope).
 *
 * Subsequent USes will add update / archive / unarchive / reorder.
 */
const typeSchema = z.enum(categoryType.enumValues);

/**
 * FR-004: icon MUST be in shared icon name whitelist.
 * Frontend + backend import same constant file (028-category-lucide-icons).
 */
const iconSchema = z
  .string()
  .refine((v) => isCategoryIcon(v), {
    message: "图标必须来自内置图标库",
  });

/**
 * FR-003: name 1-30 chars after trim. Trim happens here (zod transform)
 * so DB only sees the canonical form (matches spec edge case "餐饮 " ≡ "餐饮").
 */
const nameSchema = z
  .string()
  .trim()
  .min(1, "分类名不能为空")
  .max(30, "分类名不能超过 30 字");

/**
 * FR-005: parentId validation (depth + cross-family + type-match) happens
 * in createCategory query. zod just verifies it's a UUID if provided.
 */
const parentIdSchema = z.string().uuid().optional();

const createInputSchema = z
  .object({
    type: typeSchema,
    name: nameSchema,
    icon: iconSchema,
    parentId: parentIdSchema,
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict(); // FR-001: reject client-supplied familyId/isBuiltIn/etc.

export const categoryRouter = router({
  // ─── 003 + 018 US4: list (built-in + custom, hierarchical) ───────
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(["income", "expense"]).optional(),
          parentId: z.string().uuid().optional(),
          includeArchived: z.boolean().optional(),
        })
        .strict()
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const { familyId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id,
      );
      const flat = await findAllCategories({
        familyId,
        type: input?.type,
        includeArchived: input?.includeArchived,
        parentId: input?.parentId,
      });

      // parentId mode: flat list (no nesting). Otherwise: hierarchical tree.
      if (input?.parentId) {
        return flat;
      }
      return buildCategoryTree(flat);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .query(async ({ input, ctx }) => {
      const { familyId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id,
      );
      const row = await findCategoryById(input.id);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "分类不存在",
        });
      }
      // FR-023: cross-family access → 404 (don't expose existence)
      // Built-in (isBuiltIn=true, familyId=null) is visible to all families.
      if (!row.isBuiltIn && row.familyId !== familyId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "分类不存在",
        });
      }
      return row;
    }),

  // ─── 018 US1: create custom category ─────────────────────────────
  create: protectedProcedure
    .input(createInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id,
      );
      return createCategory({
        type: input.type,
        name: input.name,
        icon: input.icon,
        familyId,
        actorMemberId: memberId,
        parentId: input.parentId,
        sortOrder: input.sortOrder,
      });
    }),

  // ─── 018 US2: update custom category ─────────────────────────────
  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          name: nameSchema.optional(),
          icon: iconSchema.optional(),
          sortOrder: z.number().int().min(0).optional(),
          parentId: z.union([z.string().uuid(), z.null()]).optional(),
          type: typeSchema.optional(),
        })
        .strict(),
    )
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id,
      );
      return updateCategory({
        id: input.id,
        familyId,
        actorMemberId: memberId,
        name: input.name,
        icon: input.icon,
        sortOrder: input.sortOrder,
        parentId: input.parentId,
        type: input.type,
      });
    }),

  // ─── 018 US2: reorder (batch, atomic, FR-031(d)) ─────────────────
  reorder: protectedProcedure
    .input(
      z
        .object({
          items: z
            .array(
              z.object({
                id: z.string().uuid(),
                sortOrder: z.number().int().min(0),
              }),
            )
            .min(1, "items 不能为空")
            .max(200, "items 不能超过 200"),
        })
        .strict(),
    )
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id,
      );
      return reorderCategories({
        items: input.items,
        familyId,
        actorMemberId: memberId,
      });
    }),

  // ─── 018 US3: archive (cascade to children) ──────────────────────
  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id,
      );
      return archiveCategory({
        id: input.id,
        familyId,
        actorMemberId: memberId,
      });
    }),

  // ─── 018 US3: unarchive (强制级联复活所有子,Clarify Q2) ─────────
  unarchive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id,
      );
      return unarchiveCategory({
        id: input.id,
        familyId,
        actorMemberId: memberId,
      });
    }),
});

export type CategoryRouter = typeof categoryRouter;
