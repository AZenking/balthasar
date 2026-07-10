"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CategoryManager } from "@/components/settings/category-manager";

/**
 * /settings/categories — 分类管理页 (023-category-ui T006/T010).
 */
export default function CategoriesSettingsPage() {
  return (
    <div className="p-4 pt-6">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/settings"
          aria-label="返回设置"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">分类管理</h1>
      </div>

      <CategoryManager />
    </div>
  );
}
