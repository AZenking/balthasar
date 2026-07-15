"use client";

import { Sidebar } from "./sidebar";
import { BottomNavigation } from "@/components/bottom-navigation";
import { cn } from "@/lib/utils";

/**
 * AppShell(026-switch 第一期 1:响应式 App Shell)。
 *
 * 单一布局容器,内部按断点(md: 768px)切换:
 *
 *   Mobile(<md):
 *     ┌──────────────┐
 *     │   main       │  ← 全宽,max-w-[1120px] 居中
 *     │  (pb-24 留    │
 *     │   底栏空间)   │
 *     └──────────────┘
 *     │ 底栏 5 入口  │  ← BottomNavigation fixed bottom
 *     └──────────────┘
 *
 *   Desktop(md+):
 *     ┌─────┬────────────────┐
 *     │ Side│  main (md:pl-60)│
 *     │ bar │  max-w-1120 居中│
 *     │ 240 │                │
 *     │ px  │                │
 *     └─────┴────────────────┘
 *
 * - safe-area:`env(safe-area-inset-bottom)` 注入到 mobile 底栏外层,避免
 *   iPhone 全面屏 home indicator 压住底栏按钮。
 * - pb-* 统一在 AppShell 注入(main 容器),各页面不再自带 `pb-16/pb-20`。
 * - 报表页需要全宽 → 直接覆盖外层 `max-w`(报表 page.tsx 已自带 grid,容器
 *   宽度由本组件上限 1120 限制足够);表单 / 设置页需要更窄 → 由页面自身
 *   在 children 上加 `max-w-[720px]` 包裹。
 *
 * 重要:本组件不接管页面"内容垂直布局",只负责外壳。各 page 内部仍按自己
 * 的 grid / flex 摆放。
 */
export function AppShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* 桌面端侧栏:fixed 在左侧,移动端隐藏 */}
      <Sidebar className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-30" />

      {/* 主内容:md+ 左侧让出 240px,移动端全宽;统一容器宽度与 padding。
          移动端底部留白 = 底栏高度(64px) + safe-area + 一点呼吸距离:
          pb-24(96px) 在带 home indicator 的 iPhone 上会被底栏遮住内容,
          改用 calc 动态留白。 */}
      <main className="md:pl-60">
        <div
          className={cn(
            "mx-auto max-w-[1120px] px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8",
            className,
          )}
        >
          {children}
        </div>
      </main>

      {/* 移动端底栏:fixed bottom。
          safe-area-inset-bottom 已在 BottomNavigation 内部处理(minHeight
          + paddingBottom),外层不再重复注入(重复 padding 对 fixed 元素无意义)。 */}
      <div className="md:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
}
