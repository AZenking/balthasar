"use client";

import { useState } from "react";
import { AlertDialog, Button } from "@heroui/react";
import { toast } from "sonner";
import { usePwaRuntime } from "@/components/pwa/pwa-provider";

/**
 * 退出登录入口。设置页和任何未来的入口都通过它触发统一的隐私退出流程：
 *   AlertDialog 确认 → PwaProvider.beginLogout → 锁屏 → 联网确认 → 跳登录。
 *
 * 退出逻辑本身在 PwaProvider，让任何标签都能从锁屏触发重试。
 */
export function LogoutSection() {
  const pwa = usePwaRuntime();
  const [showConfirm, setShowConfirm] = useState(false);

  const triggerLogout = async () => {
    const outcome = await pwa.privacy.beginLogout();
    // 失败时锁屏会接管 UI（provider 已切到 PrivacyLockScreen）。这里只在
    // 锁屏外的"无网络/无法加载"路径提示一下，让用户看到失败原因。
    if (outcome && !outcome.ok) {
      toast.error(outcome.reason);
    }
    setShowConfirm(false);
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-center gap-2 text-[var(--danger)]"
        onPress={() => setShowConfirm(true)}
      >
        退出登录
      </Button>

      <AlertDialog isOpen={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>确认退出登录?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-sm text-muted-foreground">
                  退出后需重新输入账号密码登录。
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer className="flex justify-end gap-2">
                <Button variant="outline" onPress={() => setShowConfirm(false)}>
                  取消
                </Button>
                <Button variant="danger" onPress={() => void triggerLogout()}>
                  退出登录
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}
