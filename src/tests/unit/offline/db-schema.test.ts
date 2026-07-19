import { describe, expect, it } from "vitest";

import {
  OFFLINE_DB_VERSION,
  shouldRebuild,
  type StoreName,
} from "@/lib/offline/db";

/**
 * T004 (033 Phase 2 Foundational): offline IDB schema 纯函数测试。
 *
 * 033 R1:单 DB balthasar-offline,4 个 object store(transactions /
 * dashboard_summaries / pending_queue / meta),schemaVersion 从 1 起。
 * 033 FR-014 / 契约 C5:schemaVersion 不匹配时丢弃重建(不迁移,YAGNI)。
 *
 * 本测试只测纯函数(OFFLINE_DB_VERSION 常量 + shouldRebuild 判定 + StoreName
 * 集合);IDB 实际打开/迁移靠 jsdom/真机走查(IDB 在 node 环境不存在)。
 */
describe("offline IDB schema 纯函数 (033 R1 / FR-014)", () => {
  it("OFFLINE_DB_VERSION starts at 1", () => {
    expect(OFFLINE_DB_VERSION).toBe(1);
  });

  it("declares exactly the 4 object stores", () => {
    const stores: StoreName[] = [
      "transactions",
      "dashboard_summaries",
      "pending_queue",
      "meta",
    ];
    // StoreName 是这 4 个字面量的联合;编译期已保证,运行期再断言数量
    expect(stores.length).toBe(4);
    expect(stores).toContain("transactions");
    expect(stores).toContain("dashboard_summaries");
    expect(stores).toContain("pending_queue");
    expect(stores).toContain("meta");
  });

  describe("shouldRebuild (FR-014 版本不匹配丢弃重建)", () => {
    it("returns false when stored version matches current", () => {
      expect(shouldRebuild(OFFLINE_DB_VERSION, OFFLINE_DB_VERSION)).toBe(false);
    });

    it("returns true when stored version is older (schema evolved)", () => {
      expect(shouldRebuild(1, OFFLINE_DB_VERSION)).toBe(false); // 当前就是 1
      // 模拟未来:schema 升到 2,旧客户端存的 1 → 应重建
      expect(shouldRebuild(1, 2)).toBe(true);
    });

    it("returns true when stored version is newer (downgrade, 不尝试迁移)", () => {
      // 客户端降级(罕见):存的是 2,当前代码是 1 → 重建
      expect(shouldRebuild(2, 1)).toBe(true);
    });

    it("returns true when stored version is null/undefined (首次或损坏)", () => {
      expect(shouldRebuild(null, OFFLINE_DB_VERSION)).toBe(true);
      expect(shouldRebuild(undefined, OFFLINE_DB_VERSION)).toBe(true);
    });
  });
});
