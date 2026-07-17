import { describe, expect, it, vi } from "vitest";
import { createDraftController } from "@/lib/pwa/transaction-draft-controller";

const transfer = { type: "transfer" as const, accountId: "a", toAccountId: "b", categoryId: "bad", amount: "10", remark: "", occurredAt: "2026-07-16" };
const expense = { type: "expense" as const, accountId: "a", toAccountId: "b", categoryId: "c", amount: "10", remark: "", occurredAt: "2026-07-16" };
const income = { type: "income" as const, accountId: "a", toAccountId: "x", categoryId: "salary", amount: "100", remark: "", occurredAt: "2026-07-16" };

describe("transaction draft controller", () => {
  it("normalizes mutually exclusive create fields before persistence", () => {
    const save = vi.fn();
    const controller = createDraftController({ save, clear: vi.fn() });
    controller.save("A", transfer);
    expect(save).toHaveBeenCalledWith("A", expect.objectContaining({ categoryId: "", toAccountId: "b" }));
  });

  it("keeps category and clears toAccountId for non-transfer create entries", () => {
    const save = vi.fn();
    const controller = createDraftController({ save, clear: vi.fn() });
    controller.save("A", expense);
    expect(save).toHaveBeenCalledWith("A", expect.objectContaining({ categoryId: "c", toAccountId: "" }));
    controller.save("A", income);
    expect(save).toHaveBeenLastCalledWith("A", expect.objectContaining({ categoryId: "salary", toAccountId: "" }));
  });

  it("clears only after a definite success and preserves uncertain requests", () => {
    const clear = vi.fn();
    const controller = createDraftController({ save: vi.fn(), clear });
    controller.onSuccess();
    expect(clear).toHaveBeenCalledOnce();
    expect(controller.onUncertain()).toEqual({ status: "uncertain", autoRetry: false });
  });

  it("onUncertain does not clear the draft so the user can decide whether to retry", () => {
    const clear = vi.fn();
    const controller = createDraftController({ save: vi.fn(), clear });
    controller.onUncertain();
    expect(clear).not.toHaveBeenCalled();
  });
});
