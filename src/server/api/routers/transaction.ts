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
  validateTransfer,
  validateOccurredAt,
  validateRemark,
  REMARK_MAX_LENGTH,
} from "@/server/domain/transaction/validate";
import { transactionType } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { transaction, account } from "@/server/db/schema";

/**
 * Transaction router (004-transaction) — 5 procedures:
 *   - create: signed amount + validate account/category + audit
 *   - get: JOIN account/category, 404 if cross-family
 *   - list: cursor pagination, occurredAt DESC
 *   - update: LWW, type change revalidates categoryId
 *   - delete: hard delete, audit survives via SET NULL FK
 */
const typeSchema = z.enum(["income", "expense", "transfer"]);

// 027 US4 (M3 决策):transfer 交易强制引用此系统内置"转账"分类 id。
// UUID v5 由 "expense:转账" 派生(见 migration 0006 seed)。categoryId NOT NULL
// 保持不变(026),transfer 用此 id 满足约束。
const TRANSFER_CATEGORY_ID = "6206a8ba-b706-51ee-ace0-39299f1e39d5";

// 027 US4 (C2 决策):退款 = type='expense' + isRefund=true,procedure 跳过
// applySign、直接存 +abs(amount)。applySign 函数本身不改。
const createInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("income"),
    accountId: z.string().uuid(),
    categoryId: z.string().uuid(),
    amount: z.number().int().positive("金额必须 > 0"),
    remark: z.string().max(REMARK_MAX_LENGTH).optional(),
    occurredAt: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal("expense"),
    accountId: z.string().uuid(),
    categoryId: z.string().uuid(),
    amount: z.number().int().positive("金额必须 > 0"),
    isRefund: z.boolean().default(false), // C2: 退款标志
    remark: z.string().max(REMARK_MAX_LENGTH).optional(),
    occurredAt: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal("transfer"),
    accountId: z.string().uuid(), // 转出账户
    toAccountId: z.string().uuid(), // 转入账户(MUST !== accountId)
    amount: z.number().int().positive("金额必须 > 0"),
    remark: z.string().max(REMARK_MAX_LENGTH).optional(),
    occurredAt: z.string().datetime().optional(),
    // transfer 无需 categoryId —— procedure 强制用 TRANSFER_CATEGORY_ID(M3)
  }),
]);

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

      // 027 US4:按 type 分派金额符号 / toAccountId / categoryId。
      // - income/expense:applySign 取符号;退款(expense+isRefund)跳过 applySign
      //   存 +abs(C2 决策);categoryId 用客户端传入。
      // - transfer:applySign 返回 +abs(research R1);强制 categoryId =
      //   TRANSFER_CATEGORY_ID(M3);toAccountId 必填且 !== accountId(FR-014)。
      let signedAmount: number;
      let toAccountId: string | null = null;
      let categoryId: string;
      if (input.type === "transfer") {
        const transferCheck = validateTransfer(input.accountId, input.toAccountId);
        if (!transferCheck.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "转出账户与转入账户不能相同",
          });
        }
        signedAmount = applySign("transfer", input.amount);
        toAccountId = input.toAccountId;
        categoryId = TRANSFER_CATEGORY_ID;
      } else if (input.type === "expense" && input.isRefund) {
        // C2:退款跳过 applySign,存 +abs(冲减原支出分类)。
        signedAmount = Math.abs(input.amount);
        categoryId = input.categoryId;
      } else {
        signedAmount = applySign(input.type, input.amount);
        categoryId = input.categoryId;
      }

      const created = await withTransaction(async (tx) => {
        // 027 US4:transfer 用内置"转账"分类(type=expense),与 transaction
        // type=transfer 不匹配。validateAccountAndCategory 的 category-type 检查
        // 对 transfer 跳过 —— transfer 的分类由 server 强制(M3),无需客户端匹配。
        if (input.type === "transfer") {
          // 仅校验转出账户(复用 validateAccountAndCategory 的账户校验,但传
          // type=expense 让内置转账分类通过;categoryId 已是 TRANSFER_CATEGORY_ID)。
          await validateAccountAndCategory(tx, {
            accountId: input.accountId,
            categoryId,
            familyId,
            type: "expense", // 内置转账分类是 expense 型;type-match 用 expense
          });
        } else {
          await validateAccountAndCategory(tx, {
            accountId: input.accountId,
            categoryId,
            familyId,
            type: input.type,
          });
        }

        // transfer:额外校验转入账户(toAccountId)同 family + 未归档。
        if (toAccountId) {
          const toAccount = await tx
            .select({ id: account.id, familyId: account.familyId, archivedAt: account.archivedAt })
            .from(account)
            .where(eq(account.id, toAccountId))
            .limit(1);
          const toRow = toAccount[0];
          if (!toRow || toRow.familyId !== familyId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "转入账户不存在" });
          }
          if (toRow.archivedAt) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "转入账户已归档" });
          }
        }

        const row = await insertTransaction(tx, {
          familyId,
          type: input.type,
          accountId: input.accountId,
          toAccountId,
          categoryId,
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
            toAccountId: row.toAccountId,
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
          type: z.enum(["income", "expense", "transfer"]).optional(),
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
