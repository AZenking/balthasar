import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PwaProvider, usePwaRuntime } from "@/components/pwa/pwa-provider";

function withQueryClient(node: React.ReactNode) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

function Consumer() {
  const runtime = usePwaRuntime();
  return <output>{runtime.connectivity.stableOnline ? "online" : "offline"}</output>;
}

function InstallConsumer() {
  const runtime = usePwaRuntime();
  return (
    <button onClick={() => void runtime.install.request()}>
      {runtime.install.state.mode}
    </button>
  );
}

describe("PwaProvider", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("keeps the ordinary web application usable when PWA browser APIs are absent", () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", undefined);
    vi.stubGlobal("BroadcastChannel", undefined);

    expect(() =>
      render(
        withQueryClient(
          <PwaProvider>
            <Consumer />
          </PwaProvider>
        )
      )
    ).not.toThrow();

    expect(screen.getByText("online")).toBeTruthy();
  });

  it("captures a Chromium install prompt and only opens it after a user action", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      preventDefault: () => void;
    };
    event.prompt = prompt;
    event.preventDefault = vi.fn();

    render(
      withQueryClient(
        <PwaProvider>
          <InstallConsumer />
        </PwaProvider>
      )
    );
    window.dispatchEvent(event);

    expect(await screen.findByRole("button", { name: "prompt" })).toBeTruthy();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(prompt).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "prompt" }));
    expect(prompt).toHaveBeenCalledOnce();
  });
});
