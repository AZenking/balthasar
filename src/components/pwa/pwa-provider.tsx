"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createConnectivityState,
  transitionConnectivity,
  type ConnectivityState,
} from "@/lib/pwa/contracts";
import {
  deriveInstallState,
  detectStandalone,
  INSTALL_SUPPRESS_MS,
  NO_INSTALL_PREFERENCE,
  readInstallPreference,
  shouldShowProactiveInstallCTA,
  writeInstallPreference,
  type InstallPreference,
  type InstallState,
} from "@/lib/pwa/install-state";
import { registerServiceWorker, type UpdateAnnouncement } from "@/lib/pwa/service-worker-client";
import { classifyRequestOutcome, PWA_REACHABILITY_EVENT, type RequestOutcome } from "@/lib/pwa/service-reachability";
import {
  clearPrivacyLock,
  isPrivacyLocked,
  lockPrivacy,
  subscribePwaBroadcast,
  broadcastPwaEvent,
} from "@/lib/pwa/privacy-lock";
import { performPrivacyLogout, type PrivacyLogoutOutcome } from "@/lib/pwa/privacy-logout-flow";
import { createDraftStorage } from "@/lib/pwa/draft-storage";
import { PrivacyLockScreen } from "@/components/pwa/privacy-lock-screen";
import { UpdateAlert, type UpdateAlertState } from "@/components/pwa/update-alert";
import { InstallSection } from "@/components/pwa/install-section";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

export interface PrivacyLogoutState {
  locked: boolean;
  retrying: boolean;
  errorMessage: string | null;
  beginLogout: () => Promise<PrivacyLogoutOutcome>;
}

export interface PwaRuntime {
  connectivity: ConnectivityState;
  install: {
    state: InstallState;
    request: () => Promise<void>;
    /** Records that the user completed the core action (a successful create). */
    markCoreActionReached: () => void;
  };
  privacy: PrivacyLogoutState;
  update: {
    state: UpdateAlertState;
    applyNow: () => Promise<void>;
    later: () => void;
    retry: () => Promise<void>;
  };
}

const PwaRuntimeContext = createContext<PwaRuntime | null>(null);

function getInitialConnectivity(): ConnectivityState {
  return createConnectivityState(
    typeof navigator === "undefined" || navigator.onLine !== false
  );
}

