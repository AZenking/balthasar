"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CategoryManager } from "@/components/settings/category-manager";
import { PageHeader } from "@/components/layout/page-header";

/**
 * /settings/categories — 分类管理页 (023-category-ui T006/T010).
 *
 * 026-switch 调整:外层 padding 由 AppShell 注入,标题行用 PageHeader(带
 * 返回按钮作为 actions)。返回按钮放 PageHeader.actions 是为了与其它主
 * 页面的 header 结构保持一致(标题左、操作右)。
 */
export default function CategoriesSettingsPage() {
  return (
    <div>
      <PageHeader
        title="分类管理"
        actions={
          <Link
            href="/settings"
            aria-label="返回设置"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      />
      <CategoryManager />
    </div>
  );
}
