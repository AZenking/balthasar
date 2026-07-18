/**
 * T019/T020 (031 US2): 类型 Tabs 收紧 + 颜色语义不变 契约测试。
 *
 * 为什么不 render 整个 TransactionForm:
 * 它依赖 tRPC / PWA / router / auth-scope / better-auth 等大量 provider,
 * 全量 render 需 mock 10+ 个 provider,违反 YAGNI 且测试脆弱。jsdom 也无法
 * 可信验证 iOS 键盘 / 视觉密度(那是 T025 真机走查的事)。
 *
 * 本测试聚焦可机械化验证的契约:
 * 1. TYPE_META 三类型颜色 token 完整且与 docs/THEME.md 一致(直接 import 断言);
 * 2. Tabs 结构符合 HeroUI v3 compound API;
 * 3. Tabs.List 收紧后含 HeroUI 官方推荐的 *:h-* 紧凑高度 className。
 *
 * 视觉密度(首屏多露一字段)与键盘交互稳定性由 T025 真机走查验证。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { TYPE_META } from "@/components/transaction/transaction-form";

const FORM_SRC = readFileSync(
  join(process.cwd(), "src/components/transaction/transaction-form.tsx"),
  "utf8",
);

describe("031 US2 — 类型 Tabs 收紧 + 颜色语义不变", () => {
  describe("TYPE_META 颜色映射完整(回归保护,SC-005)", () => {
    it("三类型齐全:支出/收入/转账", () => {
      expect(Object.keys(TYPE_META).sort()).toEqual([
        "expense",
        "income",
        "transfer",
      ]);
      expect(TYPE_META.expense.label).toBe("支出");
      expect(TYPE_META.income.label).toBe("收入");
      expect(TYPE_META.transfer.label).toBe("转账");
    });

    it("支出 → --danger 系(红,docs/THEME.md 真相源)", () => {
      expect(TYPE_META.expense.indicatorCls).toContain("--danger-soft");
      expect(TYPE_META.expense.selectedTextCls).toContain("--danger");
      expect(TYPE_META.expense.submitCls).toContain("--danger");
      // 不应串色到其它类型
      expect(TYPE_META.expense.submitCls).not.toContain("--success");
      expect(TYPE_META.expense.submitCls).not.toContain("--accent");
    });

    it("收入 → --success 系(绿)", () => {
      expect(TYPE_META.income.indicatorCls).toContain("--success-soft");
      expect(TYPE_META.income.selectedTextCls).toContain("--success");
      expect(TYPE_META.income.submitCls).toContain("--success");
      expect(TYPE_META.income.submitCls).not.toContain("--danger");
      expect(TYPE_META.income.submitCls).not.toContain("--accent");
    });

    it("转账 → --accent 系(蓝)", () => {
      expect(TYPE_META.transfer.indicatorCls).toContain("--accent-soft");
      expect(TYPE_META.transfer.selectedTextCls).toContain("--accent");
      expect(TYPE_META.transfer.submitCls).toContain("--accent");
      expect(TYPE_META.transfer.submitCls).not.toContain("--danger");
      expect(TYPE_META.transfer.submitCls).not.toContain("--success");
    });
  });

  describe("Tabs 结构符合 HeroUI v3 compound API(无 v2 flat 残留)", () => {
    it("用 Tabs.List / Tabs.Tab / Tabs.Indicator compound 子组件", () => {
      expect(FORM_SRC).toMatch(/<Tabs\.List[\s>]/);
      expect(FORM_SRC).toMatch(/<Tabs\.Tab[\s>]/);
      expect(FORM_SRC).toMatch(/<Tabs\.Indicator[\s>/]/);
    });

    it("不出现 v2 flat API 残留(<Tabs title=...> / items=[])", () => {
      expect(FORM_SRC).not.toMatch(/<Tabs[^.][^>]*\stitle=/);
      expect(FORM_SRC).not.toMatch(/<Tabs[^.][^>]*\sitems=/);
    });
  });

  describe("Tabs.List 收紧密度(031 R5 / FR-009)", () => {
    it("Tabs.List className 含 HeroUI 官方推荐的 *:h-* 紧凑高度", () => {
      // HeroUI v3 Tabs 无 size prop;密度经 Tabs.List className 的 *:h-* 控制
      // (T003 /heroui-react skill 验证,.tabs__tab 是直接子元素)。
      // 收紧后应能在 Tabs.List 上找到 *:h- 紧凑高度工具类。
      expect(FORM_SRC).toMatch(/<Tabs\.List[^>]*\*?:h-\d/);
    });
  });
});
