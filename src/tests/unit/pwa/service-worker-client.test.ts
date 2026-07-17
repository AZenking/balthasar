import { describe, expect, it, vi } from "vitest";

import { registerServiceWorker } from "@/lib/pwa/service-worker-client";

function makeWorker(state: ServiceWorkerState = "activated", buildId = "abc12345") {
  const listeners = new Map<string, Set<(event: Event) => void>>();
  const worker = {
    state,
    postMessage: vi.fn(),
    addEventListener: vi.fn((type: string, listener: (event: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    }),
  };
  return worker;
}

function makeContainer(options: {
  initialRegistration?: ServiceWorkerRegistration;
  registerResult?: ServiceWorkerRegistration;
} = {}) {
  const controllerChangeListeners = new Set<(event: Event) => void>();
  const updateFoundListeners = new Set<(event: Event) => void>();
  const messageListeners = new Set<(event: MessageEvent) => void>();
  const initialReg = options.initialRegistration ?? (options.registerResult ?? makeRegistration());
  const currentReg = initialReg;
  const container = {
    controller: { postMessage: vi.fn() } as unknown as ServiceWorker,
    ready: Promise.resolve(currentReg),
    register: vi.fn().mockResolvedValue(options.registerResult ?? currentReg),
    addEventListener: vi.fn((type: string, listener: (event: Event | MessageEvent) => void) => {
      const store =
        type === "controllerchange"
          ? controllerChangeListeners
          : type === "message"
            ? (messageListeners as unknown as Set<(event: Event) => void>)
            : updateFoundListeners;
      store.add(listener as (event: Event) => void);
    }),
    removeEventListener: vi.fn(),
    _fireControllerChange() {
      const event = { type: "controllerchange" } as Event;
      for (const listener of controllerChangeListeners) listener(event);
    },
    _fireUpdateFound() {
      const event = { type: "updatefound" } as Event;
      for (const listener of updateFoundListeners) listener(event);
    },
    _fireMessage(data: unknown, source: unknown) {
      const event = { data, source } as MessageEvent;
      for (const listener of messageListeners) listener(event);
    },
  } as unknown as ServiceWorkerContainer & {
    _fireControllerChange(): void;
    _fireUpdateFound(): void;
    _fireMessage(data: unknown, source: unknown): void;
  };
  return container;
}

function makeRegistration(waiting?: Partial<ServiceWorker>): ServiceWorkerRegistration {
  return {
    waiting: waiting ?? null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServiceWorkerRegistration;
}

describe("service worker client", () => {
  it("registers only in production at root scope with cache bypassing", async () => {
    const registration = makeRegistration();
    const register = vi.fn().mockResolvedValue(registration);
    const serviceWorker = {
      controller: null,
      ready: Promise.resolve(registration),
      register,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as ServiceWorkerContainer;

    await expect(
      registerServiceWorker({
        environment: "production",
        serviceWorker,
        onUpdate: () => {},
      }),
    ).resolves.toMatchObject({ status: "ready" });
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });

  it("does not leave a worker behind in development", async () => {
    const register = vi.fn();
    const serviceWorker = { controller: null, register } as unknown as ServiceWorkerContainer;
    await expect(
      registerServiceWorker({ environment: "development", serviceWorker, onUpdate: () => {} }),
    ).resolves.toEqual({ status: "skipped" });
    expect(register).not.toHaveBeenCalled();
  });

  it("degrades to ordinary web when registration fails", async () => {
    const serviceWorker = {
      controller: null,
      register: vi.fn().mockRejectedValue(new Error("blocked")),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as ServiceWorkerContainer;
    await expect(
      registerServiceWorker({ environment: "production", serviceWorker, onUpdate: () => {} }),
    ).resolves.toEqual({ status: "failed" });
  });

  it("does NOT announce an update on first install when there is no waiting worker", async () => {
    const onUpdate = vi.fn();
    const registration = makeRegistration(undefined);
    const container = makeContainer({ registerResult: registration });
    await registerServiceWorker({ environment: "production", serviceWorker: container, onUpdate });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("announces an update when registration already has a waiting worker", async () => {
    const onUpdate = vi.fn();
    const waiting = makeWorker("installed", "deadbeef");
    const registration = makeRegistration(waiting as unknown as ServiceWorker);
    const container = makeContainer({ registerResult: registration });
    await registerServiceWorker({ environment: "production", serviceWorker: container, onUpdate });
    container._fireMessage({ type: "WORKER_READY", buildId: "deadbeef" }, waiting);
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ buildId: "deadbeef" }));
  });

  it("flushes the draft, posts SKIP_WAITING with matching buildId, then reloads exactly once on controllerchange", async () => {
    const waiting = makeWorker("installed", "feedfeed");
    const registration = makeRegistration(waiting as unknown as ServiceWorker);
    const container = makeContainer({ registerResult: registration });
    const flush = vi.fn();
    const reload = vi.fn();
    let captured:
      | { applyUpdate: () => Promise<{ ok: true } | { ok: false; reason: string }> }
      | undefined;
    await registerServiceWorker({
      environment: "production",
      serviceWorker: container,
      flushDraftBeforeReload: flush,
      reload: () => reload(),
      onUpdate: (info) => { captured = info; },
    });
    container._fireMessage({ type: "WORKER_READY", buildId: "feedfeed" }, waiting);
    await vi.waitFor(() => expect(captured).toBeTruthy());
    // Drive the reload: race winner is controllerchange, fired here.
    const pending = captured!.applyUpdate();
    container._fireControllerChange();
    const outcome = await pending;
    expect(outcome.ok).toBe(true);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING", buildId: "feedfeed" });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("refuses to post SKIP_WAITING when the announced buildId does not match the waiting worker", async () => {
    const waiting = makeWorker("installed", "feedfeed");
    const registration = makeRegistration(waiting as unknown as ServiceWorker);
    const container = makeContainer({ registerResult: registration });
    let captured:
      | { buildId: string; applyUpdate: () => Promise<{ ok: true } | { ok: false; reason: string }> }
      | undefined;
    await registerServiceWorker({
      environment: "production",
      serviceWorker: container,
      activationTimeoutMs: 10,
      onUpdate: (info) => { captured = info; },
    });
    container._fireMessage({ type: "WORKER_READY", buildId: "deadbeef" }, waiting);
    await vi.waitFor(() => expect(captured).toBeTruthy());
    const outcome = await captured!.applyUpdate();
    expect(outcome.ok).toBe(false);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING", buildId: "deadbeef" });
  });

  it("treats controllerchange timeout as a failure — no reload loop, controller retained", async () => {
    const waiting = makeWorker("installed", "cafe1234");
    const registration = makeRegistration(waiting as unknown as ServiceWorker);
    const container = makeContainer({ registerResult: registration });
    const reload = vi.fn();
    let captured:
      | { applyUpdate: () => Promise<{ ok: true } | { ok: false; reason: string }> }
      | undefined;
    let failureReport:
      | { buildId: string; reason: string }
      | undefined;
    await registerServiceWorker({
      environment: "production",
      serviceWorker: container,
      reload: () => reload(),
      activationTimeoutMs: 10,
      onUpdate: (info) => { captured = info; },
      onActivationFailed: (info) => { failureReport = info; },
    });
    container._fireMessage({ type: "WORKER_READY", buildId: "cafe1234" }, waiting);
    await vi.waitFor(() => expect(captured).toBeTruthy());
    const outcome = await captured!.applyUpdate();
    expect(outcome.ok).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(failureReport).toEqual({ buildId: "cafe1234", reason: "timeout" });
  });
});

