import { validateApiKey } from "@/server/auth/api-key-auth";
import { checkRateLimit } from "@/server/auth/api-rate-limit";
import { setCorsHeaders, corsPreflightResponse } from "@/server/auth/cors";
import { loadFamilyIdByUserId } from "@/server/db/queries/account";
import { findAllCategories } from "@/server/db/queries/category";
import { buildCategoryTree } from "@/server/domain/category/rules";

/**
 * GET /api/v1/categories — list categories for the API-key owner's family.
 *
 * Mirrors tRPC `category.list`:
 *   - built-in (familyId=null) + family-scoped custom
 *   - default excludes archived
 *   - hierarchical tree by default; flat list when ?type= is given alone
 *
 * Query params:
 *   - type: "income" | "expense"  → filter by type
 *   - includeArchived: "true" | "1" → include archived
 *
 * Response shape: `{ items: Category[] | CategoryTreeNode[] }`
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

  // Parse query
  const url = new URL(req.url);
  const rawType = url.searchParams.get("type");
  const includeArchived =
    url.searchParams.get("includeArchived") === "true" ||
    url.searchParams.get("includeArchived") === "1";

  // Validate type if provided
  let type: "income" | "expense" | undefined;
  if (rawType !== null) {
    if (rawType !== "income" && rawType !== "expense") {
      return errorResponse(400, "VALIDATION_ERROR", "type 必须为 income 或 expense", {
        field: "type",
      });
    }
    type = rawType;
  }

  const flat = await findAllCategories({
    familyId,
    type,
    includeArchived,
  });

  // Hierarchical tree (matches tRPC behavior when no parentId filter)
  const items = buildCategoryTree(flat);

  return setCorsHeaders(Response.json({ items }));
}
