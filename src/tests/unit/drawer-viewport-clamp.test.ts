import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * T009: 031 US1 — Drawer 高度钳制契约测试。
 *
 * 031 R2 决策(T003 HeroUI skill 验证):HeroUI v3.2.2 的 drawer.css 已把
 * `.drawer__backdrop` / `.drawer__content` 都绑到 CSS 变量 `--visual-viewport-height`。
 * 我们只需在 Drawer 打开期间把 `useVisualViewport().height` 写到 `:root` 的这个
 * 变量上,HeroUI 自动钳制 backdrop+content(Drawer 紧贴键盘上方,无空隙、不透出)。
 *
 * 把"写 CSS 变量"抽成纯函数 setViewportHeightCssVar,便于在 node 环境单测
 * (宪章原则四:纯函数优先;jsdom 无法可信验证 iOS fixed 定位,故只测纯函数)。
 */
import { setViewportHeightCssVar } from "@/components/transaction/transaction-drawer";

describe("setViewportHeightCssVar (031 R2)", () => {
  beforeEach(() => {
    // 模拟一个干净的 :root style
    vi.stubGlobal(
      "document",
      {
        documentElement: {
          style: {
            setProperty: vi.fn(),
            removeProperty: vi.fn(),
          } as unknown as CSSStyleDeclaration,
        } as unknown as HTMLElement,
      } as unknown as Document,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("writes --visual-viewport-height = <height>px when height > 0", () => {
    const style = document.documentElement.style;
    setViewportHeightCssVar(700);
    expect(style.setProperty).toHaveBeenCalledWith(
      "--visual-viewport-height",
      "700px",
    );
  });

  it("is a no-op when height <= 0 (SSR / degenerate) — does not write", () => {
    const style = document.documentElement.style;
    setViewportHeightCssVar(0);
    setViewportHeightCssVar(-5);
    expect(style.setProperty).not.toHaveBeenCalled();
  });

  it("clears the variable when clearViewportHeightCssVar() is called", async () => {
    const { clearViewportHeightCssVar } = await import(
      "@/components/transaction/transaction-drawer"
    );
    const style = document.documentElement.style;
    clearViewportHeightCssVar();
    expect(style.removeProperty).toHaveBeenCalledWith(
      "--visual-viewport-height",
    );
  });
});
