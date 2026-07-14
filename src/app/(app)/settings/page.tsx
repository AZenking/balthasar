"use client";

/**
 * 026 Cream/Amber US7 — "我的" (formerly "设置").
 *
 * FR-E001: `/settings` route preserved; copy → "我的"; integrates
 *   1. 个人信息 (nickname + email)
 *   2. 账户管理
 *   3. 分类管理 (link → /settings/categories)
 *   4. API Key 管理
 *   5. 退出登录
 * FR-E002 / FR-E003: nickname mutation lives in `<NicknameEditor>`; the
 * server resolves target member via session.user.id (cross-user isolation).
 *
 * Visual: HeroUI v3 via `@/components/ui/*` adapter layer (Card, Button,
 * Skeleton) + HeroUI-v3 AlertDialog for logout confirm — consistent with the
 * 026 switch migration.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tags, ChevronRight, LogOut, User, KeyRound, Wallet, Palette, Package } from "lucide-react";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/server/auth/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NicknameEditor } from "@/components/settings/nickname-editor";
import { AccountItem } from "@/components/settings/account-item";
import { AccountForm, type AccountFormValues } from "@/components/settings/account-form";
import { ApiKeyManager } from "@/components/settings/api-key-manager";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PageHeader } from "@/components/layout/page-header";

export default function SettingsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  // ── 当前 member / user 信息 (FR-E002 nickname source) ──
  const { data: me, isLoading: meLoading } = trpc.auth.me.useQuery();
  const member = me?.member;
  const email = me?.user.email ?? "";

  // ── 账户 list + mutations (保留原页逻辑) ──
  const { data: accounts, isLoading } = trpc.account.list.useQuery({
    includeArchived: true,
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const createMutation = trpc.account.create.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      utils.dashboard.summary.invalidate();
      setShowCreateForm(false);
    },
  });

  const updateMutation = trpc.account.update.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      setEditingAccountId(null);
    },
  });

  const archiveMutation = trpc.account.archive.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("已归档");
    },
    onError: (err) =>
      toast.error(
        err instanceof TRPCClientError ? err.message : "归档失败",
      ),
  });

  const unarchiveMutation = trpc.account.unarchive.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("已恢复");
    },
    onError: (err) =>
      toast.error(
        err instanceof TRPCClientError ? err.message : "恢复失败",
      ),
  });

  const activeAccounts = (accounts ?? []).filter((a) => a.archivedAt === null);
  const archivedAccounts = (accounts ?? []).filter((a) => a.archivedAt !== null);

  const handleCreate = (values: AccountFormValues) => {
    createMutation.mutate({
      name: values.name,
      currency: values.currency as any,
      initialBalance: values.initialBalanceCents ?? 0,
    });
  };

  const handleEdit = (values: AccountFormValues) => {
    if (!editingAccountId) return;
    updateMutation.mutate({
      id: editingAccountId,
      name: values.name,
      currency: values.currency as any,
    });
  };

  // 025: archive is reversible → no confirm (Q2). Server-first + toast (R5/R6).
  const handleArchive = (id: string) => {
    archiveMutation.mutate({ id });
  };

  const handleUnarchive = (id: string) => {
    unarchiveMutation.mutate({ id });
  };

  const editingAccount = editingAccountId
    ? (accounts ?? []).find((a) => a.id === editingAccountId)
    : null;

  // 026 US7: 退出登录走 AlertDialog 确认(替换原裸 Button)
  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="我的" />

      {/* ── 1. 主题(026-switch 第一期 4:三选主题系统) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-muted-foreground" />
            主题
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ThemeToggle />
        </CardContent>
      </Card>

      {/* ── 2. 个人信息 (FR-E001/FR-E002,前 1.) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" />
            个人信息
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {meLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <>
              {/* NicknameEditor inline row + Modal — owns its own mutation */}
              <NicknameEditor
                currentDisplayName={member?.displayName ?? ""}
                memberId={member?.id ?? ""}
              />
              <div className="flex items-center justify-between border-b py-3">
                <div>
                  <p className="text-sm font-medium">邮箱</p>
                  <p className="text-xs text-muted-foreground">{email}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 2. 账户管理 ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              账户管理
            </CardTitle>
            {!showCreateForm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreateForm(true)}
              >
                新建账户
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {showCreateForm && (
            <div className="mb-4">
              <AccountForm
                mode="create"
                onSubmit={handleCreate}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (activeAccounts ?? []).length === 0 &&
            (archivedAccounts ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              暂无账户,请先创建
            </p>
          ) : (
            <>
              {(activeAccounts ?? []).map((account) =>
                editingAccountId === account.id ? (
                  <div key={account.id} className="my-2">
                    <AccountForm
                      mode="edit"
                      defaultValues={{
                        name: account.name,
                        currency: account.currency,
                      }}
                      onSubmit={handleEdit}
                      onCancel={() => setEditingAccountId(null)}
                    />
                  </div>
                ) : (
                  <AccountItem
                    key={account.id}
                    account={account}
                    onEdit={setEditingAccountId}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                  />
                ),
              )}

              {(archivedAccounts ?? []).length > 0 && (
                <>
                  <p className="mt-4 mb-1 text-xs text-muted-foreground">
                    已归档
                  </p>
                  {(archivedAccounts ?? []).map((account) => (
                    <AccountItem
                      key={account.id}
                      account={account}
                      onEdit={setEditingAccountId}
                      onArchive={handleArchive}
                      onUnarchive={handleUnarchive}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 3. 分类管理入口 (跳转 /settings/categories) ── */}
      <Card className="overflow-hidden p-0">
        <Link
          href="/settings/categories"
          className="flex items-center justify-between p-4 transition-colors hover:bg-accent"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Tags className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">分类管理</p>
              <p className="text-xs text-muted-foreground">
                新增、编辑、归档、排序分类
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      </Card>

      {/* ── 4. API Key 管理 ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ApiKeyManager />
        </CardContent>
      </Card>

      {/* ── 5. 退出登录 (AlertDialog 确认) ── */}
      <Button
        variant="outline"
        className="w-full justify-center gap-2 text-destructive"
        onClick={() => setShowLogoutConfirm(true)}
      >
        <LogOut className="h-4 w-4" />
        退出登录
      </Button>

      {/* 底部签名(可选) */}
      <p className="flex items-center justify-center gap-1 pt-2 text-center text-xs text-muted-foreground">
        <Package className="h-3 w-3" />
        轻记 · 1.0.0
      </p>

      <AlertDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出登录?</AlertDialogTitle>
            <AlertDialogDescription>
              退出后需重新输入账号密码登录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={handleLogout}>
                退出登录
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
