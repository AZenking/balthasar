"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/server/auth/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountItem } from "@/components/settings/account-item";
import { AccountForm, type AccountFormValues } from "@/components/settings/account-form";
import { ApiKeyManager } from "@/components/settings/api-key-manager";

export default function SettingsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: accounts, isLoading } = trpc.account.list.useQuery({
    includeArchived: true,
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

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
    },
  });

  const unarchiveMutation = trpc.account.unarchive.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
    },
  });

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

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

  const handleArchive = (id: string) => {
    if (!window.confirm("确认归档?此操作不影响已有交易")) return;
    archiveMutation.mutate({ id });
  };

  const handleUnarchive = (id: string) => {
    unarchiveMutation.mutate({ id });
  };

  const editingAccount = editingAccountId
    ? (accounts ?? []).find((a) => a.id === editingAccountId)
    : null;

  return (
    <div className="p-4 pt-6">
      <h1 className="mb-4 text-xl font-bold">设置</h1>

      {/* 账户管理 */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">账户管理</h2>
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
        ) : (activeAccounts ?? []).length === 0 && (archivedAccounts ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            暂无账户,请先创建
          </p>
        ) : (
          <>
            {/* 活跃账户 */}
            {(activeAccounts ?? []).map((account) =>
              editingAccountId === account.id ? (
                <div key={account.id} className="my-2">
                  <AccountForm
                    mode="edit"
                    defaultValues={{ name: account.name, currency: account.currency }}
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
              )
            )}

            {/* 归档账户 */}
            {(archivedAccounts ?? []).length > 0 && (
              <>
                <p className="mt-4 mb-1 text-xs text-muted-foreground">已归档</p>
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
      </div>

      {/* API Key 管理 */}
      <ApiKeyManager />

      {/* 登出 */}
      <Button variant="outline" onClick={handleLogout} className="w-full text-destructive">
        登出
      </Button>
    </div>
  );
}
