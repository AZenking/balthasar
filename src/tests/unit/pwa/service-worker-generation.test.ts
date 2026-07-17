import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, "../../../..");

async function generateWorker(source = "offline shell v1"): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "balthasar-pwa-"));
  const input = path.join(directory, "offline.html");
  const output = path.join(directory, "sw.js");
  await writeFile(input, source);
  try {
    await execFileAsync("node", [
      path.join(root, "scripts/generate-service-worker.mjs"),
      "--offline",
      input,
      "--output",
      output,
    ]);
    return await readFile(output, "utf8");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("service worker generation", () => {
  it("generates a deterministic build id from cacheable inputs", async () => {
    const first = await generateWorker();
    const second = await generateWorker();
    const changed = await generateWorker("offline shell v2");

    expect(first).toBe(second);
    expect(first).not.toBe(changed);
  });

  it("contains a strict public-only cache allowlist and offline navigation fallback", async () => {
    const worker = await generateWorker();

    expect(worker).toContain('"/offline.html"');
    expect(worker).toContain('"/manifest.webmanifest"');
    expect(worker).toContain('"/pwa/icon-192.png"');
    expect(worker).toContain("request.mode === 'navigate'");
    expect(worker).toContain("return caches.match('/offline.html')");
  });

  it("keeps writes, API/auth/tRPC/RSC requests and bad responses network-only", async () => {
    const worker = await generateWorker();

    expect(worker).toContain("request.method !== 'GET'");
    expect(worker).toContain("url.pathname.startsWith('/api/')");
    expect(worker).toContain("url.pathname.startsWith('/api/auth')");
    expect(worker).toContain("url.pathname.startsWith('/api/trpc')");
    expect(worker).toContain("request.headers.has('RSC')");
    expect(worker).toContain("response.ok && response.status === 200");
  });

  it("only removes its own old cache prefix during activation", async () => {
    const worker = await generateWorker();
    expect(worker).toContain("key.startsWith(CACHE_PREFIX)");
    expect(worker).toContain("key !== SHELL_CACHE && key !== STATIC_CACHE");
  });
});
