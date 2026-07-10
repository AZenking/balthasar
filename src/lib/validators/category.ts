/**
 * Category form validators (023-category-ui T005).
 *
 * Shared zod schemas for create/edit category forms. Mirrors 018 backend
 * procedure input schemas (src/server/api/routers/category.ts) so client
 * and server agree on field constraints.
 */
import { z } from "zod";
import { CATEGORY_EMOJI_SET } from "@/lib/constants/category-emojis";

export const categoryTypeSchema = z.enum(["income", "expense"]);

const nameSchema = z
  .string()
  .trim()
  .min(1, "分类名不能为空")
  .max(30, "不能超过 30 字");

const iconSchema = z.string().refine((v) => CATEGORY_EMOJI_SET.has(v), {
  message: "icon 必须来自内置 emoji 库白名单",
});

export const categoryCreateSchema = z
  .object({
    type: categoryTypeSchema,
    name: nameSchema,
    icon: iconSchema,
    parentId: z.string().uuid().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();

export const categoryUpdateSchema = z
  .object({
    id: z.string().uuid(),
    name: nameSchema.optional(),
    icon: iconSchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
    parentId: z.union([z.string().uuid(), z.null()]).optional(),
    type: categoryTypeSchema.optional(),
  })
  .strict();

export type CategoryCreateValues = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateValues = z.infer<typeof categoryUpdateSchema>;
export type CategoryFormValues = CategoryCreateValues;
