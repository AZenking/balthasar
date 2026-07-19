import { describe, expect, it } from "vitest";

import {
  buildPendingItem,
  serializeForLog,
  hasPending,
} from "@/lib/offline/queue-store";

/**
 * T031 (033 US2 / FR-004): queue-store 纯函数测试。
 *
 * 033 契约 sync-queue C1:队列项结构 + scope(familyId)+ clientRequestId 主键。
 * CRUD 走 IDB(ensureDB),难在 node 单测;本测试覆盖纯函数:
 *  - buildPendingItem:生成入队项(clientRequestId + formPayload + status=pending)
 *  - serializeForLog:安全序列化(去掉大 payload,用于日志/badge)
 *  - hasPending:从队列数组判定是否有 pending/syncing 项
 */
describe("buildPendingItem (FR-004 入队)", () => {
  it("生成 pending 项,clientRequestId + createdAt + retryCount=0", () => {
    const item = buildPendingItem({
      clientRequestId: "cr-1",
      familyId: "fam-1",
      formPayload: {
        type: "expense",
        accountId: "a",
        categoryId: "c",
        amount: "100",
        remark: "lunch",
        occurredAt: "2026-07-18",
      },
      now: 5000,
    });

    expect(item.clientRequestId).toBe("cr-1");
    expect(item.familyId).toBe("fam-1");
    expect(item.status).toBe("pending");
    expect(item.retryCount).toBe(0);
    expect(item.createdAt).toBe(5000);
    expect((item.formPayload as { type: string }).type).toBe("expense");
    expect(item.lastError).toBeUndefined();
  });
});

describe("hasPending (badge 判定)", () => {
  it("空数组 → false", () => {
    expect(hasPending([])).toBe(false);
  });

  it("有 pending 项 → true", () => {
    const items = [
      { status: "pending", clientRequestId: "cr-1", familyId: "f", createdAt: 1, retryCount: 0, formPayload: {} },
    ];
    expect(hasPending(items as never)).toBe(true);
  });

  it("仅 failed 项 → false(failed 不算 pending,但 badge 单独统计 failed)", () => {
    const items = [
      { status: "failed", clientRequestId: "cr-1", familyId: "f", createdAt: 1, retryCount: 5, formPayload: {} },
    ];
    expect(hasPending(items as never)).toBe(false);
  });

  it("syncing 项 → true(同步中,仍算待处理)", () => {
    const items = [
      { status: "syncing", clientRequestId: "cr-1", familyId: "f", createdAt: 1, retryCount: 0, formPayload: {} },
    ];
    expect(hasPending(items as never)).toBe(true);
  });
});

describe("serializeForLog (安全序列化,去 payload)", () => {
  it("去掉 formPayload,保留元数据", () => {
    const item = buildPendingItem({
      clientRequestId: "cr-1",
      familyId: "fam-1",
      formPayload: { type: "expense", accountId: "a", categoryId: "c", amount: "100", remark: "secret", occurredAt: "2026-07-18" },
      now: 1000,
    });
    const log = serializeForLog(item);
    expect(log.clientRequestId).toBe("cr-1");
    expect(log.status).toBe("pending");
    expect(log).not.toHaveProperty("formPayload");
  });
});
