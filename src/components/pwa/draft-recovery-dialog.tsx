"use client";

import { AlertDialog, Button } from "@heroui/react";

export interface DraftRecoveryDialogProps {
  isOpen: boolean;
  /** Display-only timestamp of the most recent save. Never include form fields. */
  savedAt: string;
  /** User chose 恢复 — fill the form once from the saved draft. */
  onRestore: () => void;
  /** User chose 丢弃 — delete the draft and start fresh. */
  onDiscard: () => void;
  /** User chose 稍后 or pressed Esc/backdrop — keep the draft, leave the form empty. */
  onClose: () => void;
}

/**
 * AlertDialog shown when a valid transaction draft exists for the current
 * account. The dialog deliberately shows only the save time — no account,
 * amount, category, or remark text — until the user explicitly opts in to
 * 恢复. Closing without picking does not auto-fill.
 */
export function DraftRecoveryDialog({
  isOpen,
  savedAt,
  onRestore,
  onDiscard,
  onClose,
}: DraftRecoveryDialogProps) {
  return (
    <AlertDialog isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>发现未提交草稿</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-muted-foreground">
                保存时间：{savedAt}。是否恢复继续编辑？
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="flex justify-end gap-2">
              <Button variant="ghost" onPress={onClose}>
                稍后
              </Button>
              <Button variant="outline" onPress={onDiscard}>
                丢弃
              </Button>
              <Button variant="primary" onPress={onRestore}>
                恢复
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
