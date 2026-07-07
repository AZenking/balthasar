import { validateApiKey } from "@/server/auth/api-key-auth";
import { checkRateLimit } from "@/server/auth/api-rate-limit";
import { setCorsHeaders, corsPreflightResponse } from "@/server/auth/cors";
import { loadFamilyAndMemberIdsByUserId } from "@/server/db/queries/account";
import { validateAccountAndCategory, getTransactionById, serializeTransaction, findTransactionForUpdate } from "@/server/db/queries/transaction";
import { writeTransactionEvent } from "@/server/db/queries/transaction-events";
import { applySign, validateOccurredAt, validateRemark } from "@/server/domain/transaction/validate";
import { db, withTransaction, type TxClient } from "@/server/db/client";
import { transaction } from "@/server/db/schema";
import { eq } from "drizzle-orm";

function errorResponse(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return setCorsHeaders(
    Response.json({ error: { code, message, details } }, { status })
  );
}

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  // Body size
  const text = await req.text();
  if (text.length > 4096) return errorResponse(413, "PAYLOAD_TOO_LARGE", "请求体超过 4KB");

  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "无效的 JSON");
  }

  // At least one field
  const { type, accountId, categoryId, amount, remark, occurredAt } = body;
  if (type === undefined && accountId === undefined && categoryId === undefined &&
      amount === undefined && remark === undefined && occurredAt === undefined)
    return errorResponse(400, "VALIDATION_ERROR", "至少需要一个更新字段");

  // Validate type
  if (type !== undefined && !["income", "expense"].includes(type))
    return errorResponse(400, "VALIDATION_ERROR", "type 必须为 income 或 expense");

  // Validate amount
  if (amount !== undefined) {
    const amountStr = String(amount);
    if (!/^\d+(\.\d{1,2})?$/.test(amountStr) || parseFloat(amountStr) <= 0)
      return errorResponse(400, "VALIDATION_ERROR", "amount 必须为正数,≤2 位小数");
  }

  // Validate remark
  if (remark !== undefined) {
    const rc = validateRemark(String(remark));
    if (!rc.ok) return errorResponse(400, "VALIDATION_ERROR", "备注最多 200 字");
  }

  // Validate occurredAt
  let newOccurredAt: Date | undefined;
  if (occurredAt !== undefined) {
    newOccurredAt = new Date(occurredAt);
    const oc = validateOccurredAt(newOccurredAt);
    if (!oc.ok) return errorResponse(400, "VALIDATION_ERROR", "日期不能是未来日期");
  }

  // Resolve family
  const { familyId, memberId } = await loadFamilyAndMemberIdsByUserId(auth.userId);

  try {
    const updated = await withTransaction(async (tx) => {
      const existing = await findTransactionForUpdate(tx, { id, familyId });
      if (!existing) return null;

      const newType = type ?? existing.type;
      const newAccountId = accountId ?? existing.accountId;
      const newCategoryId = categoryId ?? existing.categoryId;
      const newAmount = amount !== undefined
        ? applySign(newType, Math.round(parseFloat(String(amount)) * 100))
        : existing.amount;
      const newRemark = remark ?? existing.remark;
      const finalOccurredAt = newOccurredAt ?? existing.occurredAt;

      // Revalidate if account/category/type changed
      if (accountId || categoryId || type) {
        await validateAccountAndCategory(tx, {
          accountId: newAccountId, categoryId: newCategoryId, familyId, type: newType,
        });
      }

      const before = {
        type: existing.type, accountId: existing.accountId, categoryId: existing.categoryId,
        amount: existing.amount, remark: existing.remark, occurredAt: existing.occurredAt.toISOString(),
      };
      const after = {
        type: newType, accountId: newAccountId, categoryId: newCategoryId,
        amount: newAmount, remark: newRemark, occurredAt: finalOccurredAt.toISOString(),
        via: "open_api",
      };

      const [updatedRow] = await tx
        .update(transaction)
        .set({ type: newType, accountId: newAccountId, categoryId: newCategoryId, amount: newAmount, remark: newRemark, occurredAt: finalOccurredAt })
        .where(eq(transaction.id, id))
        .returning();

      if (!updatedRow) throw new Error("更新失败");

      await writeTransactionEvent(tx, {
        eventType: "transaction_edited",
        transactionId: updatedRow.id,
        actorMemberId: memberId,
        before, after,
      });

      return updatedRow;
    });

    if (!updated) return errorResponse(404, "NOT_FOUND", "交易不存在");

    const full = await getTransactionById({ id: updated.id, familyId });
    if (!full) return errorResponse(500, "INTERNAL_ERROR", "更新后查询失败");
    return setCorsHeaders(Response.json(serializeTransaction(full), { status: 200 }));
  } catch (e: any) {
    const msg = e?.message ?? "";
    if (msg.includes("账户") || msg.includes("分类"))
      return errorResponse(400, "VALIDATION_ERROR", msg);
    return errorResponse(500, "INTERNAL_ERROR", "更新失败");
  }
}
