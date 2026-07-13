"use client";

/**
 * NicknameEditor — 026 Cream/Amber US7 (FR-E002 / FR-E003).
 *
 * Inline nickname row with a HeroUI Modal form. The server resolves the
 * target member from `ctx.session.user.id` (cross-user isolation, FR-E003);
 * `memberId` is accepted as a prop purely for future/audit wiring — it is
 * NOT sent to the mutation (server ignores any client-supplied id).
 *
 * Contract: specs/026-cream-amber-revamp/contracts/auth-update-nickname.md
 */

import { useEffect, useState } from "react";
import { TRPCClientError } from "@trpc/client";
import { Modal, Button, Input, Label } from "@heroui/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

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

  // Reset the form whenever the modal opens so stale edits don't linger.
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

      <Modal.Root isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Trigger>
          <Button size="sm" variant="outline">
            编辑
          </Button>
        </Modal.Trigger>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="text-base font-semibold">
                  修改昵称
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-2">
                <Label htmlFor="nickname" isInvalid={isInvalid}>
                  昵称
                </Label>
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
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onPress={handleCancel}
                  isDisabled={updateNickname.isPending}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onPress={handleSubmit}
                  isDisabled={updateNickname.isPending}
                >
                  {updateNickname.isPending ? "保存中..." : "保存"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </div>
  );
}
