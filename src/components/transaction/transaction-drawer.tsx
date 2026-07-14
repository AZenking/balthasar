"use client";

import { useState } from "react";
import { Drawer } from "@heroui/react";
import { Plus } from "lucide-react";
import { buttonVariants } from "@heroui/react";
import { cn } from "@/lib/utils";
import { TransactionForm } from "./transaction-form";

/**
 * TransactionDrawer(026-cream-amber-revamp,2026-07-14 IA 调整)。
 *
 * 把"记一笔"从独立路由 /transaction/new 改为底部弹出的 Drawer(Mobile
 * bottom-sheet 模式)。理由:记账是高频操作(宪章五 "10 秒完成"),
 * Drawer 无页面跳转 + 半屏遮挡 + 下滑关闭,比全屏 page 更轻量。
 *
 * 设计:
 * - HeroUI Drawer placement="bottom" + Drawer.Handle(顶部拖拽指示器)
 * - Drawer.Header 显示"记一笔" + CloseTrigger(X 图标)
 * - Drawer.Body 内嵌 <TransactionForm embedded />:
 *   embedded 模式下 TransactionForm 去掉外层 Card 包裹(Drawer 自带 Header)
 * - 提交成功后:TransactionForm 内部 router.push("/dashboard") 已包含
 *   invalidate,但 Drawer 打开模式下需要先关 Drawer。用 onSubmitted 回调。
 *
 * 注意:
 * - 编辑场景(/transaction/[id]/edit)仍用独立页面(有 ID 上下文,跳页更直观)
 * - BottomNavigation 中"记一笔"凸起按钮 onClick 开 Drawer(不再 Link)
 * - /transaction/new 路由保留(可深链分享,渲染独立 page)
 */

export function TransactionDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 触发器:凸起的圆形按钮(替代原 <Link href="/transaction/new">) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="记一笔"
        className={cn(
          "flex flex-1 items-center justify-center",
          "-mt-6", // lift the FAB above the bar
        )}
      >
        <span
          className={cn(
            buttonVariants({
              variant: "primary",
              size: "lg",
              isIconOnly: true,
            }),
            // 026-dashboard-ui-refinement:
            //   - shadow-xl shadow-black/30:更立体的浮起感
            //   - ring-4 ring-background:FAB 与底栏视觉分离
            //   - hover/active scale 微动画
            "h-14 w-14 rounded-full shadow-xl shadow-black/30 ring-4 ring-[var(--background)] transition-transform hover:scale-105 active:scale-95",
          )}
        >
          <Plus className="h-6 w-6" aria-hidden />
        </span>
        <span className="sr-only">记一笔</span>
      </button>

      <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Backdrop>
          <Drawer.Content placement="bottom">
            <Drawer.Dialog>
              <Drawer.Handle />
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>记一笔</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                {/* embedded 模式:TransactionForm 去掉 Card 包裹,只渲染字段 */}
                <TransactionForm embedded onSubmitted={() => setIsOpen(false)} />
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}
