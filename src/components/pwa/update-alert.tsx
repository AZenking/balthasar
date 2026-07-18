"use client";

import { Alert, Button } from "@heroui/react";

export type UpdateAlertState =
  | { status: "idle" }
  | { status: "available"; buildId: string }
  | { status: "applying"; buildId: string }
  | { status: "failed"; buildId: string; reason: string };

export interface UpdateAlertProps {
  state: UpdateAlertState;
  onApplyNow: () => void;
  onLater: () => void;
  onRetry: () => void;
}

/**
 * Surfaces a waiting Service Worker as a non-blocking HeroUI Alert. The user
 * chooses 立即更新 (flushes the draft first) or 稀后 (defers until next
 * launch). Activation failure keeps the current controller and offers 重试 so
 * the user never silently loses input to a reload loop.
 */
export function UpdateAlert({ state, onApplyNow, onLater, onRetry }: UpdateAlertProps) {
  if (state.status === "idle") return null;

  const status = state.status;
  return (
    <Alert
      status={status === "failed" ? "danger" : "accent"}
      role="status"
      aria-live="polite"
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {status === "applying" ? "正在激活新版本" : "新版本已准备好"}
        </Alert.Title>
        <Alert.Description>
          {status === "applying"
            ? "请稍候，页面会自动刷新一次完成更新。"
            : status === "failed"
              ? `更新失败，可重试。原因：${state.reason}`
              : "立即更新会自动保存草稿并刷新页面。"}
        </Alert.Description>
      </Alert.Content>
      {status === "available" && (
        <>
          <Button variant="ghost" onPress={onLater}>
            稍后
          </Button>
          <Button variant="primary" onPress={onApplyNow}>
            立即更新
          </Button>
        </>
      )}
      {status === "failed" && (
        <Button variant="outline" onPress={onRetry}>
          重试
        </Button>
      )}
    </Alert>
  );
}
