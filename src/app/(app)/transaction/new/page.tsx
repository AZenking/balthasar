"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@heroui/react";
import { TransactionForm } from "@/components/transaction/transaction-form";
import { parseDefaultType } from "@/components/transaction/parse-default-type";

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
 *
 * 025 PR-4:`<Suspense fallback={null}>` → `<Suspense fallback={<Skeleton>}`,
 * 避免 useSearchParams 暂态时白屏闪烁(FR-004 / SC-003);Skeleton 占位与
 * 稳态表单外壳高度一致,CLS=0(FR-013)。
 */
function NewTransactionPageInner() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id") ?? undefined;
  // 032 US3: shortcuts 触发时带 ?type=expense|income|transfer,解析为初始类型。
  // edit 模式忽略(editId 存在时 TransactionForm 由 editData.type 决定)。
  // 无效/缺失 → undefined → TransactionForm 默认 expense(回归保护)。
  const defaultType = parseDefaultType(searchParams.get("type"));
  return (
    <div className="mx-auto max-w-[720px]">
      <TransactionForm editId={editId} defaultType={defaultType} />
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-auto max-w-[720px] space-y-4 p-4" aria-busy="true">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-1/2" />
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewTransactionPageInner />
    </Suspense>
  );
}
