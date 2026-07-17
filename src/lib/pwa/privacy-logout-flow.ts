/**
 * Orchestration for the privacy-preserving sign-out flow.
 *
 * Pure async function with injectable dependencies so the dangerous invariant
 * — "the UI stays locked until the server confirms the session is gone" — can
 * be unit-tested without React, tRPC, or a real auth client.
 */

export interface PrivacyLogoutApis {
  lock(): void;
  unlock(): void;
  clearAllCaches(): void;
  signOut(): Promise<{ error?: { message?: string } | null }>;
  verifySessionCleared(): Promise<{
    data: unknown;
    error?: { message?: string } | null;
  }>;
  reloadToLogin(): void;
}

export type PrivacyLogoutOutcome = { ok: true } | { ok: false; reason: string };

/**
 * Sequence:
 *   lock → clear caches → signOut → getSession → unlock → reload.
 *
 * Any failure (network, server-confirmed still-logged-in, exception) keeps the
 * lock so the lock screen can render a retry path. The function never throws.
 */
export async function performPrivacyLogout(
  api: PrivacyLogoutApis,
): Promise<PrivacyLogoutOutcome> {
  api.lock();
  api.clearAllCaches();

  try {
    const signOutResult = await api.signOut();
    if (signOutResult.error) {
      return { ok: false, reason: signOutResult.error.message ?? "退出登录失败，请重试" };
    }

    const sessionResult = await api.verifySessionCleared();
    if (sessionResult.error) {
      return { ok: false, reason: sessionResult.error.message ?? "无法确认退出状态，请重试" };
    }
    if (sessionResult.data) {
      return { ok: false, reason: "会话仍未清除，请重试" };
    }

    api.unlock();
    api.reloadToLogin();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "退出登录失败，请重试",
    };
  }
}
