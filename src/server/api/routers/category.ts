import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { findAllCategories, findCategoryById } from "@/server/db/queries/category";

/**
 * Category router (003-category) — read-only dictionary.
 *
 * 2 procedures:
 *   - list: optional type filter, sortOrder ASC + name ASC
 *   - get:  by id, throws NOT_FOUND if missing
 *
 * MVP invariant: 22 built-in categories shared across all families (no
 * family_id field). No CRUD, no audit table (unlike 002-account).
 *
 * Per F3 fix: NO formatCategoryForDisplay helper — frontend inlines
 * `${icon} ${name}` itself.
 */
export const categoryRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(["income", "expense"]).optional(),
        })
        .strict()
        .optional()
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
});

export type CategoryRouter = typeof categoryRouter;
