"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CategoryManager } from "@/components/settings/category-manager";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * /settings/categories — 分类管理页 (023-category-ui T006/T010).
 *
 * 026-switch 调整:外层 padding 由 AppShell 注入,标题行用 PageHeader。
 * 返回按钮放 leading(标题左侧)以匹配左上返回的通用心智;actions 留给
 * 真正的页面动作(新增等)。返回键用 <Link> + buttonVariants("ghost"/"icon")
 * (HeroUI Button 的 asChild 是 no-op,导航场景须走原生 <Link>)。
 */
export default function CategoriesSettingsPage() {
  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader
        title="分类管理"
        leading={
          <Link
            href="/settings"
            aria-label="返回设置"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "shrink-0",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      />
      <CategoryManager />
    </div>
  );
}
