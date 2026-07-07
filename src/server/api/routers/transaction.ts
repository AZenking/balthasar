import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { db, withTransaction } from "@/server/db/client";
import { loadFamilyAndMemberIdsByUserId } from "@/server/db/queries/account";
import {
  validateAccountAndCategory,
  insertTransaction,
  getTransactionById,
  listTransactions,
  getTransactionSummary,
  findTransactionForUpdate,
  serializeTransaction,
  type TransactionFilters,
} from "@/server/db/queries/transaction";
import { writeTransactionEvent } from "@/server/db/queries/transaction-events";
import {
  applySign,
  validateOccurredAt,
  validateRemark,
  REMARK_MAX_LENGTH,
} from "@/server/domain/transaction/validate";
import { transactionType } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { transaction } from "@/server/db/schema";

/**
 * Transaction router (004-transaction) — 5 procedures:
 *   - create: signed amount + validate account/category + audit
 *   - get: JOIN account/category, 404 if cross-family
 *   - list: cursor pagination, occurredAt DESC
 *   - update: LWW, type change revalidates categoryId
 *   - delete: hard delete, audit survives via SET NULL FK
 */
const typeSchema = z.enum(["income", "expense"]);

const createInput = z.object({
  type: typeSchema,
  accountId: z.string().uuid(),
  categoryId: z.string().uuid(),
  amount: z.number().int().positive("金额必须 > 0"),
  remark: z.string().max(REMARK_MAX_LENGTH).optional(),
  occurredAt: z.string().datetime().optional(),
});

