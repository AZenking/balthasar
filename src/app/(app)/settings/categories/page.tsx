"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@heroui/react";
import { CategoryManager } from "@/components/settings/category-manager";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

/**
 * /settings/categories — 分类管理页 (023-category-ui T006/T010).
 *
 * 标题行用 PageHeader。返回按钮放 leading(标题左侧)以匹配左上返回的
 * 通用心智;actions 留给真正的页面动作(新增等)。返回键用 <Link> +
 * buttonVariants(HeroUI 原生,给原生元素套按钮样式)。
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
              buttonVariants({ variant: "ghost", size: "sm" }),
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
