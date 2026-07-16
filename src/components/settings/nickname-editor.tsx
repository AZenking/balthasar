"use client";

/**
 * NicknameEditor — 026 Cream/Amber US7 (FR-E002 / FR-E003).
 *
 * 图标按钮 + Dialog 弹窗。调用方把昵称文字直接展示在头像区,本组件
 * 只渲染一个铅笔图标按钮(触发器)+ 修改弹窗,不再重复显示昵称。
 *
 * Server resolves the target member from `ctx.session.user.id` (cross-user
 * isolation, FR-E003); `memberId` is accepted as a prop purely for future/
 * audit wiring — it is NOT sent to the mutation.
 *
 * Contract: specs/026-cream-amber-revamp/contracts/auth-update-nickname.md
 */

import { useEffect, useState } from "react";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Button, Input, Label, Modal } from "@heroui/react";

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
      utils.auth.me.invalidate();
      toast.success("昵称已更新");
      setIsOpen(false);
      onUpdated?.(data.member.displayName);
    },
    onError: (err) => {
      if (err instanceof TRPCClientError) {
        toast.error(err.message || "更新失败");
        return;
      }
      toast.error("网络错误,请稍后再试");
    },
  });

  const validate = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return "昵称不能为空";
    if (trimmed.length > NICKNAME_MAX) return "昵称不超过 30 字符";
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    <>
      {/* 图标触发器:铅笔,紧贴昵称文字旁 */}
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        className="h-7 w-7 cursor-pointer text-muted hover:text-foreground"
        aria-label="修改昵称"
        onPress={() => setIsOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>修改昵称</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <form onSubmit={handleSubmit} className="grid gap-2">
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
                        "border-danger ring-danger focus-visible:ring-danger",
                    )}
                  />
                  {isInvalid && (
                    <p
                      id="nickname-error"
                      className="text-xs text-danger"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}
                  <Modal.Footer className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onPress={handleCancel}
                      isDisabled={updateNickname.isPending}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      isDisabled={updateNickname.isPending}
                    >
                      {updateNickname.isPending ? "保存中..." : "保存"}
                    </Button>
                  </Modal.Footer>
                </form>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
