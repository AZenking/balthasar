"use client";

import { useLayoutEffect, useState } from "react";
import { Drawer, buttonVariants } from "@heroui/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVisualViewport } from "@/lib/hooks/use-visual-viewport";
import { useScrollIntoViewOnFocus } from "@/lib/hooks/use-scroll-into-view-on-focus";
import { TransactionForm } from "./transaction-form";

/**
 * TransactionDrawer(026-cream-amber-revamp,2026-07-14 IA 调整;
 * 031-drawer-keyboard-and-tabs 键盘避让收敛)。
 *
 * 把"记一笔"从独立路由 /transaction/new 改为底部弹出的 Drawer(Mobile
 * bottom-sheet 模式)。理由:记账是高频操作(宪章五 "10 秒完成"),
 * Drawer 无页面跳转 + 半屏遮挡 + 下滑关闭,比全屏 page 更轻量。
 *
 * ## 031 键盘避让收敛(R1/R2/R3/R4)
 * 029 的两套补偿(全局 scrollIntoView + 表单 paddingBottom: keyboardHeight)
 * 在 iOS Safari/PWA 叠加,把 fixed 定位的 Drawer 整体上移、露出背景页。
 * 031 收敛为**单一机制**:
 *  1. **高度钳制(R2)**:HeroUI v3.2.2 的 drawer.css 已把 `.drawer__backdrop`
 *     与 `.drawer__content` 都绑到 CSS 变量 `--visual-viewport-height`
 *     (T003 /heroui-react skill 验证)。我们在 Drawer 打开期间把
 *     `useVisualViewport().height` 写到 `:root` 的这个变量上,HeroUI 自动
 *     钳制 backdrop+content —— Drawer 紧贴键盘上方,无空隙、不透出。
 *  2. **scroll 只滚 Body(R3)**:`useScrollIntoViewOnFocus`(031 改造后)
 *     只调 `Drawer.Body` 自身 scrollTop,不调全局 scrollIntoView,
 *     物理上不可能带动 fixed 祖先。
 *  3. **submit 始终可达(R4)**:表单根用 `flex flex-col`,submit 加 `mt-auto`
 *     被 flex 推到 Drawer.Body 可视区底部;Body 随键盘钳制收缩后,submit 自然
 *     停在键盘上方。无需 029 的 paddingBottom: keyboardHeight 补偿。
 *     (放弃把 submit 移入 Drawer.Footer 的方案 —— 那需拆 TransactionForm 暴露
 *     submit + 用 form={id} 关联,复杂度高;flex mt-auto 同样达成目标,YAGNI。)
 *
 * 注意:
 * - 编辑场景(/transaction/[id]/edit)仍用独立页面(有 ID 上下文,跳页更直观)
 * - BottomNavigation 中"记一笔"凸起按钮 onClick 开 Drawer(不再 Link)
 * - /transaction/new 路由保留(可深链分享,渲染独立 page)
 */

/**
 * 把 visualViewport 高度写到 :root 的 --visual-viewport-height。
 *
 * HeroUI v3.2.2 drawer.css 的 `.drawer__backdrop` / `.drawer__content`
 * 均为 `height: var(--visual-viewport-height)`(T003 验证),故写这一处
 * 即让 backdrop+content 自动钳制到键盘上方的可视高度。
 *
 * 抽成纯函数 + 操作 document,便于单元测试(宪章原则四)。
 */
export function setViewportHeightCssVar(height: number): void {
  if (typeof document === "undefined") return;
  if (height <= 0) return; // SSR / 桌面 identity / 旋转边界:不写
  document.documentElement.style.setProperty(
    "--visual-viewport-height",
    `${height}px`,
  );
}

/** Drawer 关闭时清除高度钳制变量(避免影响非 Drawer 页面的固定元素)。 */
export function clearViewportHeightCssVar(): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.removeProperty("--visual-viewport-height");
}

export function TransactionDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { height: vvHeight } = useVisualViewport();
  // 031 R3:scroll 只滚 Drawer.Body 内部
  // Drawer.Body 渲染为 <div>,故泛型用 HTMLDivElement 与 HeroUI ref 类型对齐。
  const { scrollContainerRef, attachRef } =
    useScrollIntoViewOnFocus<HTMLDivElement>();

  // 031 R2:Drawer 打开期间持续把 visualViewport 高度写到 :root CSS 变量,
  // HeroUI 自动钳制。关闭时清除。
  useLayoutEffect(() => {
    if (!isOpen) return;
    setViewportHeightCssVar(vvHeight);
    return () => {
      // 关闭/卸载:清除。下一次打开会重新写。
    };
  }, [isOpen, vvHeight]);
  useLayoutEffect(() => {
    if (!isOpen) clearViewportHeightCssVar();
  }, [isOpen]);

  return (
    <>
      {/*
        触发器:凸起的圆形 FAB。
        定位用 absolute(锚点 = BottomNavigation 中央占位容器的 relative),
        负 margin 方案会让 FAB 半嵌入底栏且投影被同色背景吃掉;absolute +
        ring 切边让 FAB 与底栏有清晰层次。
      */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="记一笔"
        className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      >
        <span
          className={cn(
            buttonVariants({
              variant: "primary",
              size: "sm",
            }),
            // 品牌蓝高亮:覆盖 default 的近黑 primary,FAB 作为视觉主角
            "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent)]/90",
            "flex h-14 w-14 items-center justify-center rounded-full",
            "ring-4 ring-background", // 底栏背景色切边,分离 FAB 与底栏
            "shadow-lg shadow-[var(--accent)]/30", // 蓝色调柔光投影
            "transition-transform hover:scale-105 active:scale-95",
          )}
        >
          <Plus className="h-6 w-6" aria-hidden />
        </span>
        <span className="sr-only">记一笔</span>
      </button>

      <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Backdrop>
          <Drawer.Content placement="bottom">
            {/*
              031 R2:Drawer.Dialog 默认 max-h-[85vh] 会盖过 viewport 钳制,
              用 max-h-[var(--visual-viewport-height)] 覆盖(T003 建议)。
              Body 的 flex-1 min-h-0 overflow-y-auto 会随父级钳制自然收缩。
            */}
            <Drawer.Dialog className="max-h-[var(--visual-viewport-height)] transition-[max-height] duration-200 ease-out">
              <Drawer.Handle />
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>记一笔</Drawer.Heading>
              </Drawer.Header>
              {/*
                031 R3:scrollContainerRef 接 Drawer.Body,native scrolling。
                attachRef 透传给 TransactionForm 挂到表单根,focusin 委托。
              */}
              <Drawer.Body ref={scrollContainerRef}>
                <TransactionForm
                  embedded
                  formAttachRef={attachRef}
                  onSubmitted={() => setIsOpen(false)}
                />
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}