export const transactionRouter = router({
  /**
   * US1: Create transaction.
   * Server derives familyId, applies sign to amount, validates account+category,
   * writes transaction + audit in same db.transaction.
   */
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id
      );

      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
      const occurredCheck = validateOccurredAt(occurredAt);
      if (!occurredCheck.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "交易日期不能是未来日期",
        });
      }

      const remark = input.remark ?? "";
      const remarkCheck = validateRemark(remark);
      if (!remarkCheck.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `备注不能超过 ${REMARK_MAX_LENGTH} 字`,
        });
      }

      const signedAmount = applySign(input.type, input.amount);

      const created = await withTransaction(async (tx) => {
        // Short-circuit validation chain (research.md Q2+Q6)
        await validateAccountAndCategory(tx, {
          accountId: input.accountId,
          categoryId: input.categoryId,
          familyId,
          type: input.type,
        });

        const row = await insertTransaction(tx, {
          familyId,
          type: input.type,
          accountId: input.accountId,
          categoryId: input.categoryId,
          amount: signedAmount,
          remark,
          occurredAt,
        });

        await writeTransactionEvent(tx, {
          eventType: "transaction_created",
          transactionId: row.id,
          actorMemberId: memberId,
          before: null,
          after: {
            type: row.type,
            accountId: row.accountId,
            categoryId: row.categoryId,
            amount: row.amount,
            remark: row.remark,
            occurredAt: row.occurredAt.toISOString(),
          },
        });

        return row;
      });

      // Fetch with JOINs for response
      const full = await getTransactionById({ id: created.id, familyId });
      if (!full) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "交易创建后查询失败",
        });
      }
      return serializeTransaction(full);
    }),

  /**
   * US2: Get transaction by id (with JOIN).
   * Cross-family → NOT_FOUND (FR-014).
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .query(async ({ input, ctx }) => {
      const familyId = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id
      ).then((r) => r.familyId);

      const row = await getTransactionById({ id: input.id, familyId });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "交易不存在",
        });
      }
      return serializeTransaction(row);
    }),

  /**
   * US2: List transactions (cursor pagination).
   */
  list: protectedProcedure
    .input(
      z
        .object({
          // 004 basic
          limit: z.number().int().min(1).max(100).default(50),
          cursor: z.string().datetime().optional(),
          // 005 filters
          type: z.enum(["income", "expense"]).optional(),
          accountId: z.string().uuid().optional(),
          categoryId: z.string().uuid().optional(),
          startDate: z.string().datetime().optional(),
          endDate: z.string().datetime().optional(),
          keyword: z.string().max(200).optional(),
          // 005 summary
          includeSummary: z.boolean().default(false),
        })
        .strict()
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const familyId = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id
      ).then((r) => r.familyId);

      const filters: TransactionFilters | undefined = input?.type ||
      input?.accountId ||
      input?.categoryId ||
      input?.startDate ||
      input?.endDate ||
      input?.keyword
        ? {
            type: input.type,
            accountId: input.accountId,
            categoryId: input.categoryId,
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            endDate: input.endDate ? new Date(input.endDate) : undefined,
            keyword: input.keyword,
          }
        : undefined;

      const result = await listTransactions({
        familyId,
        limit: input?.limit ?? 50,
        cursor: input?.cursor ? new Date(input.cursor) : undefined,
        filters,
      });

      const response: {
        items: ReturnType<typeof serializeTransaction>[];
        nextCursor: string | null;
        summary?: { income: number; expense: number; net: number };
      } = {
        items: result.items.map(serializeTransaction),
        nextCursor: result.nextCursor,
      };

      if (input?.includeSummary) {
        response.summary = await getTransactionSummary({ familyId, filters });
      }

      return response;
    }),

  /**
   * US3: Update transaction (LWW, no version field).
   */
  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          type: typeSchema.optional(),
          accountId: z.string().uuid().optional(),
          categoryId: z.string().uuid().optional(),
          amount: z.number().int().positive().optional(),
          remark: z.string().max(REMARK_MAX_LENGTH).optional(),
          occurredAt: z.string().datetime().optional(),
        })
        .strict()
        .refine(
          (v) =>
            v.type !== undefined ||
            v.accountId !== undefined ||
            v.categoryId !== undefined ||
            v.amount !== undefined ||
            v.remark !== undefined ||
            v.occurredAt !== undefined,
          { message: "至少需要修改一个字段" }
        )
    )
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id
      );

      const updated = await withTransaction(async (tx) => {
        const existing = await findTransactionForUpdate(tx, {
          id: input.id,
          familyId,
        });
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "交易不存在",
          });
        }

        const before = {
          type: existing.type,
          accountId: existing.accountId,
          categoryId: existing.categoryId,
          amount: existing.amount,
          remark: existing.remark,
          occurredAt: existing.occurredAt.toISOString(),
        };

        const newType = input.type ?? existing.type;
        const newAccountId = input.accountId ?? existing.accountId;
        const newCategoryId = input.categoryId ?? existing.categoryId;
        const newAmount =
          input.amount !== undefined
            ? applySign(newType, input.amount)
            : existing.amount;
        const newRemark = input.remark ?? existing.remark;
        const newOccurredAt = input.occurredAt
          ? new Date(input.occurredAt)
          : existing.occurredAt;

        // Revalidate account+category if either changed
        if (input.accountId || input.categoryId || input.type) {
          await validateAccountAndCategory(tx, {
            accountId: newAccountId,
            categoryId: newCategoryId,
            familyId,
            type: newType,
          });
        }

        const after = {
          type: newType,
          accountId: newAccountId,
          categoryId: newCategoryId,
          amount: newAmount,
          remark: newRemark,
          occurredAt: newOccurredAt.toISOString(),
        };

        const [updatedRow] = await tx
          .update(transaction)
          .set({
            type: newType,
            accountId: newAccountId,
            categoryId: newCategoryId,
            amount: newAmount,
            remark: newRemark,
            occurredAt: newOccurredAt,
          })
          .where(eq(transaction.id, input.id))
          .returning();

        if (!updatedRow) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "交易更新失败",
          });
        }

        await writeTransactionEvent(tx, {
          eventType: "transaction_edited",
          transactionId: updatedRow.id,
          actorMemberId: memberId,
          before,
          after,
        });

        return updatedRow;
      });

      const full = await getTransactionById({ id: updated.id, familyId });
      return serializeTransaction(full!);
    }),

  /**
   * US4: Delete transaction (hard delete).
   * Audit survives via FK ON DELETE SET NULL (F1 fix).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id
      );

      await withTransaction(async (tx) => {
        const existing = await findTransactionForUpdate(tx, {
          id: input.id,
          familyId,
        });
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "交易不存在",
          });
        }

        // Write audit BEFORE delete (research.md Q4, before=snapshot, after=null)
        await writeTransactionEvent(tx, {
          eventType: "transaction_deleted",
          transactionId: existing.id,
          actorMemberId: memberId,
          before: {
            type: existing.type,
            accountId: existing.accountId,
            categoryId: existing.categoryId,
            amount: existing.amount,
            remark: existing.remark,
            occurredAt: existing.occurredAt.toISOString(),
          },
          after: null,
        });

        await tx.delete(transaction).where(eq(transaction.id, input.id));
      });

      return { success: true as const };
    }),
});

export type TransactionRouter = typeof transactionRouter;
