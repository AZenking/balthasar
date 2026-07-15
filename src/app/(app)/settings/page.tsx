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
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  Gauge,
  Tags,
  EyeOff,
  Palette,
  ArrowDownUp,
  CircleHelp,
  Info,
  ChevronRight,
  ChevronDown,
  Trash2,
  type LucideIcon,
} from "lucide-react";
// TODO v2: 以下图标随账本管理/记账提醒/默认账户/云同步/本地备份 一并恢复
// NotebookTabs, BellRing, Landmark, Cloud, DatabaseBackup
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc/client";
import { isPrivacyOn, setPrivacy } from "@/lib/privacy";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NicknameEditor } from "@/components/settings/nickname-editor";
import { AccountForm } from "@/components/settings/account-form";
import { AccountItem } from "@/components/settings/account-item";
import { ApiKeyManager } from "@/components/settings/api-key-manager";
import {
  Card,
  Switch,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const createMutation = trpc.account.create.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      utils.dashboard.summary.invalidate();
      setShowCreateForm(false);
      toast.success("已创建");
    },
    onError: (err) =>
      toast.error(err instanceof TRPCClientError ? err.message : "创建失败"),
  });
  const updateMutation = trpc.account.update.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      setEditingAccountId(null);
      toast.success("已保存");
    },
    onError: (err) =>
      toast.error(err instanceof TRPCClientError ? err.message : "保存失败"),
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

  // 当前主题文本值(显示在"外观主题"右侧)
  const [themeLabel, setThemeLabel] = useState("跟随系统");
  useEffect(() => {
    try {
      const t = localStorage.getItem("balthasar.theme") || "system";
      setThemeLabel(t === "dark" ? "深色" : t === "light" ? "浅色" : "跟随系统");
    } catch {
      // SSR / 无 localStorage
    }
  }, []);
  const editingAccount = editingAccountId
    ? (accounts ?? []).find((a) => a.id === editingAccountId)
    : null;

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      {/* ── 顶部标题 ── */}
      <h1 className="pt-2 text-lg font-medium">设置</h1>

      {/* ── 个人资料卡(垂直居中:头像独占一行 + 昵称 + 铅笔编辑) ── */}
      <Card>
        <Card.Content className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--muted)] text-xl font-medium">
            {(member?.displayName ?? "?").charAt(0)}
          </div>
          <div className="flex items-center justify-center gap-1">
            <span className="text-base font-semibold">
              {member?.displayName ?? "未设置昵称"}
            </span>
            <NicknameEditor
              currentDisplayName={member?.displayName ?? ""}
              memberId={member?.id ?? ""}
            />
          </div>
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
          {!isLoading && (
            <>
              {/* 账户列表 —— 普通 div + map。
                  不用 ListBox:AccountItem 行内有独立的 ⋯ Popover 菜单,
                  嵌套在 ListBox.Item(可聚焦 Option)内会拦截点击、破坏
                  focus 链,导致 Popover 打不开。ListBox 仅适合"整行单一
                  动作"的列表。新建/编辑用 Dialog 弹窗(对齐 category-manager)。 */}
              {activeAccounts.map((acc) => (
                <AccountItem
                  key={acc.id}
                  account={acc}
                  onEdit={setEditingAccountId}
                  onArchive={(id) => archiveMutation.mutate({ id })}
                  onUnarchive={(id) => unarchiveMutation.mutate({ id })}
                />
              ))}
              {activeAccounts.length === 0 && (
                <p className="py-2 text-xs text-muted-foreground">
                  还没有账户,点「新建账户」开始。
                </p>
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
        {/* TODO v2: 账本管理(下个版本) */}
        {/* <SettingsRow icon={NotebookTabs} label="账本管理" value="我的账本" onClick={v2Toast} /> */}
        <SettingsLinkRow icon={Tags} label="分类与标签" href="/settings/categories" />
        <SettingsRow icon={Gauge} label="预算设置" value={budgetAmount != null ? formatCents(budgetAmount) : "未设置"} onClick={() => router.push("/dashboard")} />
      </SettingsGroup>

      {/* ── 偏好设置(顺序:隐私 → 提醒 → 默认账户 → 主题) ── */}
      <SettingsGroup title="偏好设置">
        <SettingsToggleRow icon={EyeOff} label="隐私保护">
          <PrivacyToggleInline />
        </SettingsToggleRow>
        {/* TODO v2: 记账提醒 + 默认账户(下个版本) */}
        {/* <SettingsRow icon={BellRing} label="记账提醒" value="未开启" onClick={v2Toast} /> */}
        {/* <SettingsRow icon={Landmark} label="默认账户" value="未设置" onClick={v2Toast} /> */}
        <SettingsRow
          icon={Palette}
          label="外观主题"
          value={themeLabel}
          onClick={() => {}}
          expandable
        >
          <div className="pt-2">
            <ThemeToggle />
          </div>
        </SettingsRow>
      </SettingsGroup>

      {/* ── 数据与同步 ── */}
      <SettingsGroup title="数据与同步">
        {/* TODO v2: 云同步 + 本地备份(下个版本) */}
        {/* <SettingsRow
          icon={Cloud}
          label="云同步"
          value={email ? "已同步" : "登录后开启"}
          onClick={v2Toast}
        /> */}
        {/* <SettingsRow icon={DatabaseBackup} label="本地备份" value="从未备份" onClick={v2Toast} /> */}
        <SettingsRow icon={ArrowDownUp} label="导入与导出" value="即将上线" onClick={v2Toast} />
      </SettingsGroup>

      {/* ── 其他 ── */}
      <SettingsGroup title="其他">
        <SettingsRow icon={CircleHelp} label="帮助与反馈" value="即将上线" onClick={v2Toast} />
        <SettingsRow icon={Info} label="关于" value={`v${packageJson.version}`} onClick={v2Toast} />
      </SettingsGroup>

      {/* ── API Key(开发者) ── */}
      <SettingsGroup title="开发者">
        <SettingsRow
          icon={Tags}
          label="API Key 管理"
          onClick={() => {}}
          expandable
        >
          {/* expandable 行:展开/收起由 SettingsRow 内部 isOpen 管理。
              旧实现套了 {showApiKey && ...} 门控,但 expandable 分支不调
              onClick → showApiKey 永远为 false → 展开后内容为空,看着像"点了没反应"。
              对齐"外观主题/账户管理"行:children 直接渲染即可。 */}
          <ApiKeyManager />
        </SettingsRow>
      </SettingsGroup>

      {/* ── 危险区(占位:功能未上线,禁用避免误导) ── */}
      <div>
        <Card>
          <Card.Content className="divide-y p-0">
            <SettingsRow
              icon={Trash2}
              label="清空全部数据"
              value="即将上线"
              disabled
              onClick={() => {}}
            />
          </Card.Content>
        </Card>
      </div>

      {/* ── 退出 ── */}
      <Button
        variant="outline"
        className="w-full justify-center gap-2 text-[var(--danger)]"
        onClick={() => setShowLogoutConfirm(true)}
      >
        退出登录
      </Button>

      <div className="pb-4 pt-2 text-center text-xs text-muted-foreground">
        <p className="font-medium">BALTHASAR</p>
        <p className="mt-1">版本 v{packageJson.version}</p>
      </div>

      {/* ── 账户管理:新建/编辑 Dialog(对齐 category-manager) ── */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建账户</DialogTitle>
          </DialogHeader>
          <AccountForm
            mode="create"
            submitting={createMutation.isPending}
            onSubmit={(v) =>
              createMutation.mutate({
                name: v.name,
                currency: v.currency,
                initialBalance: v.initialBalanceCents,
                type: v.type,
              })
            }
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingAccountId}
        onOpenChange={(v) => { if (!v) setEditingAccountId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑账户</DialogTitle>
          </DialogHeader>
          {editingAccount && (
            <AccountForm
              key={editingAccount.id}
              mode="edit"
              submitting={updateMutation.isPending}
              defaultValues={{
                name: editingAccount.name,
                currency: editingAccount.currency,
                type: editingAccount.type,
              }}
              onSubmit={(v) =>
                updateMutation.mutate({
                  id: editingAccount.id,
                  name: v.name,
                  currency: v.currency,
                  type: v.type,
                })
              }
              onCancel={() => setEditingAccountId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

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
                disabled={isLoggingOut}
                onClick={async () => {
                  setIsLoggingOut(true);

                  try {
                    const { authClient } = await import("@/server/auth/client");
                    const signOutResult = await authClient.signOut();

                    if (signOutResult.error) {
                      throw new Error(
                        signOutResult.error.message || "退出登录失败，请重试"
                      );
                    }

                    // Do not redirect until the server confirms the cookie no
                    // longer resolves to a session. Otherwise /login's auth
                    // layout correctly redirects the still-authenticated user
                    // straight back to /dashboard.
                    const sessionResult = await authClient.getSession();
                    if (sessionResult.error) {
                      throw new Error(
                        sessionResult.error.message || "无法确认退出状态，请重试"
                      );
                    }
                    if (sessionResult.data) {
                      throw new Error("会话仍未清除，请重试");
                    }

                    // Full replacement forces the server auth layout to run
                    // again and keeps Dashboard out of browser history.
                    window.location.replace("/login");
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : "退出登录失败，请重试";
                    toast.error(message);
                    setIsLoggingOut(false);
                  }
                }}
              >
                {isLoggingOut ? "正在退出…" : "退出登录"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── 隐私开关(内联 toggle,HeroUI Switch,直接在设置页操作) ──
function PrivacyToggleInline() {
  // 惰性初始化:消除旧实现"用 useState 当 effect"在 render 期 setState 的反模式。
  const [on, setOn] = useState(() => isPrivacyOn());
  return (
    <Switch
      aria-label="隐私保护"
      isSelected={on}
      onChange={(selected) => {
        setPrivacy(selected);
        setOn(selected);
      }}
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
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
  disabled,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  onClick: () => void;
  expandable?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const handle = () => {
    if (disabled) return;
    if (expandable) setIsOpen(!isOpen);
    else onClick();
  };
  // 展开面板 id,用于 aria-controls 关联(屏幕阅读器感知展开状态)
  const panelId = `${label}-panel`;
  return (
    <div>
      <button
        type="button"
        onClick={handle}
        disabled={disabled}
        aria-expanded={expandable ? isOpen : undefined}
        aria-controls={expandable ? panelId : undefined}
        className={cn(
          "flex w-full items-center justify-between px-4 py-3 text-left",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:bg-[var(--muted)]",
        )}
      >
        <span className="flex items-center gap-3 text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </span>
        <span className="flex items-center gap-2">
          {value && <span className="text-xs text-muted-foreground">{value}</span>}
          {expandable ? (
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180",
              )}
            />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
      </button>
      {isOpen && children && (
        <div id={panelId} className="px-4 pb-3">{children}</div>
      )}
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
