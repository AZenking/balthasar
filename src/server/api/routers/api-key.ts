import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db/client";
import { apiKey } from "@/server/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { generateApiKey } from "@/server/domain/api-key/generate";
import { loadFamilyAndMemberIdsByUserId } from "@/server/db/queries/account";

const MAX_KEYS_PER_USER = 5;

export const apiKeyRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1, "请输入名称").max(50) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const existing = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(apiKey)
        .where(and(eq(apiKey.userId, userId), isNull(apiKey.revokedAt)));

      if ((existing[0]?.count ?? 0) >= MAX_KEYS_PER_USER) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `最多 ${MAX_KEYS_PER_USER} 个有效 API Key`,
        });
      }

      const generated = generateApiKey();

      const [row] = await db
        .insert(apiKey)
        .values({
          userId,
          keyPrefix: generated.keyPrefix,
          keyHash: generated.keyHash,
          name: input.name,
        })
        .returning();

      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建失败" });

      return {
        id: row.id,
        plainKey: generated.plainKey,
        name: row.name,
        createdAt: row.createdAt,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        lastUsedAt: apiKey.lastUsedAt,
        revokedAt: apiKey.revokedAt,
      })
      .from(apiKey)
      .where(eq(apiKey.userId, ctx.session.user.id))
      .orderBy(apiKey.createdAt);
  }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [updated] = await db
        .update(apiKey)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKey.id, input.id), eq(apiKey.userId, ctx.session.user.id)))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Key 不存在" });
      }

      return { success: true as const };
    }),
});

export type ApiKeyRouter = typeof apiKeyRouter;
