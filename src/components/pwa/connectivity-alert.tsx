"use client";

import { Alert } from "@heroui/react";
import type { ConnectivityState } from "@/lib/pwa/contracts";

export function ConnectivityAlert({ connectivity }: { connectivity: ConnectivityState }) {
  if (!connectivity.stableOnline) {
    return (
      <Alert status="warning" role="status" aria-live="polite" className="mb-4">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>当前离线</Alert.Title>
          <Alert.Description>
            正在显示缓存数据，联网后自动刷新。
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }
  if (connectivity.serviceReachability === "unreachable") {
    return (
      <Alert status="danger" role="status" aria-live="polite" className="mb-4">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>服务暂不可用</Alert.Title>
          <Alert.Description>请稍后重试；设备网络可能仍然可用。</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }
  return null;
}
