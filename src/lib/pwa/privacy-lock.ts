import {
  PWA_BROADCAST_CHANNEL,
  type PwaBroadcastEvent,
} from "@/lib/pwa/contracts";

export const PRIVACY_LOCK_STORAGE_KEY = "balthasar.pwa.privacy-lock.v1";
export const PENDING_LOGOUT_COOKIE = "balthasar.pwa.pending_logout";
const BROADCAST_FALLBACK_STORAGE_KEY = "balthasar.pwa.broadcast.v1";

function storageAvailable(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function postToChannel(event: PwaBroadcastEvent): void {
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(PWA_BROADCAST_CHANNEL);
      channel.postMessage(event);
      channel.close();
      return;
    } catch {
      // Fall through to the storage-event shim.
    }
  }
  try {
    storageAvailable()?.setItem(
      BROADCAST_FALLBACK_STORAGE_KEY,
      `${JSON.stringify(event)}@${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
  } catch {
    // Other tabs will miss this signal; the active tab still keeps its own state.
  }
}

/**
 * Broadcasts a PWA runtime event to other same-origin tabs. The payload never
 * includes credentials, financial data, or draft fields — only the signal
 * other tabs need to synchronize privacy, scope, or update UI.
 */
export function broadcastPwaEvent(event: PwaBroadcastEvent): void {
  postToChannel(event);
}

/**
 * Subscribes to cross-tab PWA events. Returns an unsubscribe function. When
 * `BroadcastChannel` is unavailable, falls back to `storage` events. The
 * returned handler always sees parsed events — never raw `MessageEvent`s.
 */
export function subscribePwaBroadcast(
  handler: (event: PwaBroadcastEvent) => void,
): () => void {
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(PWA_BROADCAST_CHANNEL);
      const listener = (message: MessageEvent) => {
        const data = message.data as PwaBroadcastEvent | undefined;
        if (data && typeof data === "object" && typeof data.type === "string") {
          handler(data);
        }
      };
      channel.addEventListener("message", listener);
      return () => {
        channel.removeEventListener("message", listener);
        channel.close();
      };
    } catch {
      // Fall through to storage-event shim.
    }
  }

  if (typeof window === "undefined" || !window.addEventListener) {
    return () => {};
  }
  const listener = (event: StorageEvent) => {
    if (event.key !== BROADCAST_FALLBACK_STORAGE_KEY || !event.newValue) return;
    const raw = event.newValue;
    const separator = raw.lastIndexOf("@");
    const payload = separator > 0 ? raw.slice(0, separator) : raw;
    try {
      const parsed = JSON.parse(payload) as PwaBroadcastEvent;
      if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
        handler(parsed);
      }
    } catch {
      // Ignore malformed payloads; storage is untrusted.
    }
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export function isPrivacyLocked(): boolean {
  try {
    return storageAvailable()?.getItem(PRIVACY_LOCK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Immediately protects the local UI; it does not claim server logout succeeded. */
export function lockPrivacy(): void {
  try {
    storageAvailable()?.setItem(PRIVACY_LOCK_STORAGE_KEY, "1");
  } catch {
    // Session-only callers still receive their in-memory lock state.
  }
  if (typeof document !== "undefined") {
    document.cookie = `${PENDING_LOGOUT_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=900`;
  }
  broadcastPwaEvent({ type: "PRIVACY_LOCKED" });
}

/** Only call after Better Auth confirms that the server session is absent. */
export function clearPrivacyLock(): void {
  try {
    storageAvailable()?.removeItem(PRIVACY_LOCK_STORAGE_KEY);
  } catch {
    // Cookie clear still proceeds.
  }
  if (typeof document !== "undefined") {
    document.cookie = `${PENDING_LOGOUT_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
  }
  broadcastPwaEvent({ type: "LOGOUT_COMPLETED" });
}
