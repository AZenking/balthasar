"use client";

import { Button, Card } from "@heroui/react";
import type { InstallState } from "@/lib/pwa/install-state";

export interface InstallSectionProps {
  state: InstallState;
  onInstall: () => void;
  /**
   * "settings" — always visible entry on the settings page (subject to
   *   platform capability only).
   * "cta" — proactive non-blocking CTA shown only when `visible` is true;
   *   carries a 稀后 dismiss action that suppresses the CTA for 30 days.
   */
  variant?: "settings" | "cta";
  /** cta-only: whether the proactive CTA may render. */
  visible?: boolean;
  /** cta-only: dismissal handler that records the 30-day suppress. */
  onDismiss?: () => void;
}

export function InstallSection({
  state,
  onInstall,
  variant = "settings",
  visible = true,
  onDismiss,
}: InstallSectionProps) {
  if (state.mode === "installed" || state.mode === "unavailable") return null;
  if (variant === "cta" && !visible) return null;

  if (state.mode === "ios-guide") {
    return (
      <Card>
        <Card.Header>
          <Card.Title>安装应用</Card.Title>
          <Card.Description>从主屏幕快速打开 BALTHASAR。</Card.Description>
        </Card.Header>
        <Card.Content>
          <p className="text-sm text-muted">分享 → 添加到主屏幕</p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>安装应用</Card.Title>
        <Card.Description>安装后可从系统主屏幕快速打开。</Card.Description>
      </Card.Header>
      <Card.Footer className="flex items-center gap-2">
        <Button onPress={onInstall}>安装应用</Button>
        {variant === "cta" && onDismiss && (
          <Button variant="ghost" onPress={onDismiss}>
            稍后
          </Button>
        )}
      </Card.Footer>
    </Card>
  );
}
