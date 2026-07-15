import { validateApiKey } from "@/server/auth/api-key-auth";
import { checkRateLimit } from "@/server/auth/api-rate-limit";
import { setCorsHeaders, corsPreflightResponse } from "@/server/auth/cors";
import { loadFamilyIdByUserId } from "@/server/db/queries/account";
import { db } from "@/server/db/client";
import { account } from "@/server/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

/**
 * GET /api/v1/accounts — list accounts for the API-key owner's family.
 *
 * Mirrors tRPC `account.list`:
 *   - family scoped (cross-family isolation via loadFamilyIdByUserId)
 *   - default excludes archived (partial index hot path)
 *   - ?includeArchived=true returns all
 *   - sorted by createdAt DESC
 *
 * Query params:
 *   - includeArchived: "true" | "1" to include archived accounts
 */
function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return setCorsHeaders(
    Response.json({ error: { code, message, details } }, { status }),
  );
}

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function GET(req: Request) {
  // Auth
  const auth = await validateApiKey(req);
  if (!auth) return errorResponse(401, "UNAUTHORIZED", "API Key 无效");

  // Rate limit
  const rl = checkRateLimit(auth.keyPrefix);
  if (!rl.allowed) {
    const res = errorResponse(429, "RATE_LIMITED", "请求过于频繁");
    res.headers.set("Retry-After", String(rl.retryAfter));
    return res;
  }

  // Resolve family
  const familyId = await loadFamilyIdByUserId(auth.userId);

  // Parse query — default excludes archived
  const url = new URL(req.url);
  const includeArchived =
    url.searchParams.get("includeArchived") === "true" ||
    url.searchParams.get("includeArchived") === "1";

  const conditions = [eq(account.familyId, familyId)];
  if (!includeArchived) {
    conditions.push(isNull(account.archivedAt));
  }

  const rows = await db
    .select()
    .from(account)
    .where(and(...conditions))
    .orderBy(desc(account.createdAt));

  const items = rows.map((row) => ({
    id: row.id,
    name: row.name,
    currency: row.currency,
    initialBalance: row.initialBalance,
    type: row.type,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return setCorsHeaders(Response.json({ items }));
}
