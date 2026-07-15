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
  // 027 US6:账户类型 asset(资产,默认)/ debt(负债)。
  type: z.enum(["asset", "debt"]).default("asset"),
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
    type: row.type, // 027 US6
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
            type: input.type, // 027 US6
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
    .input(z.object({ includeArchived: z.boolean().optional() }).strict().optional())
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

  /**
   * US3: Update account.
   *
   * Edits name and/or currency (FR-009). initialBalance MUST NOT be editable
   * (SC-007) — zod input schema intentionally excludes that field.
   *
   * Cross-family access returns NOT_FOUND (FR-012, SC-003) via single
   * WHERE id AND family_id query.
   *
   * Archived accounts cannot be edited (FR-011) — checked after fetch.
   *
   * Audit `account_edited` written in same tx as update, with before/after
   * snapshots of only mutable fields (name, currency).
   */
  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          name: z
            .string()
            .min(ACCOUNT_NAME_MIN_LENGTH)
            .max(ACCOUNT_NAME_MAX_LENGTH)
            .optional(),
          currency: currencySchema.optional(),
          type: z.enum(["asset", "debt"]).optional(), // 027 US6
        })
        .strict()
        // Require at least one mutable field
        .refine((v) => v.name !== undefined || v.currency !== undefined || v.type !== undefined, {
          message: "至少需要修改一个字段 (name、currency 或 type)",
        })
    )
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id
      );

      const updated = await withTransaction(async (tx) => {
        // Single query: WHERE id AND family_id (SC-003 cross-family isolation
        // via single WHERE clause — non-existent + cross-family both → 0 rows
        // → NOT_FOUND, no information leak about existence).
        const existing = await tx
          .select()
          .from(account)
          .where(and(eq(account.id, input.id), eq(account.familyId, familyId)))
          .limit(1);

        const row = existing[0];
        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "账户不存在",
          });
        }

        // FR-011: archived account cannot be edited
        if (row.archivedAt !== null) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "已归档账户不可编辑,请先取消归档",
          });
        }

        const before = {
          name: row.name,
          currency: row.currency,
          type: row.type, // 027 US6
        };
        const after = {
          name: input.name ?? row.name,
          currency: input.currency ?? row.currency,
          type: input.type ?? row.type, // 027 US6
        };

        const [updatedRow] = await tx
          .update(account)
          .set({
            name: after.name,
            currency: after.currency,
            type: after.type, // 027 US6
          })
          .where(eq(account.id, input.id))
          .returning();

        if (!updatedRow) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "账户更新失败",
          });
        }

        await writeAccountEvent(tx, {
          eventType: "account_edited",
          accountId: updatedRow.id,
          actorMemberId: memberId,
          before,
          after,
        });

        return updatedRow;
      });

      return serializeAccount(updated);
    }),

  /**
   * US4: Archive account (soft-delete).
   *
   * Sets archivedAt = now(). Idempotent: re-archiving already-archived
   * account returns 200 with unchanged archivedAt (SC-004).
   *
   * Cross-family access → NOT_FOUND (FR-012, SC-003).
   * Audit `account_archived` written on first archive only (idempotent skip).
   */
  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id
      );

      return withTransaction(async (tx) => {
        // Single WHERE id AND family_id (SC-003 cross-family isolation)
        const existing = await tx
          .select()
          .from(account)
          .where(and(eq(account.id, input.id), eq(account.familyId, familyId)))
          .limit(1);

        const row = existing[0];
        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "账户不存在",
          });
        }

        // Idempotent: already archived → return as-is, no audit
        if (row.archivedAt !== null) {
          return serializeAccount(row);
        }

        const now = new Date();
        const [updatedRow] = await tx
          .update(account)
          .set({ archivedAt: now })
          .where(eq(account.id, input.id))
          .returning();

        if (!updatedRow) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "归档失败",
          });
        }

        await writeAccountEvent(tx, {
          eventType: "account_archived",
          accountId: updatedRow.id,
          actorMemberId: memberId,
          // archive/unarchive events carry no payload (state transition only)
          before: null,
          after: null,
        });

        return serializeAccount(updatedRow);
      });
    }),

  /**
   * US4: Unarchive account (restore).
   *
   * Sets archivedAt = NULL. Idempotent: unarchiving non-archived account
   * returns 200 (SC-004).
   *
   * Cross-family access → NOT_FOUND (FR-012, SC-003).
   * Audit `account_unarchived` written on actual state transition only.
   */
  unarchive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(
        ctx.session.user.id
      );

      return withTransaction(async (tx) => {
        const existing = await tx
          .select()
          .from(account)
          .where(and(eq(account.id, input.id), eq(account.familyId, familyId)))
          .limit(1);

        const row = existing[0];
        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "账户不存在",
          });
        }

        // Idempotent: not archived → return as-is, no audit
        if (row.archivedAt === null) {
          return serializeAccount(row);
        }

        const [updatedRow] = await tx
          .update(account)
          .set({ archivedAt: null })
          .where(eq(account.id, input.id))
          .returning();

        if (!updatedRow) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "取消归档失败",
          });
        }

        await writeAccountEvent(tx, {
          eventType: "account_unarchived",
          accountId: updatedRow.id,
          actorMemberId: memberId,
          before: null,
          after: null,
        });

        return serializeAccount(updatedRow);
      });
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
