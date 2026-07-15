"use client";

/**
 * 设置页 (027-mobile-home-revamp,线稿对齐)。
 *
 * 线稿结构:紧凑分组列表,非大卡片堆叠。
 *
 * 分组:
 *   1. 个人资料卡(头像 + 昵称 + 本地/登录状态)
 *   2. 记账管理:账户管理、账本管理(V2)、分类与标签、预算设置
 *   3. 偏好设置:隐私保护、记账提醒(V2)、默认账户(V2)、外观主题
 *   4. 数据与同步:云同步(V2)、本地备份(V2)、导入与导出(V2)
 *   5. 其他:帮助与反馈(V2)、关于
 *   6. 危险区:清空全部数据(V2)
 *
 * V2 入口点击 toast 提示"即将上线"。
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  NotebookTabs,
  Gauge,
  Tags,
  EyeOff,
  BellRing,
  Landmark,
  Palette,
  Cloud,
  DatabaseBackup,
  ArrowDownUp,
  CircleHelp,
  Info,
  ChevronRight,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { isPrivacyOn, setPrivacy } from "@/lib/privacy";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NicknameEditor } from "@/components/settings/nickname-editor";
import { AccountForm, type AccountFormValues } from "@/components/settings/account-form";
import { AccountItem } from "@/components/settings/account-item";
import { ApiKeyManager } from "@/components/settings/api-key-manager";
import {
  Card,
} from "@heroui/react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import packageJson from "@/../package.json";

const v2Toast = () => toast.info("该功能即将上线");

export default function SettingsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: accounts, isLoading } = trpc.account.list.useQuery({
    includeArchived: true,
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

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
    onError: (err) => toast.error(err.message),
  });
  const unarchiveMutation = trpc.account.unarchive.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("已恢复");
    },
    onError: (err) => toast.error(err.message),
  });

  const member = me?.member;
  const email = me?.user.email ?? "";
  const activeAccounts = (accounts ?? []).filter((a) => a.archivedAt === null);
  const archivedAccounts = (accounts ?? []).filter((a) => a.archivedAt !== null);

  // 当前月预算(显示在"预算设置"右侧)
  const now = new Date();
  const { data: budgetData } = trpc.dashboard.budget.get.useQuery({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  });
  const budgetAmount = budgetData?.amount;
  const formatCents = (cents: number) => `¥${(cents / 100).toFixed(0)}`;
  const editingAccount = editingAccountId
    ? (accounts ?? []).find((a) => a.id === editingAccountId)
    : null;

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      {/* ── 顶部标题 ── */}
      <h1 className="pt-2 text-lg font-medium">设置</h1>

      {/* ── 个人资料卡 ── */}
      <Card>
        <Card.Content className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--muted)] text-lg font-medium">
              {(member?.displayName ?? "?").charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {member?.displayName ?? "未设置昵称"}
              </p>
              <p className="text-xs text-muted-foreground">
                {email ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                    已同步 · {email}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)]" />
                    本地使用
                  </span>
                )}
              </p>
            </div>
          </div>
          <NicknameEditor
            currentDisplayName={member?.displayName ?? ""}
            memberId={member?.id ?? ""}
          />
        </Card.Content>
      </Card>

      {/* ── 记账管理 ── */}
      <SettingsGroup title="记账管理">
        <SettingsRow
          icon={Wallet}
          label="账户管理"
          value={`${activeAccounts.length} 个账户`}
          onClick={() => {}}
          expandable
        >
          {showCreateForm && (
            <AccountForm
              mode="create"
              onSubmit={(v: AccountFormValues) =>
                createMutation.mutate({
                  name: v.name,
                  currency: v.currency as any,
                  initialBalance: v.initialBalanceCents ?? 0,
                  type: v.type,
                })
              }
              onCancel={() => setShowCreateForm(false)}
            />
          )}
          {!showCreateForm && !isLoading && (
            <>
              {activeAccounts.map((acc) =>
                editingAccountId === acc.id ? (
                  <AccountForm
                    key={acc.id}
                    mode="edit"
                    defaultValues={{ name: acc.name, currency: acc.currency, type: acc.type }}
                    onSubmit={(v: AccountFormValues) =>
                      updateMutation.mutate({
                        id: acc.id,
                        name: v.name,
                        currency: v.currency as any,
                        type: v.type,
                      })
                    }
                    onCancel={() => setEditingAccountId(null)}
                  />
                ) : (
                  <AccountItem
                    key={acc.id}
                    account={acc}
                    onEdit={setEditingAccountId}
                    onArchive={(id) => archiveMutation.mutate({ id })}
                    onUnarchive={(id) => unarchiveMutation.mutate({ id })}
                  />
                ),
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreateForm(true)}
                className="mt-2"
              >
                新建账户
              </Button>
            </>
          )}
        </SettingsRow>
        <SettingsRow icon={NotebookTabs} label="账本管理" value="我的账本" onClick={v2Toast} />
        <SettingsLinkRow icon={Tags} label="分类与标签" href="/settings/categories" />
        <SettingsRow icon={Gauge} label="预算设置" value={budgetAmount ? formatCents(budgetAmount) : "未设置"} onClick={() => router.push("/dashboard")} />
      </SettingsGroup>

      {/* ── 偏好设置 ── */}
      <SettingsGroup title="偏好设置">
        <SettingsToggleRow icon={EyeOff} label="隐私保护">
          <PrivacyToggleInline />
        </SettingsToggleRow>
        <SettingsToggleRow icon={Palette} label="外观主题">
          <ThemeToggle />
        </SettingsToggleRow>
        <SettingsRow icon={BellRing} label="记账提醒" value="未开启" onClick={v2Toast} />
        <SettingsRow icon={Landmark} label="默认账户" value={activeAccounts[0]?.name ?? "未设置"} onClick={v2Toast} />
      </SettingsGroup>

      {/* ── 数据与同步 ── */}
      <SettingsGroup title="数据与同步">
        <SettingsRow
          icon={Cloud}
          label="云同步"
          value={email ? "已同步" : "登录后开启"}
          onClick={v2Toast}
        />
        <SettingsRow icon={DatabaseBackup} label="本地备份" value="今天" onClick={v2Toast} />
        <SettingsRow icon={ArrowDownUp} label="导入与导出" onClick={v2Toast} />
      </SettingsGroup>

      {/* ── 其他 ── */}
      <SettingsGroup title="其他">
        <SettingsRow icon={CircleHelp} label="帮助与反馈" onClick={v2Toast} />
        <SettingsRow icon={Info} label="关于" value={`v${packageJson.version}`} onClick={v2Toast} />
      </SettingsGroup>

      {/* ── API Key(开发者) ── */}
      <SettingsGroup title="开发者">
        <SettingsRow
          icon={Tags}
          label="API Key 管理"
          onClick={() => setShowApiKey(!showApiKey)}
          expandable
        >
          {showApiKey && <ApiKeyManager />}
        </SettingsRow>
      </SettingsGroup>

      {/* ── 危险区 ── */}
      <SettingsGroup title="">
        <SettingsRow
          icon={Trash2}
          label="清空全部数据"
          onClick={() => toast.error("此操作不可撤销,请确认后联系管理员")}
        />
      </SettingsGroup>

      {/* ── 退出 ── */}
      <Button
        variant="outline"
        className="w-full justify-center gap-2 text-destructive"
        onClick={() => setShowLogoutConfirm(true)}
      >
        退出登录
      </Button>

      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
        <p className="font-medium">BALTHASAR</p>
        <p className="mt-1">版本 v{packageJson.version}</p>
      </div>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出登录?</AlertDialogTitle>
            <AlertDialogDescription>退出后需重新输入账号密码登录。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={async () => {
                  const { authClient } = await import("@/server/auth/client");
                  await authClient.signOut();
                  router.push("/login");
                }}
              >
                退出登录
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── 隐私开关(内联 toggle,直接在设置页操作) ──
function PrivacyToggleInline() {
  const [on, setOn] = useState(false);
  useState(() => {
    setOn(isPrivacyOn());
  });
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        const next = !on;
        setPrivacy(next);
        setOn(next);
      }}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        on ? "bg-[var(--primary)]" : "bg-[var(--muted)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
          on ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

// ── 紧凑分组列表组件 ──

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">{title}</p>
      <Card>
        <Card.Content className="divide-y p-0">{children}</Card.Content>
      </Card>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  onClick,
  expandable,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  onClick: () => void;
  expandable?: boolean;
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const handle = () => {
    if (expandable) setIsOpen(!isOpen);
    else onClick();
  };
  return (
    <div>
      <button
        type="button"
        onClick={handle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--muted)]"
      >
        <span className="flex items-center gap-3 text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </span>
        {value && <span className="text-xs text-muted-foreground">{value}</span>}
        {!expandable && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {isOpen && children && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function SettingsLinkRow({
  icon: Icon,
  label,
  href,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-3 hover:bg-[var(--muted)]"
    >
      <span className="flex items-center gap-3 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function SettingsToggleRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="flex items-center gap-3 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      {children}
    </div>
  );
}
