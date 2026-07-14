"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TransactionForm } from "@/components/transaction/transaction-form";

/**
 * /transaction/new — 独立页面模式(桌面端 sidebar "记一笔" 入口的深链)。
 *
 * 026-switch 调整:
 *   - 整页 padding 由 AppShell 注入
 *   - 表单宽度限制 720px(任务规范 §1 要求),避免桌面端把表单拉得过宽
 *
 * Mobile 模式下不直接走这个页面,而是 BottomNavigation 中"记一笔"凸起
 * 按钮触发 TransactionDrawer(底部 sheet)。这个路由保留是因为:
 *   1. 桌面端 sidebar 链接到此(无 Drawer 形态,需走全屏页)
 *   2. 可被深链分享
 *   3. 编辑场景(id query param)需要全屏上下文
 */
function NewTransactionPageInner() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id") ?? undefined;
  return (
    <div className="mx-auto max-w-[720px]">
      <TransactionForm editId={editId} />
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense fallback={null}>
      <NewTransactionPageInner />
    </Suspense>
  );
}
