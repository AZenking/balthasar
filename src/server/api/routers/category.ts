import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import {
  findAllCategories,
  findCategoryById,
  createCategory,
} from "@/server/db/queries/category";
import { loadFamilyAndMemberIdsByUserId } from "@/server/db/queries/account";
import { isCategoryEmoji } from "@/server/domain/category/rules";
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
 * FR-004: icon MUST be in shared emoji whitelist.
 * Frontend + backend import same constant file (research.md D3).
 */
const iconSchema = z
  .string()
  .refine((v) => isCategoryEmoji(v), {
    message: "icon 必须来自内置 emoji 库白名单",
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
  // ─── 003 (unchanged): built-in dictionary read ───────────────────
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(["income", "expense"]).optional(),
        })
        .strict()
        .optional(),
    )
    .query(async ({ input }) => {
      return findAllCategories(input);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .query(async ({ input }) => {
      const row = await findCategoryById(input.id);
      if (!row) {
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
});

export type CategoryRouter = typeof categoryRouter;