/**
 * Progressive enhancement boundary. It deliberately does not assume service
 * workers, install prompts, storage, or BroadcastChannel are available.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [connectivity, setConnectivity] = useState(getInitialConnectivity);
  const [installState, setInstallState] = useState<InstallState>(() =>
    deriveInstallState({
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      standalone: detectStandalone(),
      hasDeferredPrompt: false,
    })
  );
  const deferredInstallPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [privacyLocked, setPrivacyLocked] = useState(isPrivacyLocked);
  const [privacyRetrying, setPrivacyRetrying] = useState(false);
  const [privacyErrorMessage, setPrivacyErrorMessage] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<UpdateAlertState>({ status: "idle" });
  const pendingAnnouncementRef = useRef<UpdateAnnouncement | null>(null);
  const [installPreference, setInstallPreference] = useState<InstallPreference>(NO_INSTALL_PREFERENCE);
  const [coreActionReached, setCoreActionReached] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.addEventListener) return;

    const settle = (online: boolean) => {
      setConnectivity((current) =>
        transitionConnectivity(current, online, Date.now())
      );
    };

    const onOnline = () => settle(true);
    const onOffline = () => settle(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.addEventListener) return;
    const onReachability = (event: Event) => {
      const outcome = (event as CustomEvent<RequestOutcome>).detail;
      if (!outcome) return;
      setConnectivity((current) => {
        const reachability = classifyRequestOutcome(outcome, current.stableOnline);
        return reachability === "unknown"
          ? current
          : transitionConnectivity(current, reachability, Date.now());
      });
    };
    window.addEventListener(PWA_REACHABILITY_EVENT, onReachability);
    return () => window.removeEventListener(PWA_REACHABILITY_EVENT, onReachability);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void registerServiceWorker({
      environment: process.env.NODE_ENV,
      flushDraftBeforeReload: () => {
        try {
          if (typeof localStorage !== "undefined") {
            createDraftStorage(localStorage).flush();
          }
        } catch {
          // Storage unavailable in private mode; proceed with the user's opt-in.
        }
      },
      onUpdate: (announcement) => {
        if (cancelled) return;
        pendingAnnouncementRef.current = announcement;
        setUpdateState({ status: "available", buildId: announcement.buildId });
      },
      onActivationFailed: ({ reason }) => {
        if (cancelled) return;
        const buildId = pendingAnnouncementRef.current?.buildId ?? "";
        setUpdateState({ status: "failed", buildId, reason });
      },
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Read install preference on mount so we can respect a prior dismissal.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    setInstallPreference(readInstallPreference(localStorage, Date.now()));
  }, []);

  // Proactive install CTA: visible only after the user completes a core action
  // (a successful transaction create), at most once, and never within the
  // 30-day suppress window after dismissal.
  const installCtaVisible = shouldShowProactiveInstallCTA({
    preference: installPreference,
    mode: installState.mode,
    hasReachedCoreActionMilestone: coreActionReached,
    now: Date.now(),
  });

  // The moment the CTA becomes visible we stamp `coreActionPromptedAt` so we
  // don't re-prompt for the same milestone.
  useEffect(() => {
    if (!installCtaVisible) return;
    if (installPreference.coreActionPromptedAt !== null) return;
    if (typeof localStorage === "undefined") return;
    const updated: InstallPreference = {
      ...installPreference,
      coreActionPromptedAt: Date.now(),
    };
    writeInstallPreference(localStorage, updated);
    setInstallPreference(updated);
  }, [installCtaVisible, installPreference]);

  const dismissInstallCta = useCallback(() => {
    if (typeof localStorage === "undefined") return;
    const now = Date.now();
    const updated: InstallPreference = {
      ...installPreference,
      dismissed: true,
      suppressUntil: now + INSTALL_SUPPRESS_MS,
    };
    writeInstallPreference(localStorage, updated);
    setInstallPreference(updated);
  }, [installPreference]);

  const markCoreActionReached = useCallback(() => {
    setCoreActionReached(true);
  }, []);

  // Cross-tab update coordination: another tab announcing UPDATE_AVAILABLE
  // makes us re-check our own registration for a waiting worker too. We never
  // auto-apply — every tab still requires an explicit user opt-in.
  useEffect(() => {
    const unsubscribe = subscribePwaBroadcast((event) => {
      if (event.type === "UPDATE_AVAILABLE" && navigator?.serviceWorker) {
        navigator.serviceWorker.getRegistrations?.().then((regs) => {
          for (const reg of regs) {
            if (reg.waiting) {
              // Force the browser to re-evaluate; the next WORKER_READY will
              // re-announce via the local handler.
              reg.update?.().catch(() => {});
            }
          }
        }).catch(() => {});
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.addEventListener) return;
    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      if (typeof promptEvent.prompt !== "function") return;
      event.preventDefault();
      deferredInstallPrompt.current = promptEvent;
      setInstallState({ mode: "prompt", canInstall: true });
    };
    const onAppInstalled = () => {
      deferredInstallPrompt.current = null;
      setInstallState({ mode: "installed", canInstall: false });
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // Cross-tab synchronization: when another tab broadcasts a privacy lock or
  // completion, this tab mirrors the state so a multi-tab session cannot leak
  // account content after any tab begins logout.
  useEffect(() => {
    const unsubscribe = subscribePwaBroadcast((event) => {
      if (event.type === "PRIVACY_LOCKED") {
        setPrivacyLocked(true);
      } else if (event.type === "LOGOUT_COMPLETED") {
        setPrivacyLocked(false);
        setPrivacyRetrying(false);
        setPrivacyErrorMessage(null);
      } else if (event.type === "DRAFT_CLEARED") {
        // Another tab cleared this account's private state; drop our in-memory
        // cache so we never render stale account content from a prior session.
        queryClient.clear();
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const requestInstall = async () => {
    const prompt = deferredInstallPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
  };

  const applyUpdateNow = useCallback(async () => {
    const announcement = pendingAnnouncementRef.current;
    if (!announcement) return;
    setUpdateState({ status: "applying", buildId: announcement.buildId });
    const result = await announcement.applyUpdate();
    if (!result.ok) {
      setUpdateState({
        status: "failed",
        buildId: announcement.buildId,
        reason: result.reason,
      });
    }
    // On success the controllerchange triggers reload — this state is moot.
  }, []);

  const applyUpdateLater = useCallback(() => {
    setUpdateState({ status: "idle" });
  }, []);

  const retryUpdate = useCallback(async () => {
    const announcement = pendingAnnouncementRef.current;
    if (!announcement) {
      setUpdateState({ status: "idle" });
      return;
    }
    setUpdateState({ status: "applying", buildId: announcement.buildId });
    const result = await announcement.applyUpdate();
    if (!result.ok) {
      setUpdateState({
        status: "failed",
        buildId: announcement.buildId,
        reason: result.reason,
      });
    }
  }, []);

  const beginLogout = useCallback(async (): Promise<PrivacyLogoutOutcome> => {
    setPrivacyRetrying(true);
    setPrivacyErrorMessage(null);
    let authClient: {
      signOut: () => Promise<{ error?: { message?: string } | null }>;
      getSession: () => Promise<{ data: unknown; error?: { message?: string } | null }>;
    };
    try {
      authClient = (await import("@/server/auth/client")).authClient;
    } catch {
      setPrivacyRetrying(false);
      setPrivacyErrorMessage("无法加载认证模块，请重试");
      lockPrivacy();
      setPrivacyLocked(true);
      return { ok: false, reason: "无法加载认证模块，请重试" };
    }

    const outcome = await performPrivacyLogout({
      lock: () => {
        lockPrivacy();
        setPrivacyLocked(true);
      },
      unlock: () => {
        clearPrivacyLock();
        setPrivacyLocked(false);
      },
      clearAllCaches: () => {
        queryClient.clear();
        try {
          if (typeof localStorage !== "undefined") {
            createDraftStorage(localStorage).clear();
          }
        } catch {
          // Storage may be unavailable in private mode; the lock still holds.
        }
        broadcastPwaEvent({ type: "DRAFT_CLEARED", scope: "logout" });
      },
      signOut: () => authClient.signOut(),
      verifySessionCleared: () => authClient.getSession(),
      reloadToLogin: () => {
        if (typeof window !== "undefined") {
          window.location.replace("/login");
        }
      },
    });

    if (!outcome.ok) {
      setPrivacyRetrying(false);
      setPrivacyErrorMessage(outcome.reason);
    }
    // On success, performPrivacyLogout reloads to /login before this point.
    return outcome;
  }, [queryClient]);

  const value = useMemo<PwaRuntime>(
    () => ({
      connectivity,
      install: { state: installState, request: requestInstall, markCoreActionReached },
      privacy: {
        locked: privacyLocked,
        retrying: privacyRetrying,
        errorMessage: privacyErrorMessage,
        beginLogout,
      },
      update: {
        state: updateState,
        applyNow: applyUpdateNow,
        later: applyUpdateLater,
        retry: retryUpdate,
      },
    }),
    [
      connectivity,
      installState,
      privacyLocked,
      privacyRetrying,
      privacyErrorMessage,
      beginLogout,
      updateState,
      applyUpdateNow,
      applyUpdateLater,
      retryUpdate,
      markCoreActionReached,
    ]
  );

  return (
    <PwaRuntimeContext.Provider value={value}>
      {privacyLocked ? (
        <PrivacyLockScreen
          retrying={privacyRetrying}
          errorMessage={privacyErrorMessage}
          onRetry={beginLogout}
        />
      ) : (
        <div className="space-y-2">
          {updateState.status !== "idle" && (
            <UpdateAlert
              state={updateState}
              onApplyNow={() => void applyUpdateNow()}
              onLater={applyUpdateLater}
              onRetry={() => void retryUpdate()}
            />
          )}
          {installCtaVisible && (
            <InstallSection
              state={installState}
              onInstall={() => void requestInstall()}
              variant="cta"
              visible
              onDismiss={dismissInstallCta}
            />
          )}
          {children}
        </div>
      )}
    </PwaRuntimeContext.Provider>
  );
}

export function usePwaRuntime(): PwaRuntime {
  const runtime = useContext(PwaRuntimeContext);
  if (!runtime) {
    throw new Error("usePwaRuntime must be used inside PwaProvider");
  }
  return runtime;
}
