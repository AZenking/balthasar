import { PWA_SCHEMA_VERSION, parseVersionedEnvelope } from "@/lib/pwa/contracts";

export type InstallMode = "prompt" | "ios-guide" | "installed" | "unavailable";

export interface InstallState {
  mode: InstallMode;
  canInstall: boolean;
}

export interface InstallEnvironment {
  userAgent: string;
  standalone: boolean;
  hasDeferredPrompt: boolean;
}

const IOS_PATTERN = /iPad|iPhone|iPod/i;
const CHROMIUM_PATTERN = /(?:Chrome|Chromium|Edg|OPR)\//i;

/** Derives a presentation state only; it never requests permission on load. */
export function deriveInstallState({
  userAgent,
  standalone,
  hasDeferredPrompt,
}: InstallEnvironment): InstallState {
  if (standalone) return { mode: "installed", canInstall: false };
  if (IOS_PATTERN.test(userAgent)) return { mode: "ios-guide", canInstall: false };
  if (hasDeferredPrompt && CHROMIUM_PATTERN.test(userAgent)) {
    return { mode: "prompt", canInstall: true };
  }
  return { mode: "unavailable", canInstall: false };
}

export function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Install preference (V1) — proactive CTA frequency control.
// localStorage is untrusted; reads always validate and fall back to NO_PREFERENCE.

export const INSTALL_PREFERENCE_STORAGE_KEY = "balthasar.pwa.install-pref.v1";
export const INSTALL_SUPPRESS_DAYS = 30;
export const INSTALL_SUPPRESS_MS = INSTALL_SUPPRESS_DAYS * 24 * 60 * 60 * 1000;

export interface InstallPreference {
  /** User explicitly dismissed the proactive CTA. */
  dismissed: boolean;
  /** epoch ms — proactive CTA stays silent until this timestamp passes. */
  suppressUntil: number | null;
  /** epoch ms — last time we showed the proactive CTA for a core-action milestone. */
  coreActionPromptedAt: number | null;
  /** epoch ms — appinstalled event observed. */
  installedAt: number | null;
}

export const NO_INSTALL_PREFERENCE: InstallPreference = {
  dismissed: false,
  suppressUntil: null,
  coreActionPromptedAt: null,
  installedAt: null,
};

export function readInstallPreference(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  now: number,
): InstallPreference {
  let raw: string | null;
  try {
    raw = storage.getItem(INSTALL_PREFERENCE_STORAGE_KEY);
  } catch {
    return NO_INSTALL_PREFERENCE;
  }
  if (!raw) return NO_INSTALL_PREFERENCE;
  const parsed = parseVersionedEnvelope(raw);
  if (!parsed.ok) return NO_INSTALL_PREFERENCE;
  const data = parsed.data as Partial<InstallPreference>;
  return {
    dismissed: typeof data.dismissed === "boolean" ? data.dismissed : false,
    suppressUntil:
      typeof data.suppressUntil === "number" || data.suppressUntil === null
        ? (data.suppressUntil as number | null)
        : null,
    coreActionPromptedAt:
      typeof data.coreActionPromptedAt === "number" || data.coreActionPromptedAt === null
        ? (data.coreActionPromptedAt as number | null)
        : null,
    installedAt:
      typeof data.installedAt === "number" || data.installedAt === null
        ? (data.installedAt as number | null)
        : null,
  };
}

export function writeInstallPreference(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  pref: InstallPreference,
): void {
  const envelope = { schemaVersion: PWA_SCHEMA_VERSION, data: pref };
  try {
    storage.setItem(INSTALL_PREFERENCE_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Best-effort: if storage is denied we simply can't remember the user's
    // preference. The settings entry is still available every session.
  }
}

/** True when the user has dismissed the proactive CTA and 30 days have not passed. */
export function isInstallSuppressed(pref: InstallPreference, now: number): boolean {
  if (typeof pref.suppressUntil === "number" && pref.suppressUntil > now) return true;
  return false;
}

export function shouldShowProactiveInstallCTA(args: {
  preference: InstallPreference;
  mode: InstallMode;
  hasReachedCoreActionMilestone: boolean;
  now: number;
}): boolean {
  const { preference, mode, hasReachedCoreActionMilestone, now } = args;
  if (mode !== "prompt") return false;
  if (!hasReachedCoreActionMilestone) return false;
  if (isInstallSuppressed(preference, now)) return false;
  // Show only once per milestone — once we've prompted, stay quiet until the
  // user clears the preference or hits the 30-day reset.
  if (preference.coreActionPromptedAt !== null) return false;
  return true;
}
