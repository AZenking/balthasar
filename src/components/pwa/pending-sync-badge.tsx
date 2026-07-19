"use client";

import { useEffect, useState } from "react";
import { Alert } from "@heroui/react";
import { useAccountScope } from "@/components/pwa/account-scope-sync";
import { getFailedQueue } from "@/lib/offline/queue-store";

/**
 * PendingSyncBadge — 033 US2 / FR-007:待同步失败项的提示条。
 *
 * 仅当 pending_queue 有 status=failed 的项时显示(同步重试达上限或 401)。
 * 提示用户"有 N 笔交易未能同步"。(成功入队/同步中的项不提示 —— 后台静默。)
 *
 * 挂载在 app-shell(与 ConnectivityAlert 同位置)。宪章原则七:复用 HeroUI Alert
 * slot,与既有 ConnectivityAlert 视觉一致。
 */
export function PendingSyncBadge() {
  const scope = useAccountScope();
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (typeof indexedDB === "undefined" || !scope) {
      setFailedCount(0);
      return;
    }
    let cancelled = false;
    getFailedQueue(scope)
      .then((items) => {
        if (!cancelled) setFailedCount(items.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [scope]);

  if (failedCount === 0) return null;

  return (
    <Alert status="warning" role="status" aria-live="polite" className="mb-4">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>有 {failedCount} 笔交易未能同步</Alert.Title>
        <Alert.Description>
          请检查网络后重试,或到交易列表核对。
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
