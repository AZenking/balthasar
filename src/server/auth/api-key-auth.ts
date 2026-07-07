import { db } from "@/server/db/client";
import { apiKey } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { hashApiKey } from "@/server/domain/api-key/generate";

export interface ApiKeyAuth {
  userId: string;
  keyPrefix: string;
}

export async function validateApiKey(req: Request): Promise<ApiKeyAuth | null> {
  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");

  let plainKey: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    plainKey = authHeader.slice(7).trim();
  } else if (xApiKey) {
    plainKey = xApiKey.trim();
  }

  if (!plainKey || !plainKey.startsWith("bk_")) return null;

  const keyHash = hashApiKey(plainKey);

  const rows = await db
    .select({ userId: apiKey.userId, keyPrefix: apiKey.keyPrefix, id: apiKey.id })
    .from(apiKey)
    .where(and(eq(apiKey.keyHash, keyHash), isNull(apiKey.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Fire-and-forget: update lastUsedAt (non-blocking)
  db.update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, row.id))
    .execute()
    .catch(() => {});

  return { userId: row.userId, keyPrefix: row.keyPrefix };
}
