import { validateApiKey } from "@/server/auth/api-key-auth";
import { checkRateLimit } from "@/server/auth/api-rate-limit";
import { setCorsHeaders, corsPreflightResponse } from "@/server/auth/cors";
import { loadFamilyAndMemberIdsByUserId } from "@/server/db/queries/account";
import { validateAccountAndCategory, insertTransaction, getTransactionById, serializeTransaction } from "@/server/db/queries/transaction";
import { writeTransactionEvent } from "@/server/db/queries/transaction-events";
import { applySign, validateOccurredAt, validateRemark } from "@/server/domain/transaction/validate";
import { withTransaction } from "@/server/db/client";
import { findTransactionForUpdate } from "@/server/db/queries/transaction";




function errorResponse(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return setCorsHeaders(
    Response.json({ error: { code, message, details } }, { status })
  );
}

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(req: Request) {
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

  // Body size check
  const text = await req.text();
  if (text.length > 4096) return errorResponse(413, "PAYLOAD_TOO_LARGE", "请求体超过 4KB");

  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "无效的 JSON");
  }

  // Validate required fields
  const { type, accountId, categoryId, amount } = body;
  if (!type || !["income", "expense"].includes(type))
    return errorResponse(400, "VALIDATION_ERROR", "type 必须为 income 或 expense", { field: "type" });
  if (!accountId) return errorResponse(400, "VALIDATION_ERROR", "缺少 accountId", { field: "accountId" });
  if (!categoryId) return errorResponse(400, "VALIDATION_ERROR", "缺少 categoryId", { field: "categoryId" });
  if (!amount) return errorResponse(400, "VALIDATION_ERROR", "缺少 amount", { field: "amount" });

  // Validate amount
  const amountStr = String(amount);
  if (!/^\d+(\.\d{1,2})?$/.test(amountStr) || parseFloat(amountStr) <= 0)
    return errorResponse(400, "VALIDATION_ERROR", "amount 必须为正数,≤2 位小数", { field: "amount" });

  // Optional fields
  const remark = body.remark ?? "";
  const remarkCheck = validateRemark(remark);
  if (!remarkCheck.ok) return errorResponse(400, "VALIDATION_ERROR", "备注最多 200 字", { field: "remark" });

  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  const occurredCheck = validateOccurredAt(occurredAt);
  if (!occurredCheck.ok) return errorResponse(400, "VALIDATION_ERROR", "日期不能是未来日期", { field: "occurredAt" });

  // Resolve family
  const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(auth.userId);

  const cents = Math.round(parseFloat(amountStr) * 100);
  const signedAmount = applySign(type, cents);

  try {
    const created = await withTransaction(async (tx) => {
      await validateAccountAndCategory(tx, { accountId, categoryId, familyId, type });

      const row = await insertTransaction(tx, {
        familyId,
        type,
        accountId,
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
          type: row.type, accountId: row.accountId, categoryId: row.categoryId,
          amount: row.amount, remark: row.remark, occurredAt: row.occurredAt.toISOString(),
          via: "open_api",
        },
      });

      return row;
    });

    const full = await getTransactionById({ id: created.id, familyId });
    if (!full) return errorResponse(500, "INTERNAL_ERROR", "创建后查询失败");
    return setCorsHeaders(Response.json(serializeTransaction(full), { status: 201 }));
  } catch (e: any) {
    const msg = e?.message ?? "";
    if (msg.includes("账户") || msg.includes("分类"))
      return errorResponse(400, "VALIDATION_ERROR", msg);
    return errorResponse(500, "INTERNAL_ERROR", "创建失败");
  }
}
