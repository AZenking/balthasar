"use client";

/**
 * sync-register — 033 US2 / FR-005 / FR-009:注册 Background Sync + iOS 降级。
 *
 * 入队后调用 registerPendingSync():
 * - 支持 Background Sync(Android Chrome / 桌面 Chrome/Edge):reg.sync.register
 * - 不支持(iOS Safari / Firefox 桌面):postMessage SW 触发立即 flush
 *   (SW 收到消息后跑同一 flushQueue);同时 online/visibilitychange 也会触发。
 *
 * SW 端的 flush 逻辑在 scripts/generate-service-worker.mjs(T037)。
 */
export const SYNC_TAG = "balthasar-flush-queue";

/**
 * 注册一次后台同步(或降级触发立即 flush)。
 * 幂等:多次注册同一 tag 浏览器只排一次。
 */
export async function registerPendingSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return; // 非浏览器 / 无 SW(如 SSR)
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("sync" in reg) {
      // Background Sync:浏览器在网络恢复 + 算法允许时触发 sync 事件
      await (reg as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }).sync.register(SYNC_TAG);
      return;
    }
    // iOS / 不支持 Background Sync:立即 postMessage SW flush
    reg.active?.postMessage({ type: "FLUSH_PENDING_QUEUE" });
  } catch {
    // SW 未就绪 / 注册失败:不阻塞 UI,下次 online/visibilitychange 会兜底
  }
}

/**
 * 前台降级:监听 online + visibilitychange,触发 SW flush。
 * 在 app 顶层(app-shell)调用一次。
 */
export function setupForegroundFlush(): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return () => undefined;
  }
  const trigger = () => {
    if (navigator.onLine) {
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "FLUSH_PENDING_QUEUE" }))
        .catch(() => undefined);
    }
  };
  window.addEventListener("online", trigger);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trigger();
  });
  return () => {
    window.removeEventListener("online", trigger);
  };
}
