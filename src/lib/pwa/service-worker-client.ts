/**
 * Service Worker registration + waiting-worker update protocol.
 *
 * The registration never throws: a worker that fails to install simply leaves
 * the app running as an ordinary online web app. Update announcements only
 * fire when a *waiting* worker is observed — first install never reloads the
 * page. Activation is gated on an explicit user opt-in via `applyUpdate`,
 * which verifies the waiting worker's buildId before sending SKIP_WAITING.
 */

export type WorkerRegistrationResult =
  | { status: "ready"; registration: ServiceWorkerRegistration }
  | { status: "skipped" | "failed" };

export interface UpdateAnnouncement {
  buildId: string;
  applyUpdate: () => Promise<{ ok: true } | { ok: false; reason: string }>;
}

export interface ActivationFailure {
  buildId: string;
  reason: string;
}

export interface RegisterServiceWorkerOptions {
  environment: string;
  serviceWorker?: ServiceWorkerContainer;
  /** Called when the SW finishes install/activate with its BUILD_ID. */
  onReady?: (registration: ServiceWorkerRegistration) => void;
  /** Called when a new worker is waiting and the user can choose to apply it. */
  onUpdate: (announcement: UpdateAnnouncement) => void;
  /** Called when activation failed (timeout, controllerchange never fired). */
  onActivationFailed?: (info: ActivationFailure) => void;
  /** Flush the current draft before reload so the user does not lose input. */
  flushDraftBeforeReload?: () => Promise<void> | void;
  /** Indirection so tests can avoid `window.location.reload`. */
  reload?: () => void;
  /** Activation timeout before declaring failure. Defaults to 8s. */
  activationTimeoutMs?: number;
}

const DEFAULT_ACTIVATION_TIMEOUT_MS = 8000;

export async function registerServiceWorker(
  options: RegisterServiceWorkerOptions,
): Promise<WorkerRegistrationResult> {
  const {
    environment,
    onUpdate,
    onActivationFailed,
    flushDraftBeforeReload,
    reload = () => {
      if (typeof window !== "undefined") window.location.reload();
    },
    activationTimeoutMs = DEFAULT_ACTIVATION_TIMEOUT_MS,
  } = options;
  const serviceWorker =
    options.serviceWorker ??
    (typeof navigator === "undefined" ? undefined : navigator.serviceWorker);

  if (environment !== "production" || !serviceWorker) {
    return { status: "skipped" };
  }

  const knownBuildIds = new Set<string>();
  const announcedBuildIds = new Set<string>();
  let lastAnnouncedBuildId: string | null = null;
  let registration: ServiceWorkerRegistration | undefined;

  const maybeAnnounce = () => {
    if (!registration || !registration.waiting) return;
    const buildId = lastAnnouncedBuildId;
    if (!buildId || !knownBuildIds.has(buildId)) return;
    if (announcedBuildIds.has(buildId)) return;
    announcedBuildIds.add(buildId);
    onUpdate({
      buildId,
      applyUpdate: () =>
        applyUpdate({
          container: serviceWorker,
          registration,
          buildId,
          flushDraftBeforeReload,
          reload,
          onActivationFailed,
          activationTimeoutMs,
        }),
    });
  };

  try {
    if (typeof serviceWorker.addEventListener === "function") {
      serviceWorker.addEventListener("message", (event: MessageEvent) => {
        const data = event.data as { type?: string; buildId?: string } | undefined;
        if (!data || typeof data.buildId !== "string") return;
        if (data.type === "WORKER_READY") {
          knownBuildIds.add(data.buildId);
          lastAnnouncedBuildId = data.buildId;
          maybeAnnounce();
        }
      });
    }

    registration = await serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    if (typeof registration.addEventListener === "function") {
      registration.addEventListener("updatefound", () => {
        const installing = registration!.installing;
        if (!installing || typeof installing.addEventListener !== "function") return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            registration!.waiting === installing
          ) {
            maybeAnnounce();
          }
        });
      });
    }

    const ready = "ready" in serviceWorker ? await serviceWorker.ready : registration;
    options.onReady?.(ready);
    maybeAnnounce();

    return { status: "ready", registration: ready };
  } catch {
    return { status: "failed" };
  }
}

async function applyUpdate(args: {
  container: ServiceWorkerContainer | undefined;
  registration: ServiceWorkerRegistration | undefined;
  buildId: string;
  flushDraftBeforeReload?: () => Promise<void> | void;
  reload: () => void;
  onActivationFailed?: (info: ActivationFailure) => void;
  activationTimeoutMs: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const {
    container,
    registration,
    buildId,
    flushDraftBeforeReload,
    reload,
    onActivationFailed,
    activationTimeoutMs,
  } = args;
  const waiting = registration?.waiting;
  if (!waiting) {
    return { ok: false, reason: "no-waiting-worker" };
  }

  // Register the controllerchange listener BEFORE awaiting the draft flush,
  // so the worker can take over while we are still draining pending writes.
  let reloaded = false;
  const controllerChangePromise = new Promise<void>((resolve) => {
    if (!container || typeof container.addEventListener !== "function") {
      resolve();
      return;
    }
    const handler = () => {
      if (typeof container.removeEventListener === "function") {
        container.removeEventListener("controllerchange", handler);
      }
      if (!reloaded) {
        reloaded = true;
        reload();
      }
      resolve();
    };
    container.addEventListener("controllerchange", handler);
  });

  try {
    if (flushDraftBeforeReload) await flushDraftBeforeReload();
  } catch {
    // The user explicitly opted in to the update; do not block on flush errors.
  }

  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), activationTimeoutMs),
  );

  waiting.postMessage({ type: "SKIP_WAITING", buildId });

  const result = await Promise.race([
    controllerChangePromise.then(() => ({ timedOut: false }) as const),
    timeoutPromise,
  ]);

  if (result.timedOut) {
    onActivationFailed?.({ buildId, reason: "timeout" });
    return { ok: false, reason: "timeout" };
  }
  return { ok: true };
}
