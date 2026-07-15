/**
 * T027 (027-mobile-home-revamp US4) — applySign transfer 扩展 + validateTransfer。
 *
 * applySign(扩展):
 *   - income → +abs(026 不变)
 *   - expense → -abs(026 不变)
 *   - transfer → +abs(新增;research R1:存正数,余额计算时转出减/转入加)
 *
 * validateTransfer(新增):
 *   - accountId === toAccountId → 拒绝(FR-014 自转)
 *   - 否则 ok
 *
 * 宪章原则四:纯函数单测,不依赖 DB。
 */
import { describe, expect, it } from "vitest";
import {
  applySign,
  validateTransfer,
} from "@/server/domain/transaction/validate";

describe("applySign transfer (T027)", () => {
  it("income → +abs", () => {
    expect(applySign("income", 5000)).toBe(5000);
    expect(applySign("income", 0)).toBe(0);
  });

  it("expense → -abs", () => {
    expect(applySign("expense", 5000)).toBe(-5000);
    expect(applySign("expense", 0)).toBe(0);
  });

  it("transfer → +abs(新增;存正数,余额计算时转出减/转入加)", () => {
    expect(applySign("transfer", 5000)).toBe(5000);
    expect(applySign("transfer", 0)).toBe(0);
  });

  it("transfer 对负输入也取 abs(防御)", () => {
    expect(applySign("transfer", -5000)).toBe(5000);
  });
});

describe("validateTransfer (T027)", () => {
  it("accountId === toAccountId → 拒绝(自转,FR-014)", () => {
    const r = validateTransfer("acc-1", "acc-1");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("same_account");
  });

  it("accountId !== toAccountId → ok", () => {
    expect(validateTransfer("acc-1", "acc-2").ok).toBe(true);
    expect(validateTransfer("acc-1", "acc-2").reason).toBeUndefined();
  });

  it("空串 vs 空串 → 拒绝(同为空也算同账户)", () => {
    expect(validateTransfer("", "").ok).toBe(false);
  });
});
