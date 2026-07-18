import { describe, expect, it } from "vitest";

import { parseDefaultType } from "@/components/transaction/parse-default-type";

/**
 * T018 (032 US3): parseDefaultType 纯函数测试。
 *
 * shortcuts 的 url 是 /transaction/new?type=expense|income|transfer。
 * /transaction/new/page.tsx 读 type query 后,经 parseDefaultType 校验并传给
 * TransactionForm 作为 defaultType。本纯函数把 query 字符串映射到合法类型
 * 或 undefined(无效/缺失 → undefined → TransactionForm 默认 expense)。
 *
 * 抽成纯函数便于在 node 环境单测(宪章原则四:纯函数优先),无需 render
 * 整个 TransactionForm(它依赖 tRPC/PWA/router 等大量 provider)。
 */
describe("parseDefaultType (032 US3 shortcuts URL query 解析)", () => {
  it("accepts the three valid transaction types", () => {
    expect(parseDefaultType("expense")).toBe("expense");
    expect(parseDefaultType("income")).toBe("income");
    expect(parseDefaultType("transfer")).toBe("transfer");
  });

  it("returns undefined for empty / null / undefined (TransactionForm falls back to expense)", () => {
    expect(parseDefaultType(null)).toBeUndefined();
    expect(parseDefaultType(undefined)).toBeUndefined();
    expect(parseDefaultType("")).toBeUndefined();
  });

  it("returns undefined for invalid strings (防御:不把任意 query 当类型)", () => {
    expect(parseDefaultType("Expense")).toBeUndefined(); // 大小写敏感
    expect(parseDefaultType("saving")).toBeUndefined();
    expect(parseDefaultType("expense ")).toBeUndefined(); // 带空格
    expect(parseDefaultType("<script>")).toBeUndefined(); // 注入尝试
    expect(parseDefaultType("expense&other=1")).toBeUndefined(); // 多余 query
  });

  it("is case-sensitive (URL query 精确匹配,不 normalize)", () => {
    // shortcuts 声明的 url 是小写 ?type=expense,query 值应精确匹配
    expect(parseDefaultType("EXPENSE")).toBeUndefined();
    expect(parseDefaultType("Income")).toBeUndefined();
  });
});
