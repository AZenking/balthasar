"use client";

/**
 * NicknameEditor — 026 Cream/Amber US7 (FR-E002 / FR-E003).
 *
 * Inline nickname row with a Dialog form. The server resolves the
 * target member from `ctx.session.user.id` (cross-user isolation, FR-E003);
 * `memberId` is accepted as a prop purely for future/audit wiring — it is
 * NOT sent to the mutation (server ignores any client-supplied id).
 *
 * Contract: specs/026-cream-amber-revamp/contracts/auth-update-nickname.md
 *
 * 一致性:与 category/account 等同类表单统一用 shadcn Dialog 外壳 + 适配器
 * Button/Input/Label(原 HeroUI 原生 Modal 复合 API + 原生 Button/Input/Label 样板冗余)。
 */

import { useEffect, useState } from "react";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const NICKNAME_MAX = 30;

interface Props {
  /** Current member.displayName (read from auth.me). */
  currentDisplayName: string;
  /**
   * Resolved member id. Kept for component API symmetry; the mutation does
   * NOT send it (server resolves target via session.user.id — FR-E003).
   */
  memberId: string;
  /** Optional parent callback once the server returns the new name. */
  onUpdated?: (newName: string) => void;
}

export function NicknameEditor({
  currentDisplayName,
  memberId: _memberId,
  onUpdated,
}: Props) {
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(currentDisplayName);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the dialog opens so stale edits don't linger.
  useEffect(() => {
    if (isOpen) {
      setValue(currentDisplayName);
      setError(null);
    }
  }, [isOpen, currentDisplayName]);

  const updateNickname = trpc.auth.updateNickname.useMutation({
    onSuccess: (data) => {
      // Contract §5: invalidate auth.me so the greeting / settings row
      // re-render with the fresh displayName.
      utils.auth.me.invalidate();
      toast.success("昵称已更新");
      setIsOpen(false);
      onUpdated?.(data.member.displayName);
    },
    onError: (err) => {
      // Server zod errors carry a localized message; surface it verbatim.
      if (err instanceof TRPCClientError) {
        toast.error(err.message || "更新失败");
        return;
      }
      // Network / unknown transport errors.
      toast.error("网络错误,请稍后再试");
    },
  });

  const validate = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return "昵称不能为空";
    if (trimmed.length > NICKNAME_MAX) return "昵称不超过 30 字符";
    return null;
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    const msg = validate(trimmed);
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    updateNickname.mutate({ displayName: trimmed });
  };

  const handleCancel = () => {
    setIsOpen(false);
    setError(null);
  };

  const isInvalid = error !== null;

  return (
    <div className="flex items-center justify-between border-b py-3">
      <div>
        <p className="text-sm font-medium">昵称</p>
        <p className="text-xs text-muted-foreground">{currentDisplayName}</p>
      </div>

      <Button size="sm" variant="outline" onClick={() => setIsOpen(true)}>
        编辑
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改昵称</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nickname">昵称</Label>
            <Input
              id="nickname"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              maxLength={NICKNAME_MAX}
              autoFocus
              aria-invalid={isInvalid || undefined}
              aria-describedby={isInvalid ? "nickname-error" : undefined}
              placeholder="请输入昵称"
              className={cn(
                isInvalid &&
                  "border-destructive ring-destructive focus-visible:ring-destructive",
              )}
            />
            {isInvalid && (
              <p
                id="nickname-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={updateNickname.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={updateNickname.isPending}
            >
              {updateNickname.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
