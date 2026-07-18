"use client";

import { Alert, Button } from "@heroui/react";

export interface PrivacyLockScreenProps {
  /** Failure reason surfaced by the most recent logout attempt, if any. */
  errorMessage?: string | null;
  /** True while a retry request is in flight; disables the retry button. */
  retrying?: boolean;
  /** Called when the user presses 重试. */
  onRetry?: () => void;
}

/**
 * Full-screen privacy lock. Renders zero account content — the inner
 * Alert shows only the lock status and, optionally, a retry path.
 */
export function PrivacyLockScreen({
  errorMessage,
  retrying = false,
  onRetry,
}: PrivacyLockScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Alert status="warning" role="status" aria-live="assertive" className="max-w-md">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>应用已锁定</Alert.Title>
          <Alert.Description>
            {errorMessage
              ? errorMessage
              : "联网后完成退出。账号内容不会在确认退出前显示。"}
          </Alert.Description>
        </Alert.Content>
        {onRetry && (
          <Button
            variant="outline"
            isDisabled={retrying}
            onPress={onRetry}
          >
            {retrying ? "重试中…" : "重试退出"}
          </Button>
        )}
      </Alert>
    </main>
  );
}
