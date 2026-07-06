import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { router, protectedProcedure } from "@/server/api/trpc";
import { db, withTransaction, type TxClient } from "@/server/db/client";
import { account } from "@/server/db/schema";
import { loadFamilyAndMemberIdsByUserId, loadFamilyIdByUserId } from "@/server/db/queries/account";
import { writeAccountEvent } from "@/server/db/queries/account-events";
import {
  SUPPORTED_CURRENCIES,
  type Currency,
} from "@/server/domain/account/currency";
import {
  validateAccountName,
  validateInitialBalance,
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_NAME_MIN_LENGTH,
} from "@/server/domain/account/validate";

/**
 * Account router (002-account). 5 procedures:
 *   - create      (US1)  create account + audit
 *   - list        (US2)  list accounts (default excludes archived)
 *   - update      (US3)  edit name/currency (NOT initialBalance)
 *   - archive     (US4)  soft-delete (idempotent)
 *   - unarchive   (US4)  restore (idempotent)
 *
 * Phase 3 (US1) implements `create` only. US2/3/4 procedures are added
 * in subsequent phases.
 */

const currencySchema = z.enum(SUPPORTED_CURRENCIES);

const createInput = z.object({
  name: z
    .string()
    .min(ACCOUNT_NAME_MIN_LENGTH, "账户名称不能为空")
    .max(ACCOUNT_NAME_MAX_LENGTH, `账户名称不能超过 ${ACCOUNT_NAME_MAX_LENGTH} 字`),
  currency: currencySchema,
  initialBalance: z.number().refine((v) => validateInitialBalance(v).ok, {
    message: "初始余额必须是整数且在安全范围内",
  }),
  // NOTE: familyId is intentionally NOT in input schema. Server-derived
  // from ctx.session.user.id via loadFamilyAndMemberIdsByUserId (FR-006).
});

/**
 * Sanitize account row for procedure response — strips internal fields
 * the client shouldn't see and ensures archivedAt is null|Date.
 */
function serializeAccount(row: typeof account.$inferSelect) {
  return {
    id: row.id,
    familyId: row.familyId,
    name: row.name,
    currency: row.currency as Currency,
    initialBalance: row.initialBalance,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const accountRouter = router({
  /**
   * US1: Create account.
   *
   * Server derives familyId + memberId from session. Single db.transaction
   * writes account + account_created audit (research.md Q6 atomicity).
   */
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      // Extra domain validation (zod schema delegates most checks; this is
      // defense-in-depth for any edge cases zod misses, e.g. Unicode length)
      const nameCheck = validateAccountName(input.name);
      if (!nameCheck.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: nameCheck.reason === "too_short"
            ? "账户名称不能为空"
            : `账户名称不能超过 ${ACCOUNT_NAME_MAX_LENGTH} 字`,
        });
      }

      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id
      );

      const created = await withTransaction(async (tx) => {
        const [row] = await tx
          .insert(account)
          .values({
            familyId,
            name: input.name,
            currency: input.currency,
            initialBalance: input.initialBalance,
          })
          .returning();

        if (!row) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "账户创建失败",
          });
        }

        await writeAccountEvent(tx, {
          eventType: "account_created",
          accountId: row.id,
          actorMemberId: memberId,
          before: null,
          after: {
            name: row.name,
            currency: row.currency,
            initialBalance: row.initialBalance,
          },
        });

        return row;
      });

      return serializeAccount(created);
    }),

  /**
   * US2: List accounts.
   *
   * Default excludes archived (uses partial index `accounts_family_active_idx`).
   * Pass `{ includeArchived: true }` to include all (uses `accounts_family_idx`).
   * Always scoped to current family via WHERE family_id = $currentFamilyId
   * (SC-003 cross-family isolation).
   * Sort: createdAt DESC (newest first).
   */
  list: protectedProcedure
    .input(z.object({ includeArchived: z.boolean().optional() }).strict())
    .query(async ({ input, ctx }) => {
      const familyId = await loadFamilyIdByUserId(ctx.session.user.id);

      const conditions = [eq(account.familyId, familyId)];
      if (!input?.includeArchived) {
        // Default: filter out archived. PG partial index makes this fast.
        conditions.push(isNull(account.archivedAt));
      }

      const rows = await db
        .select()
        .from(account)
        .where(and(...conditions))
        .orderBy(desc(account.createdAt));

      return rows.map(serializeAccount);
    }),
});

export type AccountRouter = typeof accountRouter;

// Re-exports for use in US2/3/4 procedures (later phases)
export {
  db,
  type TxClient,
  withTransaction,
  and,
  desc,
  eq,
  isNull,
  account,
  TRPCError,
  type Currency,
};
