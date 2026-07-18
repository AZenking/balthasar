import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollIntoViewOnFocus } from "@/lib/hooks/use-scroll-into-view-on-focus";

/**
 * T005: Behavior + debounce tests for useScrollIntoViewOnFocus (031 改造后).
 *
 * 031 R3 契约(contracts/keyboard-strategy.md C2):
 * - focusin 时只调整传入 scroll container 的 scrollTop,**禁止**调用全局
 *   `target.scrollIntoView`(那是 029 的旧实现,会滚 iOS fixed 容器)。
 * - 连续 focusin 必须 cancel 上一个 pending rAF(spec FR-007 去抖)。
 *
 * 这些测试需要 DOM(jsdom),故放 .test.tsx 走 ui project。
 *
 * 实现说明:
 * - 用一个真实的小组件挂 hook,scrollContainerRef 指向测试可控的伪容器
 *   (通过注入 getBoundingClientRect 返回值)。
 * - requestAnimationFrame/cancelAnimationFrame stub 成可控队列,入队不立即跑,
 *   只在 flush 时按顺序执行(被 cancel 的不入执行),从而可观测去抖。
 */
type RafCb = (ts: number) => void;
let rafQueue: Array<{ id: number; cb: RafCb }> = [];
let nextRafId = 1;

function flushRaf() {
  const pending = rafQueue;
  rafQueue = [];
  for (const { cb } of pending) cb(performance.now());
}

/** 把真实 DOM 元素的 getBoundingClientRect 重定向到固定返回值。 */
function stubRect(el: Element, rect: { top: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({ top: rect.top, bottom: rect.top + rect.height, height: rect.height }) as DOMRect;
}

/**
 * 测试组件:用 hook 的真实 ref 绑 DOM;两个 input 字段供 focusin 切换。
 * containerRef 注入到测试,以便 stubRect。
 */
function Harness(props: { containerRef: (el: HTMLDivElement | null) => void }) {
  const api = useScrollIntoViewOnFocus<HTMLDivElement>();
  return (
    <div
      ref={(el) => {
        (api.scrollContainerRef as { current: HTMLDivElement | null }).current = el;
        props.containerRef(el);
      }}
      data-testid="container"
    >
      <div ref={api.attachRef} data-testid="form-root">
        <input data-testid="input-a" />
        <input data-testid="input-b" />
      </div>
    </div>
  );
}

describe("useScrollIntoViewOnFocus (031 改造后)", () => {
  beforeEach(() => {
    rafQueue = [];
    nextRafId = 1;
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: RafCb) => {
        const id = nextRafId++;
        rafQueue.push({ id, cb });
        return id;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      const i = rafQueue.findIndex((q) => q.id === id);
      if (i >= 0) rafQueue.splice(i, 1);
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("focusin sets container.scrollTop via computed delta, never calls scrollIntoView", () => {
    let containerEl: HTMLDivElement | null = null;
    const { getByTestId } = render(<Harness containerRef={(el) => (containerEl = el)} />);
    const container = containerEl!;
    const inputA = getByTestId("input-a") as HTMLInputElement;

    // container: top=100, height=200 → bodyBottom 300, desiredBottom 284 (margin 16)
    stubRect(container, { top: 100, height: 200 });
    // inputA: top=350, height=40 → targetBottom 390 > 284 → delta = 390-284 = 106
    stubRect(inputA, { top: 350, height: 40 });
    inputA.scrollIntoView = vi.fn();

    container.scrollTop = 0;
    inputA.focus(); // 触发真实 focusin(冒泡到 form-root)
    act(() => flushRaf());

    expect(container.scrollTop).toBe(106);
    expect(inputA.scrollIntoView).not.toHaveBeenCalled();
  });

  it("debounces: second focusin before rAF cancels first pending scroll", () => {
    let containerEl: HTMLDivElement | null = null;
    const { getByTestId } = render(<Harness containerRef={(el) => (containerEl = el)} />);
    const container = containerEl!;
    const inputA = getByTestId("input-a") as HTMLInputElement;
    const inputB = getByTestId("input-b") as HTMLInputElement;

    stubRect(container, { top: 100, height: 200 }); // desiredBottom 284
    stubRect(inputA, { top: 350, height: 40 }); // targetBottom 390 → delta 106
    stubRect(inputB, { top: 400, height: 40 }); // targetBottom 440 → delta 156

    container.scrollTop = 0;
    inputA.focus(); // 入队 rAF #1
    inputB.focus(); // cancel rAF #1, 入队 rAF #2
    act(() => flushRaf()); // 只应跑 #2

    expect(container.scrollTop).toBe(156);
  });

  it("is a no-op when scrollContainer has zero height (degenerate)", () => {
    let containerEl: HTMLDivElement | null = null;
    const { getByTestId } = render(<Harness containerRef={(el) => (containerEl = el)} />);
    const container = containerEl!;
    const inputA = getByTestId("input-a") as HTMLInputElement;

    stubRect(container, { top: 100, height: 0 }); // degenerate
    stubRect(inputA, { top: 350, height: 40 });

    container.scrollTop = 42;
    inputA.focus();
    act(() => flushRaf());

    // body height 0 → computeBodyScrollDelta 返回 currentScrollTop 原值
    expect(container.scrollTop).toBe(42);
  });
});
