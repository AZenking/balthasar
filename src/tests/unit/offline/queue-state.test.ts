import { describe, expect, it } from "vitest";

import { nextState, MAX_RETRY, type PendingItem, type FetchResult } from "@/lib/offline/queue-state";

/**
 * T030 (033 US2 / R4): queue-state 纯函数测试。
 *
 * 033 契约 sync-queue C2 状态机:
 *   pending → syncing → (success: 出队) | (fail: retry++ → pending, 或达上限 → failed)
 *   syncing → 出队 (4xx 永久:400/422)
 *   syncing → failed (401 立即,不重试;retryCount >= 5)
 *
 * 纯函数 nextState(item, fetchResult) → NextAction
 *   { kind: "delete" } 出队
 *   { kind: "update", item } 更新并保留
 */
function baseItem(overrides: Partial<PendingItem> = {}): PendingItem {
  return {
    clientRequestId: "cr-1",
    familyId: "fam-1",
    formPayload: { type: "expense", accountId: "a", categoryId: "c", amount: "100", remark: "", occurredAt: "2026-07-18" },
    createdAt: 1000,
    status: "syncing",
    retryCount: 0,
    ...overrides,
  };
}

describe("nextState — 成功分支", () => {
  it("2xx → delete(出队)", () => {
    const r: FetchResult = { kind: "ok", status: 200 };
    expect(nextState(baseItem(), r)).toEqual({ kind: "delete" });
  });

  it("201 → delete", () => {
    const r: FetchResult = { kind: "ok", status: 201 };
    expect(nextState(baseItem(), r)).toEqual({ kind: "delete" });
  });

  it("409(dedup 命中)→ delete(幂等,已存在)", () => {
    const r: FetchResult = { kind: "dedup", status: 409 };
    expect(nextState(baseItem(), r)).toEqual({ kind: "delete" });
  });
});

describe("nextState — 永久失败(4xx,drop)", () => {
  it("400 → delete(drop 坏数据,不重试)", () => {
    const r: FetchResult = { kind: "client-error", status: 400, message: "bad" };
    expect(nextState(baseItem(), r)).toEqual({ kind: "delete" });
  });

  it("422 → delete", () => {
    const r: FetchResult = { kind: "client-error", status: 422, message: "validation" };
    expect(nextState(baseItem(), r)).toEqual({ kind: "delete" });
  });
});

describe("nextState — 认证失效(401,立即 failed)", () => {
  it("401 → update status=failed(不重试)", () => {
    const r: FetchResult = { kind: "client-error", status: 401, message: "unauthorized" };
    const out = nextState(baseItem(), r);
    expect(out.kind).toBe("update");
    if (out.kind === "update") {
      expect(out.item.status).toBe("failed");
      expect(out.item.retryCount).toBe(0); // 不增重试
      expect(out.item.lastError).toBe("auth");
    }
  });
});

describe("nextState — 瞬时失败(5xx/network,retry++)", () => {
  it("500 → update status=pending retryCount++", () => {
    const r: FetchResult = { kind: "server-error", status: 500, message: "boom" };
    const out = nextState(baseItem({ retryCount: 2 }), r);
    expect(out.kind).toBe("update");
    if (out.kind === "update") {
      expect(out.item.status).toBe("pending");
      expect(out.item.retryCount).toBe(3);
      expect(out.item.lastError).toBe("500");
    }
  });

  it("network error → update status=pending retryCount++", () => {
    const r: FetchResult = { kind: "network-error" };
    const out = nextState(baseItem({ retryCount: 0 }), r);
    expect(out.kind).toBe("update");
    if (out.kind === "update") {
      expect(out.item.status).toBe("pending");
      expect(out.item.retryCount).toBe(1);
      expect(out.item.lastError).toBe("network");
    }
  });

  it(`retryCount 达 MAX_RETRY(${MAX_RETRY}) → failed(不再重试)`, () => {
    const r: FetchResult = { kind: "server-error", status: 503, message: "down" };
    const out = nextState(baseItem({ retryCount: MAX_RETRY }), r);
    expect(out.kind).toBe("update");
    if (out.kind === "update") {
      expect(out.item.status).toBe("failed");
      expect(out.item.retryCount).toBe(MAX_RETRY); // 不超
    }
  });
});
