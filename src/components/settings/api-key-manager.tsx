"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import {
  Copy,
  KeyRound,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  AlertDialog,
  Button,
  Input,
  Label,
  Modal,
  Skeleton,
  Tooltip,
} from "@heroui/react";
import { EmptyState } from "@/components/feedback/empty-state";
import { cn } from "@/lib/utils";

/** 单用户有效 key 上限(与后端 MAX_KEYS_PER_USER 一致)。 */
const MAX_ACTIVE_KEYS = 5;

/** list 返回的 key 形状(tRPC 推断)。 */
type ApiKeyRow = {
  id: string;
  keyPrefix: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export function ApiKeyManager() {
  const utils = trpc.useUtils();

  // create 流程:名称输入 + 创建 Dialog
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  // 创建成功后的一次性明文密钥(仅此刻有,关闭即丢)
  const [newKey, setNewKey] = useState<string | null>(null);
  // 吊销二次确认目标
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);

  const { data: keys, isLoading } = trpc.apiKey.list.useQuery();

  const createMutation = trpc.apiKey.create.useMutation({
    onSuccess: (data) => {
      setNewKey(data.plainKey);
      setName("");
      setShowCreate(false);
      utils.apiKey.list.invalidate();
      toast.success("已生成");
    },
    onError: (err) =>
      toast.error(err instanceof TRPCClientError ? err.message : "生成失败"),
  });
  const revokeMutation = trpc.apiKey.revoke.useMutation({
    onSuccess: () => {
      utils.apiKey.list.invalidate();
      toast.success("已吊销");
    },
    onError: (err) =>
      toast.error(err instanceof TRPCClientError ? err.message : "吊销失败"),
  });

  const activeKeys = (keys ?? []).filter((k) => k.revokedAt === null);
  const revokedKeys = (keys ?? []).filter((k) => k.revokedAt !== null);
  const capReached = activeKeys.length >= MAX_ACTIVE_KEYS;

  const handleCreate = () => {
    createMutation.mutate({ name: name.trim() || "默认" });
  };

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    revokeMutation.mutate(
      { id: revokeTarget.id },
      { onSettled: () => setRevokeTarget(null) },
    );
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success("已复制");
    } catch {
      toast.error("复制失败,请手动选择复制");
    }
  };

  return (
    <div className="pt-1">
      {/* header:计数 + 生成按钮(达上限禁用) */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted">
          {activeKeys.length} / {MAX_ACTIVE_KEYS} 个有效
        </p>
        <Button
          size="sm"
          variant="outline"
          isDisabled={capReached}
          onPress={() => setShowCreate(true)}
          aria-label={capReached ? `已达上限 ${MAX_ACTIVE_KEYS} 个` : "生成 Key"}
        >
          生成 Key
        </Button>
      </div>

      {/* loading */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : keys && keys.length === 0 ? (
        /* 空状态 */
        <EmptyState
          icon={KeyRound}
          title="还没有 API Key"
          description="生成一个 Key 用于调用 Open API(如浏览器插件、自动化脚本)。"
          action={
            <Button size="sm" onPress={() => setShowCreate(true)}>
              生成 Key
            </Button>
          }
          className="min-h-[20vh]"
        />
      ) : (
        <>
          {/* 有效 key 列表 —— 普通 div + map。
              不用 ListBox:KeyRow 行内有独立的吊销按钮 + ⋯ 菜单等交互控件,
              嵌套在 ListBox.Item 内会拦截点击、破坏 focus 链。 */}
          <div className="space-y-1">
            {activeKeys.map((k) => (
              <KeyRow key={k.id} k={k} onRevoke={() => setRevokeTarget(k)} />
            ))}
          </div>

          {/* 已吊销分组 */}
          {revokedKeys.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs text-muted">已吊销</p>
              <div className="space-y-1">
                {revokedKeys.map((k) => (
                  <KeyRow key={k.id} k={k} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 创建 Dialog */}
      <Modal isOpen={showCreate} onOpenChange={setShowCreate}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>生成 API Key</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="keyName" className="mb-1 block">
                      名称
                    </Label>
                    <Input
                      id="keyName"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="如:浏览器插件"
                      maxLength={50}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreate();
                      }}
                      autoFocus
                    />
                    <p className="mt-1 text-xs text-muted">
                      用于区分这个 Key 的用途,创建后不可改名。
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onPress={() => setShowCreate(false)}
                      isDisabled={createMutation.isPending}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      onPress={handleCreate}
                      isDisabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? "生成中…" : "生成"}
                    </Button>
                  </div>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* 一次性密钥披露 Dialog(create 成功后) */}
      <Modal
        isOpen={!!newKey}
        onOpenChange={(v) => { if (!v) setNewKey(null); }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-2">
                  <TriangleAlert className="h-5 w-5 text-[var(--warning)]" />
                  密钥已生成
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    请立即复制保存。<strong className="text-foreground">关闭后无法再次查看</strong>
                    ,丢失只能重新生成。
                  </p>
                  <div className="flex items-center gap-2 rounded-md border bg-default/40 p-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-xs">
                      {newKey}
                    </code>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button
                          type="button"
                          variant="ghost"
                          isIconOnly
                          size="sm"
                          className="h-8 w-8 shrink-0"
                          onPress={() => newKey && copyKey(newKey)}
                          aria-label="复制密钥"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>复制</Tooltip.Content>
                    </Tooltip>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" onPress={() => setNewKey(null)}>
                      我已保存
                    </Button>
                  </div>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* 吊销二次确认 */}
      <AlertDialog
        isOpen={!!revokeTarget}
        onOpenChange={(v) => { if (!v) setRevokeTarget(null); }}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>吊销 API Key</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-sm text-muted">
                  {revokeTarget
                    ? `确定吊销「${revokeTarget.name}」?吊销后该 Key 立即失效,且无法恢复。`
                    : "确定吊销此 Key?吊销后该 Key 立即失效,且无法恢复。"}
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer className="flex justify-end gap-2">
                <Button variant="outline" onPress={() => setRevokeTarget(null)}>
                  取消
                </Button>
                <Button
                  variant="danger"
                  onPress={confirmRevoke}
                  isDisabled={revokeMutation.isPending}
                >
                  {revokeMutation.isPending ? "吊销中…" : "吊销"}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  );
}

/** 单个 key 行。有效 key 带 onRevoke;已吊销 key 无操作。 */
function KeyRow({
  k,
  onRevoke,
}: {
  k: ApiKeyRow;
  onRevoke?: () => void;
}) {
  const isRevoked = k.revokedAt !== null;
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border px-3 py-2",
        isRevoked && "opacity-50",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              isRevoked ? "bg-default" : "bg-[var(--success)]",
            )}
            aria-hidden
          />
          <p className="truncate text-sm font-medium">{k.name}</p>
          {isRevoked && (
            <span className="shrink-0 rounded-full bg-default px-1.5 py-0.5 text-[10px] text-muted">
              已吊销
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-muted">
          {k.keyPrefix}••••
        </p>
        <p className="mt-0.5 text-xs text-muted">
          创建于 {formatDate(k.createdAt)}
          {k.lastUsedAt
            ? ` · 最近使用 ${formatDate(k.lastUsedAt)}`
            : " · 从未使用"}
        </p>
      </div>
      {onRevoke && (
        <Tooltip>
          <Tooltip.Trigger>
            <Button
              variant="ghost"
              isIconOnly
              size="sm"
              className="min-h-[44px] min-w-[44px] text-[var(--danger)] hover:text-[var(--danger)]"
              onPress={onRevoke}
              aria-label={`吊销 ${k.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>吊销</Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}

/** 统一日期格式(对齐 recent-transactions / transaction-list-item)。 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
