import { NextResponse } from "next/server";
import { auth } from "@/server/auth/config";
import { createCaller } from "@/lib/trpc/server";
import type { SessionContext } from "@/server/api/trpc";

/**
 * /api/v1/transactions/sync — 033 US2 / R4 SW sync 端点。
 *
 * Background Sync 的 SW handler 无法复用 tRPC(batch envelope + superjson 手搓
 * 脆弱,research R4),也用不了既有 /api/v1/transactions(它用 API Key auth,
 * SW 只有 session cookie)。故新增此 **session-authed** sibling 端点。
 *
 * 设计:薄 HTTP→tRPC 适配。解析 session(Better-Auth cookie)→ 用
 * createCaller 复用 transaction.create(含 R3 clientRequestId 幂等)。
 * 不复制业务逻辑(避免与 tRPC 路径漂移)。
 *
 * Response:
 *   201 → 成功(body = transaction;dedup 命中也走此路,幂等)
 *   401 → 未登录(SW 标 failed)
 *   400 → 业务校验失败(SW drop,4xx 永久)
 *   500 → 服务器错误(SW retry,5xx 瞬时)
 */

/** tRPC error code → HTTP status 映射(纯函数,便于单测)。 */
export function trpcErrorToStatus(code: string | undefined): number {
  switch (code) {
    case "BAD_REQUEST":
    case "FORBIDDEN":
    case "NOT_FOUND":
      return 400; // 4xx 永久 → SW drop
    case "UNAUTHORIZED":
      return 401; // 认证失效 → SW failed(不重试)
    case "CONFLICT":
      return 409; // dedup(理论上 R3 已命中返既有,不抛 CONFLICT;保留兜底)
    default:
      return 500; // INTERNAL / TIMEOUT / 网络瞬时 → SW retry
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}

export async function POST(req: Request) {
  // ── Session auth(Better-Auth cookie,SW fetch credentials:include 带上)──
  const sessionResult = await auth.api.getSession({ headers: req.headers });
  if (!sessionResult) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 },
    );
  }

  const sessionContext: SessionContext = {
    user: {
      ...sessionResult.user,
      image: sessionResult.user.image ?? null,
    },
    session: {
      ...sessionResult.session,
      ipAddress: sessionResult.session.ipAddress ?? null,
      userAgent: sessionResult.session.userAgent ?? null,
    },
  };

  // ── Body 解析 ──
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "请求体不是合法 JSON" } },
      { status: 400 },
    );
  }

  // ── clientRequestId 幂等键(header,SW 从队列项提供)──
  const clientRequestId = req.headers.get("X-Client-Request-Id");
  const input = { ...body, ...(clientRequestId ? { clientRequestId } : {}) };

  // ── 复用 tRPC transaction.create(含 R3 幂等去重)──
  const caller = createCaller({ session: sessionContext });
  try {
    const created = await caller.transaction.create(input as never);
    // dedup 命中也走此路(procedure 返回既有 transaction,不抛错)→ 统一 201。
    // SW 看到任何 2xx 都出队(契约 sync-queue C2)。
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const code = e.code ?? "INTERNAL_SERVER_ERROR";
    const message = e.message ?? "同步失败";
    return NextResponse.json(
      { error: { code, message } },
      { status: trpcErrorToStatus(code) },
    );
  }
}

