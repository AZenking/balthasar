import { describe, expect, it } from "vitest";

import { trpcErrorToStatus } from "@/app/api/v1/transactions/sync/route";

/**
 * T032 (033 US2 / R4): /api/v1/transactions/sync 错误映射纯函数测试。
 *
 * 路由本身是薄 HTTP→tRPC 适配(session 解析 + createCaller 复用 transaction.create)。
 * 可单测的唯一独立逻辑是 trpcErrorToStatus:把 tRPC error code 映射到 HTTP status,
 * 决定 SW 的 drop/failed/retry 行为(契约 sync-queue C2)。
 *
 * 业务幂等(R3 clientRequestId)已由 create-idempotency.test.ts 覆盖(createCaller
 * 直接测);session 解析由 Better-Auth 守护;SW fetch 行为由真机走查(T042)。
 */
describe("trpcErrorToStatus (sync 路由错误映射)", () => {
  it("BAD_REQUEST → 400(4xx 永久,SW drop)", () => {
    expect(trpcErrorToStatus("BAD_REQUEST")).toBe(400);
  });

  it("FORBIDDEN / NOT_FOUND → 400(4xx 永久,SW drop)", () => {
    expect(trpcErrorToStatus("FORBIDDEN")).toBe(400);
    expect(trpcErrorToStatus("NOT_FOUND")).toBe(400);
  });

  it("UNAUTHORIZED → 401(认证失效,SW failed 不重试)", () => {
    expect(trpcErrorToStatus("UNAUTHORIZED")).toBe(401);
  });

  it("CONFLICT → 409(dedup 兜底;R3 实际返既有不抛 CONFLICT)", () => {
    expect(trpcErrorToStatus("CONFLICT")).toBe(409);
  });

  it("INTERNAL_SERVER_ERROR → 500(5xx 瞬时,SW retry)", () => {
    expect(trpcErrorToStatus("INTERNAL_SERVER_ERROR")).toBe(500);
  });

  it("TIMEOUT → 500(SW retry)", () => {
    expect(trpcErrorToStatus("TIMEOUT")).toBe(500);
  });

  it("未知 code → 500(保守 retry,不误 drop)", () => {
    expect(trpcErrorToStatus("SOMETHING_NEW")).toBe(500);
    expect(trpcErrorToStatus(undefined)).toBe(500);
  });
});
